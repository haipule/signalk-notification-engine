'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { CONFIG_NODE_NAME, checksumConfig, extractConfig } = require('../lib/node-red-config')

function flow(config) {
  return [{ type: 'inject', name: CONFIG_NODE_NAME, payloadType: 'json', payload: config }]
}

const config = {
  schemaVersion: 1,
  notificationEngine: {
    stateOrder: ['emergency', 'alarm', 'warn', 'normal'],
    visibleStates: ['emergency', 'alarm', 'warn', 'normal']
  }
}

test('extracts and normalizes the deployed configuration', () => {
  assert.deepEqual(extractConfig(flow(config)), config)
})

test('checksum ignores object key order', () => {
  const reordered = { notificationEngine: config.notificationEngine, schemaVersion: 1 }
  assert.equal(checksumConfig(config), checksumConfig(reordered))
})

test('changed configuration has a different checksum', () => {
  const changed = structuredClone(config)
  changed.notificationEngine.visibleStates = ['emergency', 'alarm']
  assert.notEqual(checksumConfig(config), checksumConfig(changed))
})

test('rejects missing, duplicate, and invalid configuration nodes', () => {
  assert.throws(() => extractConfig([]), /Expected exactly one/)
  assert.throws(() => extractConfig([...flow(config), ...flow(config)]), /Expected exactly one/)
  assert.throws(() => extractConfig(flow({ schemaVersion: 2, notificationEngine: config.notificationEngine })), /Unsupported/)
})

test('accepts all supported notification states', () => {
  const configured = structuredClone(config)
  configured.notificationEngine.stateOrder = ['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal']
  configured.notificationEngine.visibleStates = [...configured.notificationEngine.stateOrder]
  assert.deepEqual(extractConfig(flow(configured)), configured)
})
