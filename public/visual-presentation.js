'use strict'

;(function expose(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root) root.NotificationVisualPresentation = api
})(typeof window !== 'undefined' ? window : globalThis, function build() {
  function isAcknowledged(status) {
    return status?.acknowledged === true || status?.acknowledged === 'true' || Boolean(status?.acknowledgedAt)
  }

  /** Default-visible table policy; only an explicit local rule may hide it. */
  function tablePresentationVisible(notification) {
    return notification?.policy?.visible !== false
  }

  /**
   * Resolve only the attention presentation. The active table remains a
   * separate persistent projection of authoritative Signal K state.
   */
  function attentionPresentation(notification, visualRule) {
    if (isAcknowledged(notification.status)) return null
    const display = visualRule?.display || 'table'
    if (display === 'table') return null
    return display === 'overlay' ? 'overlay' : 'banner'
  }

  return { isAcknowledged, tablePresentationVisible, attentionPresentation }
})
