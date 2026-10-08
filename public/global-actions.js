'use strict'

;(function exposeGlobalActions(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.NotificationGlobalActions = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  /**
   * Decide whether a global action currently has an eligible target.
   *
   * Silence is additionally constrained to unfinished local audio work. This
   * keeps a completed one-shot sound from leaving a misleading global control
   * on screen while preserving Signal K as the permission authority.
   *
   * @param {Array<object>} notifications Current Notification Engine records.
   * @param {'silence'|'acknowledge'} action Global action name.
   * @returns {boolean} Whether the control should be presented.
   */
  function hasGlobalActionTarget(notifications, action) {
    return (notifications || []).some(notification => {
      if (!actionPermittedBySignalK(notification, action)) return false
      return action !== 'silence' || notification.audioActionable === true
    })
  }

  function actionPermittedBySignalK(notification, action) {
    const status = notification?.status
    if (!status) return false
    if (action === 'silence') return notification.state !== 'emergency' && status.canSilence === true && status.silenced !== true
    if (action === 'acknowledge') return status.canAcknowledge === true && status.acknowledged !== true
    return false
  }

  return { hasGlobalActionTarget }
})
