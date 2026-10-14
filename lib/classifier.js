'use strict'

const PATH_CATEGORIES = [
  ['notifications.navigation.', 'NAVIGATION'],
  ['notifications.noaahurricane.', 'WEATHER'],
  ['notifications.environment.', 'ENVIRONMENT'],
  ['notifications.electrical.', 'ELECTRICAL'],
  ['notifications.propulsion.', 'PROPULSION'],
  ['notifications.system.', 'SYSTEM'],
  ['notifications.security.', 'SECURITY']
]

/**
 * Classify a notification without changing its Signal K value.
 *
 * Structured path information deliberately wins over message text. The text
 * fallback is intentionally absent in this first version: false classification
 * is worse than an explicit `OTHER` card in an alarm centre.
 *
 * @param {{path?: string, source?: object, value?: object}} notification
 * @returns {string} Stable local category.
 */
function classify(notification, overrides = []) {
  const path = String(notification.path || '').toLowerCase()
  for (const rule of overrides) {
    if (path.startsWith(String(rule.pathPrefix || '').toLowerCase())) return rule.category
  }
  if (path.includes('anchor')) return 'ANCHOR'
  if (path.includes('collision')) return 'COLLISION'

  for (const [prefix, category] of PATH_CATEGORIES) {
    if (path.startsWith(prefix)) return category
  }

  const sourceLabel = String(notification.source?.label || '').toLowerCase()
  if (sourceLabel.includes('anchor')) return 'ANCHOR'
  if (sourceLabel.includes('collision')) return 'COLLISION'
  return 'OTHER'
}

module.exports = classify
module.exports.withOverrides = overrides => notification => classify(notification, overrides)
