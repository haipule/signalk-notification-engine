'use strict'

// These fields moved to the mandatory embedded Node-RED configuration. Keep
// the list explicit: arbitrary unknown fields must still fail schema
// validation instead of being silently discarded.
const NODE_RED_OWNED_LEGACY_FIELDS = [
  'policies',
  'classificationRules',
  'stateOrder',
  'sortOrder',
  'visibleStates',
  'stateColors',
  'colorPaletteFile',
  'visualRules',
  'soundsByState',
  'soundPaletteFile',
  'historyRules',
  'historyStates'
]

/**
 * Remove only settings whose authority has already moved to the validated
 * embedded Node-RED configuration. Operational Signal K settings are retained
 * verbatim. The caller persists the result only after Node-RED startup has
 * succeeded, so a missing or invalid flow can never destroy the fallback
 * evidence in the existing plugin options.
 *
 * @param {object} options Persisted Signal K plugin options.
 * @returns {{options: object, changed: boolean, removedFields: string[]}}
 */
function migratePluginOptions(options = {}) {
  const migrated = { ...options }
  const removedFields = []
  for (const field of NODE_RED_OWNED_LEGACY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(migrated, field)) continue
    delete migrated[field]
    removedFields.push(field)
  }
  return { options: migrated, changed: removedFields.length > 0, removedFields }
}

module.exports = { NODE_RED_OWNED_LEGACY_FIELDS, migratePluginOptions }
