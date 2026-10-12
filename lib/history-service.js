'use strict'

const HistoryRepository = require('./history-repository')
const { normalizeClearPath } = require('./configuration-service')

/**
 * Own local audit persistence and pruning without changing Signal K state.
 * Deleting or filtering here affects only Notification Engine history.
 */
class HistoryService {
  constructor({ directory, store, resolvePolicy, onError = () => {}, now = () => Date.now() }) {
    this.directory = directory
    this.store = store
    this.resolvePolicy = resolvePolicy
    this.onError = onError
    this.now = now
    this.repository = null
    this.rules = []
    this.options = {}
  }

  /** Configure a fresh bounded repository for one plugin lifecycle. */
  configure(options = {}) {
    const limit = Number.isInteger(options.historyLimit) ? Math.max(50, Math.min(5000, options.historyLimit)) : 500
    this.rules = Array.isArray(options.historyRules) ? options.historyRules : []
    this.options = {
      retentionDays: Number.isInteger(options.historyRetentionDays) ? Math.max(0, Math.min(3650, options.historyRetentionDays)) : 0,
      includeTestNotifications: options.testNotificationEnabled === true
    }
    const directory = typeof this.directory === 'function' ? this.directory() : this.directory
    this.repository = new HistoryRepository(directory, { limit, onError: this.onError })
  }

  /** Update rule-derived recording policy after a valid Node-RED deploy. */
  setRules(rules) {
    this.rules = Array.isArray(rules) ? rules : []
  }

  /** Decide whether one local audit transition should be retained. */
  shouldRecord(notification) {
    const policy = this.resolvePolicy(notification)
    if (typeof policy.history === 'boolean') return policy.history
    const rule = this.rules.find(candidate =>
      (!candidate.pathPrefix || String(notification.path || '').toLowerCase().startsWith(candidate.pathPrefix)) &&
      (!candidate.source || candidate.source === notification.source?.label)
    )
    if (rule) return rule.history
    // The active table is the operator-facing default scope for the local
    // audit. An explicit history flag above may deliberately override it,
    // but an implicitly visible notification must not disappear from History.
    return policy.visible === true
  }

  /** Load, prune, and install persisted local audit entries for startup. */
  async initialize() {
    if (!this.repository) return { lastAudioTest: null }
    const events = await this.repository.load()
    this.store.replaceHistory(events)
    const lastAudioTest = this.store.history().find(event => event.audioTest)?.audioTest || null
    if (!this.options.includeTestNotifications) {
      await this.repository.prune(event => event.notification?.data?.notificationManagerTest === true)
    }
    if (this.options.retentionDays > 0) {
      await this.repository.pruneBefore(this.now() - this.options.retentionDays * 86400000)
    }
    this.store.replaceHistory(this.repository.events)
    return { lastAudioTest }
  }

  /** Append one local audit event; this never calls a Signal K action. */
  append(event) {
    this.repository?.append(event)
  }

  /** Delete only local audit entries selected by the WebApp query. */
  async clear(query = {}) {
    if (!this.repository) return false
    const pathPrefix = normalizeClearPath(query.path)
    const occurrenceId = String(query.occurrenceId || '')
    if (occurrenceId) await this.repository.prune(event => event.notification?.occurrenceId === occurrenceId)
    else if (pathPrefix) await this.repository.prune(event => String(event.notification?.path || '').toLowerCase().startsWith(pathPrefix))
    else await this.repository.clear()
    this.store.replaceHistory(this.repository.events)
    return true
  }

  /** Return persistence health without exposing mutable repository state. */
  status() {
    return this.repository?.status() || { available: false, eventCount: 0, lastWriteAt: null, lastError: null }
  }

  /** Finish queued writes and release the lifecycle repository. */
  async stop() {
    await this.repository?.flush()
    this.repository = null
  }
}

module.exports = HistoryService
