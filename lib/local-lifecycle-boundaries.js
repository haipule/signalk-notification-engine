'use strict'

const BOUNDARIES = [{
  inputPath: 'navigation.anchor.state',
  inactiveValues: ['off', null, undefined],
  notificationPath: 'notifications.navigation.anchor',
  reason: 'anchor_watch_disabled'
}]

/** Return Signal K input paths that authoritatively delimit local occurrences. */
function lifecycleBoundaryPaths() {
  return [...new Set(BOUNDARIES.map(boundary => boundary.inputPath))]
}

/**
 * Apply an authoritative Signal K input only to the local occurrence model.
 * This never clears or modifies the producer-owned notification.
 */
function applyLifecycleBoundary(store, inputPath, value) {
  let changed = 0
  for (const boundary of BOUNDARIES) {
    if (boundary.inputPath !== inputPath) continue
    const inactive = boundary.inactiveValues.includes(value)
    changed += inactive
      ? store.endLocalOccurrences({ path: boundary.notificationPath, reason: boundary.reason, inputPath, inputValue: value })
      : store.releaseLocalOccurrenceBoundary({ path: boundary.notificationPath })
  }
  return changed
}

module.exports = { applyLifecycleBoundary, lifecycleBoundaryPaths }
