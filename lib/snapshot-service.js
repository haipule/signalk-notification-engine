'use strict'

const { fromDataModel, mergeSnapshots } = require('./notification-snapshot')
const { normalizeSource } = require('./notification-source')

/**
 * Reconstruct and follow Signal K notifications without owning their lifecycle.
 * Every record remains sourced from Signal K snapshots or deltas; this service
 * only feeds the local cache and never raises, clears, or modifies an alarm.
 */
class SnapshotService {
  constructor({
    app,
    store,
    diagnostics,
    includeTestNotifications = () => false,
    intervalMs = 5000,
    requestTimeoutMs = 15000,
    fetchImpl = globalThis.fetch,
    AbortControllerClass = globalThis.AbortController,
    setIntervalFn = setInterval,
    clearIntervalFn = clearInterval,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout
  }) {
    this.app = app
    this.store = store
    this.diagnostics = diagnostics
    this.includeTestNotifications = includeTestNotifications
    this.intervalMs = intervalMs
    this.requestTimeoutMs = requestTimeoutMs
    this.fetch = fetchImpl
    this.AbortController = AbortControllerClass
    this.setInterval = setIntervalFn
    this.clearInterval = clearIntervalFn
    this.setTimeout = setTimeoutFn
    this.clearTimeout = clearTimeoutFn
    this.originalSources = new Map()
    this.unsubscribes = []
    this.timer = null
    this.activeSync = null
    this.pendingSync = false
    this.activeAbortController = null
    this.stopped = false
    this.generation = 0
  }

  /** Read and merge the supported read-only Signal K notification views. */
  async read() {
    let apiNotifications = {}
    try {
      apiNotifications = await this.readNotificationsApi()
    } catch (error) {
      if (this.stopped) throw error
      this.app.error?.(`Unable to read Signal K notifications API: ${error.message}`)
      if (error.code === 'SNAPSHOT_TIMEOUT') throw error
    }

    let managed = {}
    try {
      managed = typeof this.app.notifications?.list === 'function' ? this.app.notifications.list() : {}
    } catch (error) {
      // Lifecycle actions address the manager by notification ID. A readable
      // data-model projection is not proof that the manager still owns that
      // ID, so failure to read this list must disable actions, not guess.
      this.app.error?.(`Unable to read Signal K managed notifications: ${error.message}`)
    }

    try {
      const selfNotifications = typeof this.app.getSelfPath === 'function'
        ? fromDataModel(this.app.getSelfPath('notifications'))
        : {}
      const fullModelNotifications = typeof this.app.getPath === 'function'
        ? fromDataModel(this.app.getPath('vessels.self.notifications'))
        : {}
      const snapshot = mergeSnapshots(selfNotifications, fullModelNotifications, apiNotifications, managed)
      this.markManagedActions(snapshot, managed)
      this.enrichOriginalSources(snapshot)
      if (!this.includeTestNotifications()) {
        for (const [id, notification] of Object.entries(snapshot)) {
          if (notification.value?.data?.notificationManagerTest === true) delete snapshot[id]
        }
      }
      return snapshot
    } catch (error) {
      // An optional in-process projection must not discard an independently
      // obtained official API snapshot.
      this.app.error?.(`Unable to read in-process notification snapshot: ${error.message}`)
      this.markManagedActions(apiNotifications, managed)
      return apiNotifications
    }
  }

  /**
   * Mark whether Signal K's live Notification API manager can address each ID.
   *
   * Signal K may retain a normal notification in the data model after removing
   * it from the manager. Its copied capability flags are then observationally
   * stale and must not create an action that can only fail with Alarm not found.
   */
  markManagedActions(snapshot, managed) {
    const managedIds = new Set(Object.keys(managed || {}))
    for (const [id, notification] of Object.entries(snapshot || {})) {
      notification.actionManaged = managedIds.has(id)
    }
  }

  /**
   * Serialize cache reconciliation and retain at most one requested follow-up.
   * Delta ingestion stays independent and continues while a snapshot is slow.
   */
  async sync() {
    if (this.stopped) return false
    if (this.activeSync) {
      this.pendingSync = true
      this.diagnostics.recordSnapshotCoalesced()
      return this.activeSync
    }

    this.activeSync = this.drainSyncRequests()
    try {
      return await this.activeSync
    } finally {
      this.activeSync = null
    }
  }

  /** Run the active snapshot and any single coalesced follow-up serially. */
  async drainSyncRequests() {
    let finalError = null
    let completed = false
    do {
      this.pendingSync = false
      this.diagnostics.setSnapshotPending(false)
      try {
        completed = await this.performSync() || completed
        finalError = null
      } catch (error) {
        finalError = error
      }
    } while (!this.stopped && this.pendingSync)

    if (finalError) throw finalError
    return completed
  }

  /** Replace the cache only while this service lifecycle is still current. */
  async performSync() {
    const generation = this.generation
    const finish = this.diagnostics.beginSnapshot()
    try {
      const snapshot = await this.read()
      if (this.stopped || generation !== this.generation) return false
      this.store.replaceSnapshot(snapshot)
      finish()
      return true
    } catch (error) {
      if (this.stopped || generation !== this.generation) return false
      finish(error, { timedOut: error.code === 'SNAPSHOT_TIMEOUT' })
      throw error
    }
  }

  /** Subscribe to notification deltas and their mirrored producer paths. */
  subscribe() {
    this.stopSubscription()
    if (!this.app.subscriptionmanager?.subscribe) {
      this.app.error?.('Signal K subscription manager is unavailable; notification updates will not be observed')
      return
    }
    const mirroredPaths = [...new Set(this.store.list()
      .map(notification => String(notification.path || '').replace(/^notifications\./, ''))
      .filter(Boolean))]
    this.app.subscriptionmanager.subscribe(
      { context: '*', sourcePolicy: 'all', subscribe: [{ path: 'notifications.*' }, ...mirroredPaths.map(path => ({ path }))] },
      this.unsubscribes,
      error => this.app.error?.(`Notification subscription error: ${error}`),
      delta => this.applyDelta(delta)
    )
  }

  /** Start periodic reconciliation for producer/server startup ordering gaps. */
  startPolling() {
    this.stopPolling()
    this.timer = this.setInterval(() => {
      void this.sync().catch(error => this.app.error?.(`Unable to reconcile notification snapshot: ${error.message}`))
    }, this.intervalMs)
  }

  /** Stop periodic reconciliation without changing cached notification state. */
  stopPolling() {
    if (this.timer === null) return
    this.clearInterval(this.timer)
    this.timer = null
  }

  /** Stop only the notification subscription owned by this service. */
  stopSubscription() {
    for (const unsubscribe of this.unsubscribes) unsubscribe()
    this.unsubscribes = []
  }

  /** Stop all service activity while retaining the store for diagnostics. */
  stop() {
    this.stopped = true
    this.generation += 1
    this.pendingSync = false
    this.diagnostics.cancelSnapshot()
    this.activeAbortController?.abort()
    this.activeAbortController = null
    this.stopSubscription()
    this.stopPolling()
    this.originalSources.clear()
  }

  /** Begin a new service lifecycle after a prior stop. */
  start() {
    this.stopped = false
  }

  /** Read the official API projection with a bounded loopback deadline. */
  async readNotificationsApi() {
    if (typeof this.fetch !== 'function') return {}
    const port = this.app.config?.settings?.port || 3000
    const controller = new this.AbortController()
    let timedOut = false
    const timer = this.setTimeout(() => {
      timedOut = true
      controller.abort()
    }, this.requestTimeoutMs)
    this.activeAbortController = controller
    try {
      const response = await this.fetch(`http://127.0.0.1:${port}/signalk/v1/api/vessels/self/notifications`, { signal: controller.signal })
      if (!response.ok) throw new Error(`notification API returned HTTP ${response.status}`)
      return fromDataModel(await response.json())
    } catch (error) {
      if (!timedOut) throw error
      const timeoutError = new Error(`notification API timed out after ${this.requestTimeoutMs} ms`)
      timeoutError.code = 'SNAPSHOT_TIMEOUT'
      throw timeoutError
    } finally {
      this.clearTimeout(timer)
      if (this.activeAbortController === controller) this.activeAbortController = null
    }
  }

  applyDelta(delta) {
    this.diagnostics.recordDelta()
    this.logDelta(delta)
    for (const update of delta?.updates || []) {
      for (const item of update.values || []) {
        if (String(item.path || '').startsWith('notifications.')) continue
        const source = normalizeSource(update.source || update.$source || item.source || item.$source)
        if (!source) continue
        this.originalSources.set(item.path, source)
        this.store.setSourceForPath(item.path, source)
      }
    }
    this.store.applyDelta(delta, path => {
      const dataPath = String(path || '').replace(/^notifications\./, '')
      return this.originalSources.get(dataPath) || this.readOriginalSource(path)
    })
  }

  enrichOriginalSources(snapshot) {
    for (const notification of Object.values(snapshot || {})) {
      const dataPath = String(notification.path || '').replace(/^notifications\./, '')
      const source = this.originalSources.get(dataPath) || this.readOriginalSource(notification.path)
      if (source) notification.source = source
    }
  }

  readOriginalSource(notificationPath) {
    const dataPath = String(notificationPath || '').replace(/^notifications\./, '')
    if (!dataPath) return null
    const candidates = []
    if (typeof this.app.getSelfPath === 'function') candidates.push(this.app.getSelfPath(dataPath))
    if (typeof this.app.getPath === 'function') candidates.push(this.app.getPath(`vessels.self.${dataPath}`))
    for (const value of candidates) {
      const source = normalizeSource(value?.$source || value?.source || value?.value?.$source || value?.value?.source)
      if (source) return source
    }
    return null
  }

  logDelta(delta) {
    const changes = []
    for (const update of delta?.updates || []) {
      for (const item of update.values || []) {
        if (!String(item.path || '').startsWith('notifications.')) continue
        const value = item.value
        changes.push({
          path: item.path,
          source: update.source?.label || update.source?.type || '',
          id: value?.id || null,
          state: value?.state || null,
          acknowledged: value?.status?.acknowledged ?? null,
          value: value === null ? null : undefined
        })
      }
    }
    if (changes.length > 0) this.app.debug?.(`Notification delta: ${JSON.stringify(changes)}`)
  }
}

module.exports = SnapshotService
