'use strict'

/**
 * Normalize the source shapes used by Signal K deltas and data-model views.
 *
 * Signal K normally exposes a source as `{ label }`, but older or alternate
 * projections can expose `$source`, `type`, or a plain string. Keeping this
 * boundary normalization here prevents the UI and policy code from having to
 * know which Signal K view supplied a notification.
 *
 * @param {unknown} source Source value from a delta or data-model node.
 * @returns {{label: string, type?: string}|null} Canonical source or null.
 */
function normalizeSource(source) {
  if (typeof source === 'string') {
    const label = source.trim()
    return label ? { label } : null
  }
  if (!source || typeof source !== 'object') return null

  // Depending on whether the value came from a delta, full model, or
  // notification API, Signal K may expose the source under one of these
  // equivalent fields. `$source` can itself be an embedded source object.
  if (!source.label && source.$source && typeof source.$source === 'object') {
    return normalizeSource(source.$source)
  }
  const label = source.label || source.$source || source.src || source.name || source.type
  if (!label || typeof label !== 'string' || !label.trim()) return null

  const normalized = { label: label.trim() }
  if (typeof source.type === 'string' && source.type.trim()) normalized.type = source.type.trim()
  return normalized
}

/**
 * Prefer a known producer over Signal K's notification-handler projection.
 *
 * `self.notificationhandler` is authoritative for the notification lifecycle
 * but is a transport/projection source, not the sensor or plugin that produced
 * the underlying condition. A later handler delta must therefore not erase a
 * producer source already recovered from the Signal K data path.
 *
 * @param {unknown} incoming Source supplied by the newest view or delta.
 * @param {unknown} previous Source already associated with the notification.
 * @returns {{label: string, type?: string}|null} Preferred canonical source.
 */
function preferNotificationSource(incoming, previous) {
  const next = normalizeSource(incoming)
  const known = normalizeSource(previous)
  if (!next) return known
  if (next.label === 'self.notificationhandler' && known && known.label !== 'self.notificationhandler') return known
  return next
}

module.exports = { normalizeSource, preferNotificationSource }
