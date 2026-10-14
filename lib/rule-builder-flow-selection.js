'use strict'

/**
 * Add the active embedded Node-RED tab selector to a Signal K plugin schema.
 * Each named choice contains one read-only ID field, so the stable ID is both
 * visible and the only persisted selector value.
 *
 * @param {object} schema Static Signal K plugin configuration schema.
 * @param {Array<{id: string, name: string}>} tabs Active embedded Node-RED tabs.
 * @param {string} selectedTabId Currently persisted stable tab ID, if known.
 * @param {string} readError Flow-discovery error text, if discovery failed.
 * @returns {object} Schema decorated with the dynamic flow selector.
 */
function withRuleBuilderFlowSelection(schema, tabs, selectedTabId = '', readError = '') {
  const availabilityText = readError
    ? ` Active embedded Node-RED tabs could not be read: ${readError}`
    : ''
  const field = {
    title: 'Rule Builder Flow',
    description: `Select the active embedded Node-RED flow by name.${availabilityText}`,
    oneOf: tabs.map(tab => ({
      title: tab.name,
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: {
          type: 'string',
          title: 'Selected stable tab ID',
          const: tab.id,
          default: tab.id,
          readOnly: true
        }
      }
    }))
  }

  if (selectedTabId) field.default = { id: selectedTabId }

  return {
    ...schema,
    properties: { ruleBuilderFlow: field, ...schema.properties }
  }
}

module.exports = { withRuleBuilderFlowSelection }
