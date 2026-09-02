'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { readConfiguration, subscribeToDeploy } = require('../lib/node-red-runtime')

const config = {
  schemaVersion: 1,
  notificationEngine: {
    stateOrder: ['emergency', 'alarm', 'warn', 'normal'],
    visibleStates: ['emergency', 'alarm', 'warn', 'normal']
  }
}

test('reads and fingerprints the active flow configuration', async () => {
  const result = await readConfiguration({ runtime: { flows: { getFlows: async () => ({ rev: 'r1', flows: [{ type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }] }) } } })
  assert.deepEqual(result.config, config)
  assert.equal(result.checksum.length, 64)
})

test('only forwards runtime deploy events', async () => {
  const listeners = new Map()
  const red = {
    events: {
      on: (name, listener) => listeners.set(name, listener),
      removeListener: (name, listener) => { if (listeners.get(name) === listener) listeners.delete(name) }
    }
  }
  const events = []
  const unsubscribe = subscribeToDeploy(red, event => events.push(event))
  listeners.get('runtime-event')({ id: 'runtime-state' })
  listeners.get('runtime-event')({ id: 'runtime-deploy', payload: { revision: 'r1' } })
  await new Promise(resolve => setImmediate(resolve))
  unsubscribe()
  assert.equal(events.length, 1)
  assert.equal(events[0].payload.revision, 'r1')
  assert.equal(listeners.size, 0)
})
