'use strict'

/**
 * Local, reconstructed view of Signal K notifications.
 *
 * It is intentionally a cache: every value originates in a Signal K snapshot
 * or delta and is discarded on plugin stop. The store must never infer that an
 * alarm is cleared merely because a UI consumer has stopped displaying it.
 */
class NotificationStore {
  /** @param {{classify: Function}} dependencies */
  constructor({ classify, historyLimit = 500, onEvent = () => {}, onChange = () => {}, shouldRecord = () => true, lifecycleRules = [], endsLifecycle = () => false }) {
    this.classify = classify
    this.historyLimit = historyLimit
    this.onEvent = onEvent
    this.onChange = onChange
    this.shouldRecord = shouldRecord
    this.lifecycleRules = lifecycleRules
    this.endsLifecycle = endsLifecycle
    this.records = new Map()
    this.events = []
  }

  get size() {
    return this.records.size
  }

  clear() {
    this.records.clear()
    this.events = []
  }

  /** Merge an authoritative `app.notifications.list()` snapshot into the cache. */
  replaceSnapshot(snapshot) {
    for (const [id, notification] of Object.entries(snapshot || {})) {
      this.upsert({ id, ...notification })
    }
  }

  /** Apply every notification value found in a standard Signal K delta. */
  applyDelta(delta) {
    for (const update of delta?.updates || []) {
      for (const item of update.values || []) {
        if (!String(item.path || '').startsWith('notifications.')) continue
        if (item.value === null) {
          this.removeByPath(item.path)
          continue
        }
        this.upsert({ path: item.path, source: update.source, value: item.value })
      }
    }
  }

  /** Return copies so presentation code cannot mutate local state. */
  list() {
    return [...this.records.values()].map(record => structuredClone(record))
  }

  /** Retrieve an internal record by Signal K notification identifier. */
  get(id) {
    return this.records.get(id)
  }

  /** Return the bounded audit trail, newest event first. */
  history() {
    return this.events.map(event => structuredClone(event))
  }

  /** Restore previously recorded local audit entries without replaying them. */
  replaceHistory(events) {
    this.events = Array.isArray(events) ? events.slice(0, this.historyLimit).map(event => structuredClone(event)) : []
  }

  /** Record an operator request without claiming that Signal K accepted a state change. */
  recordOperatorAction(action, record) {
    this.recordEvent('action_requested', record, { action }, true)
  }

  upsert(notification) {
    const value = notification.value || {}
    const id = value.id || notification.id || notification.path
    if (!id) return

    const historyKey = `${notification.path || ''}|${notification.source?.label || ''}`
    let previous = this.records.get(id) || findUnidentifiedContinuation(this.records, id, historyKey)
    const lifecycleEnded = this.endsLifecycle(this.lifecycleRules, {
      path: notification.path || '', source: notification.source || null,
      state: value.state || 'unknown', message: value.message || ''
    })
    if (previous?.lifecycleEnded && !lifecycleEnded) previous = null
    if (previous && previous.id !== id) this.records.delete(previous.id)
    const record = {
      id,
      path: notification.path || '',
      source: notification.source || null,
      state: value.state || 'unknown',
      message: value.message || '',
      method: Array.isArray(value.method) ? [...value.method] : [],
      createdAt: value.createdAt || null,
      position: value.position || null,
      data: value.data || null,
      status: value.status ? { ...value.status } : null,
      occurrenceId: previous?.occurrenceId || createOccurrenceId(),
      firstSeenAt: previous?.firstSeenAt || new Date().toISOString(),
      lastUpdatedAt: previous?.lastUpdatedAt || new Date().toISOString()
    }
    record.category = this.classify(record)
    record.historyKey = historyKey
    record.lifecycleEnded = lifecycleEnded
    const changed = !previous || notificationChanged(previous, record)
    const historyChanged = !previous || historyRelevantChanged(previous, record)
    if (changed) record.lastUpdatedAt = new Date().toISOString()
    const eventType = previous ? 'updated' : 'raised'
    this.records.set(id, record)
    if (historyChanged) {
      this.recordEvent(eventType, record)
    }
  }

  removeByPath(path) {
    for (const [id, record] of this.records) {
      if (record.path === path) {
        this.records.delete(id)
        this.recordEvent('cleared', record)
      }
    }
  }

  /** Keep a small in-memory audit trail; persistence is a later explicit step. */
  recordEvent(type, record, extra = {}, force = false) {
    const event = { type, at: new Date().toISOString(), ...extra, notification: structuredClone(record) }
    this.onChange(structuredClone(event))
    if (!force && !this.shouldRecord(record)) return
    this.events.unshift(event)
    this.events.length = Math.min(this.events.length, this.historyLimit)
    this.onEvent(structuredClone(event))
  }
}

function findUnidentifiedContinuation(records, id, historyKey) {
  let match = null
  for (const record of records.values()) {
    if (record.id !== id && record.historyKey === historyKey) {
      if (match) return null
      match = record
    }
  }
  return match
}

function createOccurrenceId() {
  return `occurrence-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function historyRelevantChanged(previous, next) {
  return JSON.stringify({
    path: previous.path, source: previous.source, state: previous.state,
    message: previous.message, method: previous.method, status: previous.status
  }) !== JSON.stringify({
    path: next.path, source: next.source, state: next.state,
    message: next.message, method: next.method, status: next.status
  })
}

/** Compare authoritative fields only; timestamps from polling must not be audit events. */
function notificationChanged(previous, next) {
  return JSON.stringify({
    path: previous.path, source: previous.source, state: previous.state,
    message: previous.message, method: previous.method, createdAt: previous.createdAt,
    position: previous.position, data: previous.data, status: previous.status
  }) !== JSON.stringify({
    path: next.path, source: next.source, state: next.state,
    message: next.message, method: next.method, createdAt: next.createdAt,
    position: next.position, data: next.data, status: next.status
  })
}

module.exports = NotificationStore
