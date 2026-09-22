'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { readConfiguration, subscribeToDeploy } = require('../lib/node-red-runtime')

const config = {
  schemaVersion: 1,
  notificationEngine: {
    stateOrder: ['emergency', 'alarm', 'warn', 'normal'],
    visibleStates: ['emergency', 'alarm', 'warn', 'normal']
  }
}

test('reads and fingerprints the active flow configuration', async () => {
  const result = await readConfiguration({ runtime: { flows: { getFlows: async () => ({ rev: 'r1', flows: [
    { id: 'n', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] },
    { type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }
  ] }) } } })
  assert.deepEqual(result.config, config)
  assert.equal(result.rules[0].match.state, 'alarm')
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

test('backs up a valid flow and restores it after an invalid deploy', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-engine-'))
  const flowFile = path.join(directory, 'flows.json')
  const validFlow = [
    { id: 'rule', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] },
    { type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }
  ]
  await fs.writeFile(flowFile, JSON.stringify(validFlow))
  const red = {
    settings: { flowFile },
    runtime: {
      flows: {
        async getFlows(_request) { return { flows: validFlow, credentials: { secret: 'keep' } } },
        async setFlows(flow, credentials, type) {
          this.restored = { flow, credentials, type }
        }
      }
    }
  }

  const first = await readConfiguration(red)
  assert.equal(first.config.schemaVersion, 1)
  const backup = path.join(directory, 'notification-engine-backups', 'last-valid-flow.json')
  assert.deepEqual(JSON.parse(await fs.readFile(backup, 'utf8')).flows, validFlow)

  await fs.writeFile(flowFile, JSON.stringify([{ id: 'other', type: 'inject', name: 'Other' }]))
  const recovered = await readConfiguration(red)
  assert.deepEqual(recovered.config, config)
  assert.equal(red.runtime.flows.restored.type, 'full')
  assert.deepEqual(red.runtime.flows.restored.flow, validFlow)
})
