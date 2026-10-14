'use strict'

// Keep the removal list explicit: arbitrary unknown fields must still fail
// schema validation instead of being silently discarded. Most fields moved
// to Node-RED; the clearHistory fields were superseded by the authenticated
// Notification Centre history action.
const REMOVED_LEGACY_FIELDS = [
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
  'historyStates',
  'clearHistoryOnStart',
  'clearHistoryPath',
  'clearHistoryPathOnSave',
  'clearHistoryOccurrenceId'
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
  if (typeof migrated.ruleBuilderTabId === 'string' && migrated.ruleBuilderTabId.trim()) {
    migrated.ruleBuilderFlow = { id: migrated.ruleBuilderTabId.trim() }
    delete migrated.ruleBuilderTabId
    removedFields.push('ruleBuilderTabId')
  }
  for (const field of REMOVED_LEGACY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(migrated, field)) continue
    delete migrated[field]
    removedFields.push(field)
  }
  return { options: migrated, changed: removedFields.length > 0, removedFields }
}

module.exports = { REMOVED_LEGACY_FIELDS, migratePluginOptions }
