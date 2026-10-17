'use strict'

;(function exposeTableSort(root, factory) {
  const api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  else root.NotificationTableSort = api
})(typeof globalThis === 'object' ? globalThis : this, () => {
  const segmentCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

  /**
   * Compare Signal K paths one dot-delimited segment at a time.
   *
   * Segment comparison keeps notifications that share a hierarchy adjacent
   * and puts a parent before its children. This changes presentation order
   * only; it does not alter Signal K notification state or authority.
   *
   * @param {string|null|undefined} leftPath First Signal K path.
   * @param {string|null|undefined} rightPath Second Signal K path.
   * @returns {number} Negative, zero, or positive comparator result.
   */
  function compareNotificationPaths(leftPath, rightPath) {
    const leftSegments = String(leftPath || '').split('.')
    const rightSegments = String(rightPath || '').split('.')
    const sharedLength = Math.min(leftSegments.length, rightSegments.length)

    for (let index = 0; index < sharedLength; index += 1) {
      const difference = segmentCollator.compare(leftSegments[index], rightSegments[index])
      if (difference !== 0) return difference
    }
    return leftSegments.length - rightSegments.length
  }

  /**
   * Compare table notifications without allowing a browser-local column choice
   * to override Signal K's fixed presentation severity order.
   *
   * @param {object} left First notification.
   * @param {object} right Second notification.
   * @param {object} options Sort configuration and localized value resolver.
   * @returns {number} Negative, zero, or positive comparator result.
   */
  function compareNotificationRows(left, right, options = {}) {
    const stateOrder = [...(options.stateOrder || []), 'info']
    const stateRank = notification => {
      const rank = stateOrder.indexOf(String(notification?.state || '').toLowerCase())
      return rank < 0 ? stateOrder.length : rank
    }
    const hierarchyDifference = stateRank(left) - stateRank(right)
    if (hierarchyDifference !== 0) return hierarchyDifference

    const direction = options.direction === 'asc' ? 1 : -1
    if (options.column === 'updated') return direction * compareNewest(left, right)

    const difference = options.column === 'notification'
      ? compareNotificationPaths(left?.path, right?.path)
      : segmentCollator.compare(
          String(options.valueForColumn?.(left, options.column) || ''),
          String(options.valueForColumn?.(right, options.column) || '')
        )
    if (difference !== 0) return direction * difference
    return compareNewest(left, right)
  }

  function compareNewest(left, right) {
    const difference = notificationTime(right) - notificationTime(left)
    return difference || String(right?.id || '').localeCompare(String(left?.id || ''))
  }

  function notificationTime(notification) {
    return Date.parse(notification?.lastUpdatedAt || notification?.updatedAt || notification?.firstSeenAt || notification?.createdAt || '') || 0
  }

  return { compareNotificationPaths, compareNotificationRows }
})
