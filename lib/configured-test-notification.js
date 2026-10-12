'use strict'

/**
 * Run the one-shot test notification requested through Signal K Plugin Config.
 * The helper owns only the id returned by Signal K and never clears a foreign
 * notification. Configuration is reset only after the owned notification has
 * completed its configured visible lifetime and has been cleared.
 */
class ConfiguredTestNotification {
  constructor({ notifications, onComplete = () => {}, debug = () => {}, error = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
    this.notifications = notifications
    this.onComplete = onComplete
    this.debug = debug
    this.error = error
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.id = null
    this.timer = null
  }

  /** Raise one bounded, clearly marked notification and schedule its cleanup. */
  start(configuration, context) {
    if (!configuration?.enabled || typeof this.notifications?.raise !== 'function') return false
    const state = ['warn', 'alert', 'alarm', 'emergency'].includes(configuration.state) ? configuration.state : 'warn'
    const runtimeSeconds = Number.isInteger(configuration.runtimeSeconds)
      ? Math.max(1, Math.min(3600, configuration.runtimeSeconds))
      : 30
    try {
      this.id = this.notifications.raise({
        state,
        message: String(configuration.message || 'Notification Engine test'),
        path: String(configuration.path || 'notifications.notification-engine-test'),
        includePosition: configuration.includePosition === true,
        includeCreatedAt: configuration.includeCreatedAt !== false,
        data: { notificationManagerTest: true, source: 'Notification Engine Test' }
      })
      this.timer = this.setTimer(() => { void this.expire(configuration, context) }, runtimeSeconds * 1000)
      this.debug(`Notification Engine config test raised id=${this.id}, runtime=${runtimeSeconds}s`)
      return true
    } catch (failure) {
      this.id = null
      this.error(`Unable to raise Notification Engine config test: ${failure.message}`)
      return false
    }
  }

  /** Clear the owned notification after its lifetime, then reset its one-shot configuration. */
  async expire(configuration, context) {
    this.timer = null
    const cleared = await this.clearOwned()
    if (cleared) this.onComplete(configuration, context)
  }

  /** Stop a pending test during plugin shutdown without resetting the request. */
  async stop() {
    if (this.timer !== null) {
      this.clearTimer(this.timer)
      this.timer = null
    }
    return this.clearOwned()
  }

  /** Clear only the id returned for this helper's own raise call. */
  async clearOwned() {
    if (!this.id) return true
    const id = this.id
    this.id = null
    try {
      if (typeof this.notifications?.clear !== 'function') throw new Error('Signal K notification clear API unavailable')
      await this.notifications.clear(id)
      this.debug(`Notification Engine config test cleared id=${id}`)
      return true
    } catch (failure) {
      if (/alarm not found/i.test(failure.message)) return true
      this.id = id
      this.error(`Unable to clear Notification Engine config test id=${id}: ${failure.message}`)
      return false
    }
  }
}

/** Hide only this plugin's completed configuration test from its active view. */
function isVisibleInActiveView(notification, enabled) {
  return enabled === true || notification?.data?.notificationManagerTest !== true
}

ConfiguredTestNotification.isVisibleInActiveView = isVisibleInActiveView
module.exports = ConfiguredTestNotification
