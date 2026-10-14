'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { CONFIG_NODE_NAME, checksumConfig, extractConfig, validateConfig } = require('../lib/node-red-config')

function flow(config) {
  return [{ type: 'inject', name: CONFIG_NODE_NAME, payloadType: 'json', payload: config }]
}

const config = {
  schemaVersion: 1,
  notificationEngine: {}
}

test('extracts and normalizes the deployed configuration', () => {
  assert.deepEqual(extractConfig(flow(config)), config)
})

test('checksum ignores object key order', () => {
  const reordered = { notificationEngine: config.notificationEngine, schemaVersion: 1 }
  assert.equal(checksumConfig(config), checksumConfig(reordered))
})

test('changed effective configuration has a different checksum', () => {
  const changed = structuredClone(config)
  changed.notificationEngine.visualRules = { alarm: { display: 'overlay' } }
  assert.notEqual(checksumConfig(config), checksumConfig(changed))
})

test('uses an empty compatibility config without a legacy node and rejects duplicates or invalid versions', () => {
  assert.deepEqual(extractConfig([]), config)
  assert.throws(() => extractConfig([...flow(config), ...flow(config)]), /Expected at most one/)
  assert.throws(() => extractConfig(flow({ schemaVersion: 2, notificationEngine: config.notificationEngine })), /Unsupported/)
})

test('discards obsolete and protected copies from the legacy config node', () => {
  const normalized = validateConfig({
    schemaVersion: 1,
    notificationEngine: {
      classificationRules: [{ category: 'OTHER' }],
      historyStates: ['alarm'],
      stateOrder: ['WARN', 'Normal'],
      visibleStates: ['ALARM'],
      testNotif: { enabled: false },
      shortcutInfo: 'x',
      shortcutHistory: 'y'
    }
  })
  assert.deepEqual(normalized, { schemaVersion: 1, notificationEngine: {} })
})

test('does not mutate the embedded flow object while normalizing legacy fields', () => {
  const source = { schemaVersion: 1, notificationEngine: { testNotif: { enabled: false } } }
  validateConfig(source)
  assert.deepEqual(source.notificationEngine.testNotif, { enabled: false })
})
