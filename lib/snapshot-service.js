'use strict'

const { fromDataModel, mergeSnapshots } = require('./notification-snapshot')
const { normalizeSource } = require('./notification-source')

/**
 * Reconstruct and follow Signal K notifications without owning their lifecycle.
 * Every record remains sourced from Signal K snapshots or deltas; this service
 * only feeds the local cache and never raises, clears, or modifies an alarm.
 */
class SnapshotService {
  constructor({ app, store, diagnostics, includeTestNotifications = () => false, intervalMs = 5000, fetchImpl = globalThis.fetch, setIntervalFn = setInterval, clearIntervalFn = clearInterval }) {
    this.app = app
    this.store = store
    this.diagnostics = diagnostics
    this.includeTestNotifications = includeTestNotifications
    this.intervalMs = intervalMs
    this.fetch = fetchImpl
    this.setInterval = setIntervalFn
    this.clearInterval = clearIntervalFn
    this.originalSources = new Map()
    this.unsubscribes = []
    this.timer = null
  }

  /** Read and merge the supported read-only Signal K notification views. */
  async read() {
    let apiNotifications = {}
    try {
      apiNotifications = await this.readNotificationsApi()
    } catch (error) {
      this.app.error?.(`Unable to read Signal K notifications API: ${error.message}`)
    }

    try {
      const managed = typeof this.app.notifications?.list === 'function' ? this.app.notifications.list() : {}
      const selfNotifications = typeof this.app.getSelfPath === 'function'
        ? fromDataModel(this.app.getSelfPath('notifications'))
        : {}
      const fullModelNotifications = typeof this.app.getPath === 'function'
        ? fromDataModel(this.app.getPath('vessels.self.notifications'))
        : {}
      const snapshot = mergeSnapshots(selfNotifications, fullModelNotifications, apiNotifications, managed)
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
      return apiNotifications
    }
  }

  /** Replace the cache from Signal K and record observational timing only. */
  async sync() {
    const finish = this.diagnostics.beginSnapshot()
    try {
      this.store.replaceSnapshot(await this.read())
      finish()
    } catch (error) {
      finish(error)
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
    this.timer = this.setInterval(() => { void this.sync() }, this.intervalMs)
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
    this.stopSubscription()
    this.stopPolling()
    this.originalSources.clear()
  }

  async readNotificationsApi() {
    if (typeof this.fetch !== 'function') return {}
    const port = this.app.config?.settings?.port || 3000
    const response = await this.fetch(`http://127.0.0.1:${port}/signalk/v1/api/vessels/self/notifications`)
    if (!response.ok) throw new Error(`notification API returned HTTP ${response.status}`)
    return fromDataModel(await response.json())
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
