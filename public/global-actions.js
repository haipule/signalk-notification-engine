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
   * @param {Array<object>} notifications Records visible in the current table.
   * @param {'silence'|'acknowledge'} action Global action name.
   * @returns {boolean} Whether the control should be presented.
   */
  function hasGlobalActionTarget(notifications, action) {
    return globalActionTargetIds(notifications, action).length > 0
  }

  /** Return the exact visible record IDs eligible for a bulk action. */
  function globalActionTargetIds(notifications, action) {
    return (notifications || [])
      .filter(notification => actionPermittedBySignalK(notification, action))
      .filter(notification => action !== 'silence' || notification.audioActionable === true)
      .map(notification => notification.id)
      .filter(id => typeof id === 'string' && id.length > 0)
  }

  function actionPermittedBySignalK(notification, action) {
    const status = notification?.status
    if (!status) return false
    if (action === 'silence') return notification.state !== 'emergency' && status.canSilence === true && status.silenced !== true
    if (action === 'acknowledge') return status.canAcknowledge === true && status.acknowledged !== true
    return false
  }

  return { hasGlobalActionTarget, globalActionTargetIds }
})
