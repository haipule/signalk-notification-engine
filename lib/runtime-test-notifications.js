'use strict'

const ALLOWED_STATES = new Set(['warn', 'alert', 'alarm', 'emergency', 'normal'])
const SLOT_PATTERN = /^[a-z][a-z0-9-]{0,15}$/
const PATH_PREFIX = 'notifications.system.notificationEngine.runtimeTest'

/** Owns bounded runtime test notifications without touching foreign alarms. */
class RuntimeTestNotifications {
  /** @param {{notifications?: object}} app Signal K plugin API. */
  constructor(app) {
    this.notifications = app.notifications
    this.onError = message => app.error?.(message)
    this.slots = new Map()
  }

  /** Return copies of the currently owned test slots. */
  list() {
    return [...this.slots.values()].map(entry => this.#public(entry))
  }

  /** Raise one bounded test notification in a fixed plugin-owned slot. */
  raise(slot, options = {}) {
    this.#validateSlot(slot)
    if (this.slots.has(slot)) throw new Error(`Runtime test slot ${slot} is already active`)
    if (typeof this.notifications?.raise !== 'function') throw new Error('Signal K notification raise API unavailable')
    const state = this.#validateState(options.state || 'warn', false)
    const runtimeSeconds = Number.isInteger(options.runtimeSeconds) ? Math.max(10, Math.min(600, options.runtimeSeconds)) : 120
    const path = `${PATH_PREFIX}.${slot}`
    const message = String(options.message || `Notification Engine runtime test ${slot}`).slice(0, 160)
    const id = this.notifications.raise({
      state,
      message,
      path,
      includeCreatedAt: true,
      data: { notificationEngineRuntimeTest: true, runtimeTestSlot: slot, source: 'Notification Engine Runtime Test' }
    })
    const expiresAt = new Date(Date.now() + runtimeSeconds * 1000).toISOString()
    const timer = setTimeout(() => {
      void this.clear(slot).catch(error => this.onError(`Unable to expire runtime test slot ${slot}: ${error.message}`))
    }, runtimeSeconds * 1000)
    timer.unref?.()
    const entry = { slot, id, path, state, message, runtimeSeconds, expiresAt, timer }
    this.slots.set(slot, entry)
    return this.#public(entry)
  }

  /** Update only a currently owned slot. */
  update(slot, options = {}) {
    const entry = this.#get(slot)
    if (typeof this.notifications?.update !== 'function') throw new Error('Signal K notification update API unavailable')
    const state = this.#validateState(options.state, true)
    const message = options.message === undefined ? entry.message : String(options.message).slice(0, 160)
    this.notifications.update(entry.id, { state, message })
    entry.state = state
    entry.message = message
    return this.#public(entry)
  }

  /** Clear only a currently owned slot. */
  async clear(slot) {
    this.#validateSlot(slot)
    const entry = this.slots.get(slot)
    if (!entry) return false
    if (typeof this.notifications?.clear !== 'function') throw new Error('Signal K notification clear API unavailable')
    clearTimeout(entry.timer)
    try {
      await this.notifications.clear(entry.id)
    } catch (error) {
      // Signal K removes notifications updated to normal from its manager.
      // "Not found" therefore means the exact owned id is already gone and
      // local cleanup is complete; every other clear failure remains visible.
      if (!/not found/i.test(String(error?.message || ''))) throw error
    }
    this.slots.delete(slot)
    return true
  }

  /** Clear every notification owned by this runtime instance. */
  async clearAll() {
    const results = await Promise.allSettled([...this.slots.keys()].map(slot => this.clear(slot)))
    const failure = results.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
  }

  /** Remove stale marked tests left by an unclean previous plugin process. */
  async clearStale() {
    if (typeof this.notifications?.list !== 'function' || typeof this.notifications?.clear !== 'function') return 0
    const snapshot = this.notifications.list() || {}
    const staleIds = Object.entries(snapshot)
      .filter(([, notification]) => String(notification?.path || '').startsWith(`${PATH_PREFIX}.`) && notification?.data?.notificationEngineRuntimeTest === true)
      .map(([id]) => id)
    await Promise.all(staleIds.map(id => this.notifications.clear(id)))
    return staleIds.length
  }

  #public({ timer, ...entry }) { return { ...entry } }

  #get(slot) {
    this.#validateSlot(slot)
    const entry = this.slots.get(slot)
    if (!entry) throw new Error(`Runtime test slot ${slot} is not active`)
    return entry
  }

  #validateSlot(slot) {
    if (!SLOT_PATTERN.test(String(slot || ''))) throw new Error('Runtime test slot must match [a-z][a-z0-9-]{0,15}')
  }

  #validateState(state, allowNormal) {
    if (!ALLOWED_STATES.has(state) || (!allowNormal && state === 'normal')) throw new Error(`Unsupported runtime test state: ${state}`)
    return state
  }
}

module.exports = { RuntimeTestNotifications, PATH_PREFIX }
