'use strict'

;(function exposeHistoryFilter(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.NotificationHistoryFilter = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  /**
   * Return complete occurrences that contain a table-visible audit event.
   *
   * Visibility is evaluated by the caller with the same presentation rules as
   * the table. Once one event qualifies, every retained event from that local
   * occurrence is included so the operator also sees its authoritative return
   * to normal. Events without an occurrence identity fall back to path and
   * producer source.
   *
   * @param {Array<object>} events Persisted Notification Engine audit events.
   * @param {(notification: object) => boolean} isVisible Table visibility check.
   * @returns {Array<object>} Matching events, newest first.
   */
  function historyForTableNotifications(events, isVisible) {
    const sourceEvents = events || []
    const visibleOccurrenceIds = new Set()
    const visibleFallbackKeys = new Set()

    for (const event of sourceEvents) {
      const notification = event?.notification
      if (!notification || !isVisible(notification)) continue
      if (notification.occurrenceId) visibleOccurrenceIds.add(notification.occurrenceId)
      else if (notification.path) visibleFallbackKeys.add(notificationKey(notification))
    }

    return sourceEvents.filter(event => {
      const notification = event?.notification
      if (!notification) return false
      if (notification.occurrenceId && visibleOccurrenceIds.has(notification.occurrenceId)) return true
      return visibleFallbackKeys.has(notificationKey(notification))
    }).sort((left, right) => eventTime(right) - eventTime(left))
  }

  function eventTime(event) {
    const timestamp = Date.parse(event?.at || '')
    return Number.isFinite(timestamp) ? timestamp : 0
  }

  function notificationKey(notification) {
    return `${notification.path || ''}|${notification.source?.label || ''}`
  }

  return { historyForTableNotifications }
})
