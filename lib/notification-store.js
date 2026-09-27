'use strict'

const { normalizeSource } = require('./notification-source')

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
    this.recordedOccurrences = new Set()
  }

  get size() {
    return this.records.size
  }

  clear() {
    this.records.clear()
    this.events = []
    this.recordedOccurrences.clear()
  }

  /** Merge an authoritative `app.notifications.list()` snapshot into the cache. */
  replaceSnapshot(snapshot) {
    for (const [id, notification] of Object.entries(snapshot || {})) {
      this.upsert({ id, ...notification })
    }
  }

  /** Apply every notification value found in a standard Signal K delta. */
  applyDelta(delta, resolveSource = () => null) {
    for (const update of delta?.updates || []) {
      for (const item of update.values || []) {
        if (!String(item.path || '').startsWith('notifications.')) continue
        if (item.value === null) {
          this.removeByPath(item.path)
          continue
        }
        this.upsert({
          path: item.path,
          // Prefer the producer source carried in the notification payload
          // over the handler/source of the enclosing delta.
          source: normalizeSource(resolveSource(item.path) || item.value?.data?.source || item.value?.source || item.value?.$source || item.source || item.$source || update.source || update.$source),
          value: item.value
        })
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

  /** Apply a producer source learned from the corresponding data-model path. */
  setSourceForPath(path, source) {
    const notificationPath = `notifications.${String(path || '').replace(/^notifications\./, '')}`
    const normalized = normalizeSource(source)
    if (!normalized) return
    for (const record of this.records.values()) {
      if (record.path !== notificationPath) continue
      record.source = normalized
      record.historyKey = `${record.path}|${normalized.label}`
      record.category = this.classify(record)
    }
  }

  /** Return the bounded audit trail, newest event first. */
  history() {
    return this.events.map(event => structuredClone(event))
  }

  /** Restore previously recorded local audit entries without replaying them. */
  replaceHistory(events) {
    this.events = Array.isArray(events) ? events.slice(0, this.historyLimit).map(event => structuredClone(event)) : []
    this.recordedOccurrences = new Set(this.events.map(event => event.notification?.occurrenceId).filter(Boolean))
  }

  /** Record an operator request without claiming that Signal K accepted a state change. */
  recordOperatorAction(action, record) {
    this.recordEvent('action_requested', record, { action }, true)
  }

  upsert(notification) {
    const value = notification.value || {}
    const id = value.id || notification.id || notification.path
    if (!id) return

    const incomingSource = normalizeSource(notification.source)
    const historyKey = `${notification.path || ''}|${incomingSource?.label || ''}`
    let previous = this.records.get(id) || findUnidentifiedContinuation(this.records, id, historyKey)
    // Signal K's API/data-model projections do not all carry the producer
    // source. A later source-less snapshot must not erase the source learned
    // from an earlier delta or data-model view for the same notification.
    const source = incomingSource || previous?.source || null
    const lifecycleEnded = this.endsLifecycle(this.lifecycleRules, {
      path: notification.path || '', source,
      state: value.state || 'unknown', message: value.message || ''
    })
    if (previous?.lifecycleEnded && !lifecycleEnded) previous = null
    if (previous && previous.id !== id) this.records.delete(previous.id)
    const record = {
      id,
      path: notification.path || '',
      source,
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
      // Once an occurrence enters the audit trail, retain its authoritative
      // resolution even when the terminal state itself is hidden by policy.
      this.recordEvent(eventType, record, {}, Boolean(previous && this.recordedOccurrences.has(previous.occurrenceId)))
    }
  }

  removeByPath(path) {
    for (const [id, record] of this.records) {
      if (record.path === path) {
        this.records.delete(id)
        this.recordEvent('cleared', record, {}, this.recordedOccurrences.has(record.occurrenceId))
      }
    }
  }

  /** Keep a small in-memory audit trail; persistence is a later explicit step. */
  recordEvent(type, record, extra = {}, force = false) {
    const event = { type, at: new Date().toISOString(), ...extra, notification: structuredClone(record) }
    this.onChange(structuredClone(event))
    if (!force && !this.shouldRecord(record)) return
    this.events.unshift(event)
    if (record.occurrenceId) this.recordedOccurrences.add(record.occurrenceId)
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
