'use strict'

// Signal K alarmState values. Keep rule/config validation separate from the
// observation boundary: foreign notifications with an unknown string state
// must remain visible instead of being discarded by this plugin.
const NOTIFICATION_STATES = Object.freeze([
  'emergency', 'alarm', 'warn', 'alert', 'normal', 'nominal'
])
const NOTIFICATION_STATE_SET = new Set(NOTIFICATION_STATES)

function normalizeNotificationState(value) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return NOTIFICATION_STATE_SET.has(normalized) ? normalized : null
}

module.exports = { NOTIFICATION_STATES, normalizeNotificationState }
