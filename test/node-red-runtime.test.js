'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { listActiveFlowTabs, readConfiguration, selectRuleBuilderTab, subscribeToDeploy } = require('../lib/node-red-runtime')

const config = {
  schemaVersion: 1,
  notificationEngine: {
    stateOrder: ['emergency', 'alarm', 'warn', 'normal'],
    visibleStates: ['emergency', 'alarm', 'warn', 'normal'],
    visualRules: { alarm: { display: 'overlay' } }
  }
}
const effectiveConfig = {
  schemaVersion: 1,
  notificationEngine: { visualRules: { alarm: { display: 'overlay' } } }
}

test('reads and fingerprints the active flow configuration', async () => {
  const result = await readConfiguration({ runtime: { flows: { getFlows: async () => ({ rev: 'r1', flows: [
    { id: 'selected', type: 'tab', label: 'Production Rules' },
    { id: 'n', z: 'selected', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['a']] },
    { id: 'a', z: 'selected', type: 'debug', name: 'Activate', wires: [[]] },
    { z: 'selected', type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }
  ] }) } } }, 'selected')
  assert.deepEqual(result.config, effectiveConfig)
  assert.equal(result.rules[0].match.state, 'alarm')
  assert.deepEqual(result.selectedTab, { id: 'selected', name: 'Production Rules' })
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

test('lists only active embedded Node-RED tabs by stable id and display name', async () => {
  const tabs = await listActiveFlowTabs({ runtime: { flows: { getFlows: async () => ({ flows: [
    { id: 'active-a', type: 'tab', label: 'Production Rules' },
    { id: 'disabled', type: 'tab', label: 'Old Rules', disabled: true },
    { id: 'active-b', type: 'tab', label: 'Release Flow', disabled: false },
    { id: 'node', type: 'change', z: 'active-a', name: 'Not a tab' }
  ] }) } } })

  assert.deepEqual(tabs, [
    { id: 'active-a', name: 'Production Rules' },
    { id: 'active-b', name: 'Release Flow' }
  ])
})

test('scopes configuration and rules exclusively to the selected stable tab id', async () => {
  const otherConfig = { schemaVersion: 1, notificationEngine: { stateOrder: ['warn'], visibleStates: ['warn'] } }
  const result = await readConfiguration({ runtime: { flows: { getFlows: async () => ({ flows: [
    { id: 'selected', type: 'tab', label: 'Same label' },
    { id: 'other', type: 'tab', label: 'Same label' },
    { id: 'selected-rule', z: 'selected', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['selected-activate']] },
    { id: 'selected-activate', z: 'selected', type: 'debug', name: 'Activate', wires: [[]] },
    { z: 'selected', type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config },
    { id: 'other-rule', z: 'other', type: 'function', func: "msg.payload={state:'warn'}; return msg;", wires: [['other-activate']] },
    { id: 'other-activate', z: 'other', type: 'debug', name: 'Activate', wires: [[]] },
    { z: 'other', type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: otherConfig }
  ] }) } } }, 'selected')

  assert.deepEqual(result.config, effectiveConfig)
  assert.equal(result.rules.length, 1)
  assert.equal(result.rules[0].match.state, 'alarm')
})

test('accepts a selected active Rule Builder tab without the legacy config node', async () => {
  const result = await readConfiguration({ runtime: { flows: { getFlows: async () => ({ flows: [
    { id: 'selected', type: 'tab', label: 'Production Rules' },
    { id: 'rule', z: 'selected', type: 'function', func: "msg.payload={state:'alert'}; return msg;", wires: [['activate']] },
    { id: 'activate', z: 'selected', type: 'debug', name: 'Activate', wires: [[]] }
  ] }) } } }, 'selected')

  assert.deepEqual(result.config, { schemaVersion: 1, notificationEngine: {} })
  assert.equal(result.rules.length, 1)
  assert.equal(result.rules[0].match.state, 'alert')
})

test('fails closed for a missing, unknown, or disabled selected tab without label fallback', () => {
  const flow = [
    { id: 'active', type: 'tab', label: 'Production Rules' },
    { id: 'disabled', type: 'tab', label: 'Disabled Rules', disabled: true }
  ]

  assert.throws(() => selectRuleBuilderTab(flow, ''), /No Rule Builder flow is selected/)
  assert.throws(() => selectRuleBuilderTab(flow, 'Production Rules'), /does not exist/)
  assert.throws(() => selectRuleBuilderTab(flow, 'missing'), /does not exist/)
  assert.throws(() => selectRuleBuilderTab(flow, 'disabled'), /is disabled/)
  assert.deepEqual(selectRuleBuilderTab(flow, 'active'), { id: 'active', name: 'Production Rules', nodes: [] })
})

test('does not restore a backup when the protected selected tab is disabled', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-engine-disabled-tab-'))
  const flowFile = path.join(directory, 'flows.json')
  const flow = [
    { id: 'selected', type: 'tab', label: 'Production Rules', disabled: true },
    { z: 'selected', type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }
  ]
  await fs.writeFile(flowFile, JSON.stringify(flow))
  let restored = false
  const red = {
    settings: { flowFile },
    runtime: { flows: {
      async getFlows(_request) { return { flows: flow } },
      async setFlows() { restored = true }
    } }
  }

  await assert.rejects(readConfiguration(red, 'selected'), /is disabled/)
  assert.equal(restored, false)
})

test('backs up a valid flow and restores it after an invalid deploy', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-engine-'))
  const flowFile = path.join(directory, 'flows.json')
  const validFlow = [
    { id: 'selected', type: 'tab', label: 'Production Rules' },
    { id: 'rule', z: 'selected', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['activate']] },
    { id: 'activate', z: 'selected', type: 'debug', name: 'Activate', wires: [[]] },
    { z: 'selected', type: 'inject', name: 'Notification Engine config', payloadType: 'json', payload: config }
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

  const first = await readConfiguration(red, 'selected')
  assert.equal(first.config.schemaVersion, 1)
  const backup = path.join(directory, 'notification-engine-backups', 'last-valid-flow.json')
  assert.deepEqual(JSON.parse(await fs.readFile(backup, 'utf8')).flows, validFlow)

  const invalidFlow = validFlow.map(node => (
    node.name === 'Notification Engine config'
      ? { ...node, payload: { schemaVersion: 999 } }
      : node
  ))
  await fs.writeFile(flowFile, JSON.stringify(invalidFlow))
  const recovered = await readConfiguration(red, 'selected')
  assert.deepEqual(recovered.config, effectiveConfig)
  assert.equal(red.runtime.flows.restored.type, 'full')
  assert.deepEqual(red.runtime.flows.restored.flow, validFlow)
})
