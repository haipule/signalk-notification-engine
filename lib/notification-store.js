'use strict'

const { normalizeSource, preferNotificationSource } = require('./notification-source')

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
    this.restoredOccurrences = new Map()
  }

  get size() {
    return this.records.size
  }

  clear() {
    this.records.clear()
    this.events = []
    this.recordedOccurrences.clear()
    this.restoredOccurrences.clear()
  }

  /**
   * Stage exact pre-restart records for one-time correlation with the next
   * authoritative snapshot. A mismatch cannot inherit an occurrence ID.
   */
  restoreExactOccurrences(records) {
    this.restoredOccurrences.clear()
    for (const record of Array.isArray(records) ? records : []) {
      if (!record?.occurrenceId || !record?.id || !record?.path) continue
      this.restoredOccurrences.set(exactNotificationKey(record), structuredClone(record))
    }
  }

  /** Return the minimal authoritative fields needed for exact restart matching. */
  restartSnapshot() {
    return [...this.records.values()].map(record => ({
      id: record.id,
      path: record.path,
      source: record.source,
      state: record.state,
      message: record.message,
      method: record.method,
      createdAt: record.createdAt,
      data: record.data,
      status: record.status,
      occurrenceId: record.occurrenceId,
      firstSeenAt: record.firstSeenAt,
      lifecycleEnded: record.lifecycleEnded,
      localLifecycleEnded: record.localLifecycleEnded
    }))
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

  /**
   * Record a local policy transition without replaying it into notification
   * processing. These audit entries never claim a Signal K state change.
   */
  recordLocalAuditEvent(type, record, extra = {}) {
    const event = { type, at: new Date().toISOString(), ...extra, notification: structuredClone(record) }
    this.events.unshift(event)
    if (record?.occurrenceId) this.recordedOccurrences.add(record.occurrenceId)
    this.events.length = Math.min(this.events.length, this.historyLimit)
    this.onEvent(structuredClone(event))
  }

  /**
   * End matching local occurrences without changing or removing their
   * producer-owned Signal K notifications. Repeated boundary inputs are
   * idempotent; the next authoritative update starts a fresh occurrence.
   */
  endLocalOccurrences({ path, source, reason, inputPath, inputValue }) {
    let ended = 0
    for (const record of this.records.values()) {
      if (record.path !== path || (source && record.source?.label !== source) || record.localLifecycleEnded) continue
      record.localLifecycleEnded = true
      ended += 1
      this.onChange({ type: 'local_lifecycle_ended', notification: structuredClone(record) })
      this.recordLocalAuditEvent('local_lifecycle_ended', record, { reason, inputPath, inputValue })
    }
    return ended
  }

  /** Arm a fresh local occurrence after an authoritative boundary is released. */
  releaseLocalOccurrenceBoundary({ path, source }) {
    let released = 0
    for (const record of this.records.values()) {
      if (record.path !== path || (source && record.source?.label !== source) || !record.localLifecycleEnded) continue
      record.localLifecycleEnded = false
      record.freshOccurrencePending = true
      released += 1
    }
    return released
  }

  upsert(notification) {
    const value = notification.value || {}
    const id = value.id || notification.id || notification.path
    if (!id) return

    const incomingSource = normalizeSource(notification.source)
    const incomingHistoryKey = `${notification.path || ''}|${incomingSource?.label || ''}`
    let previous = this.records.get(id) || findUnidentifiedContinuation(this.records, id, incomingHistoryKey)
    // Signal K's API/data-model projections do not all carry the producer
    // source. A later source-less snapshot must not erase the source learned
    // from an earlier delta or data-model view for the same notification.
    const source = preferNotificationSource(incomingSource, previous?.source)
    if (!previous) {
      const restoredKey = exactNotificationKey({
        id, path: notification.path || '', source,
        state: value.state || 'unknown', message: value.message || '',
        method: Array.isArray(value.method) ? value.method : [],
        createdAt: value.createdAt || null, data: value.data || null,
        status: value.status ? { ...value.status } : null
      })
      previous = this.restoredOccurrences.get(restoredKey) || null
      if (previous) this.restoredOccurrences.delete(restoredKey)
    }
    const historyKey = `${notification.path || ''}|${source?.label || ''}`
    const lifecycleEnded = this.endsLifecycle(this.lifecycleRules, {
      path: notification.path || '', source,
      state: value.state || 'unknown', message: value.message || ''
    })
    if ((previous?.lifecycleEnded && !lifecycleEnded) || previous?.freshOccurrencePending) previous = null
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
    record.localLifecycleEnded = previous?.localLifecycleEnded === true
    record.freshOccurrencePending = false
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

function exactNotificationKey(record) {
  return stableStringify({
    id: record.id,
    path: record.path || '',
    source: normalizeSource(record.source),
    state: record.state || 'unknown',
    message: record.message || '',
    method: Array.isArray(record.method) ? record.method : [],
    createdAt: record.createdAt || null,
    data: record.data || null,
    status: record.status || null
  })
}

/** Compare JSON-shaped authoritative fields independent of object key order. */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
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
