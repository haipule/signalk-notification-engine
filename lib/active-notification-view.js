'use strict'

/**
 * Return whether a reconstructed Signal K notification belongs in the active
 * WebApp table.
 *
 * Signal K removes only `normal` records from its addressable Notification API
 * manager after its cleanup interval. The data-model projection can remain,
 * but it is no longer an active manager record. Non-normal records remain
 * visible fail-safe even if a manager snapshot is temporarily unavailable.
 *
 * @param {object} record Reconstructed read-only notification record.
 * @returns {boolean} True when the record belongs in the active projection.
 */
function isActiveNotification(record) {
  if (!record) return false
  return record.state !== 'normal' || record.actionManaged === true
}

module.exports = { isActiveNotification }
