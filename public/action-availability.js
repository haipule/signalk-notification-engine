'use strict'

;(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.NotificationActionAvailability = api
})(typeof window !== 'undefined' ? window : globalThis, function build() {
  /** Return whether Signal K currently permits this notification action. */
  function sourceAllowsAction(notification, action) {
    if (notification?.historyOnly) return false
    const status = notification?.status
    if (!status) return false
    if (action === 'silence') return notification.state !== 'emergency' && status.canSilence === true && status.silenced !== true
    if (action === 'acknowledge') return status.canAcknowledge === true && status.acknowledged !== true
    if (action === 'clear') return !['normal', 'nominal'].includes(notification.state) && status.canClear === true
    return false
  }

  /**
   * Separate Signal K action applicability from the current browser's ability
   * to submit it. Read-only users must still see applicable disabled actions.
   */
  function notificationActionState(notification, action, context = {}) {
    const applicable = sourceAllowsAction(notification, action)
    if (!context.connected || !context.configurationReady) return { applicable, enabled: false, reason: 'unavailable' }
    if (!applicable) return { applicable: false, enabled: false, reason: 'source' }
    if (!context.writeAuthorized) return { applicable: true, enabled: false, reason: 'write_permission' }
    return { applicable: true, enabled: true, reason: null }
  }

  return { sourceAllowsAction, notificationActionState }
})
