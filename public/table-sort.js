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

  return { compareNotificationPaths }
})
