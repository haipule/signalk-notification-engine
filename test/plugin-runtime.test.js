'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const PluginRuntime = require('../lib/plugin-runtime')

function config(checksum = 'one') {
  return { checksum, rules: [{ name: checksum }], config: { notificationEngine: { stateOrder: ['warn'], visibleStates: ['warn'], visualRules: { warn: { display: 'banner' } } } } }
}

test('loads mandatory Node-RED configuration before returning a lifecycle token', async () => {
  const written = []
  const reads = []
  const runtime = new PluginRuntime({
    getNodeRed: () => ({ id: 'red' }), readConfiguration: async (...args) => { reads.push(args); return config() }, subscribeToDeploy: () => () => {},
    applyConfiguration: () => {}, writeRules: (...args) => written.push(args), suspend: () => {}, resume: async () => {}
  })
  const started = await runtime.start({ audioDevice: 'default', ruleBuilderFlow: { id: 'selected-tab' } })
  assert.equal(runtime.isCurrent(started.token), true)
  assert.equal(started.flowOptions.audioDevice, 'default')
  assert.deepEqual(started.flowOptions.visualRules, { warn: { display: 'banner' } })
  assert.equal(Object.hasOwn(started.flowOptions, 'stateOrder'), false)
  assert.equal(Object.hasOwn(started.flowOptions, 'visibleStates'), false)
  assert.deepEqual(reads[0], [{ id: 'red' }, 'selected-tab'])
  assert.deepEqual(written[0], [[{ name: 'one' }], 'one'])
})

test('keeps the Plugin Config test request authoritative over an obsolete Node-RED value', async () => {
  const runtime = new PluginRuntime({
    getNodeRed: () => ({}),
    readConfiguration: async () => ({
      checksum: 'one', rules: [], config: { notificationEngine: { testNotif: { enabled: false } } }
    }),
    subscribeToDeploy: () => () => {}, applyConfiguration: () => {}, writeRules: () => {}, suspend: () => {}, resume: async () => {}
  })

  const started = await runtime.start({ testNotif: { enabled: true, state: 'alert' } })

  assert.deepEqual(started.flowOptions.testNotif, { enabled: true, state: 'alert' })
})

test('keeps protected Plugin Config settings authoritative over the legacy flow node', async () => {
  const runtime = new PluginRuntime({
    getNodeRed: () => ({}),
    readConfiguration: async () => ({
      checksum: 'one',
      rules: [],
      config: {
        notificationEngine: {
          audioDevice: 'flow-device',
          alarmSoundTest: { intervalDays: 0 },
          historyLimit: 1,
          shortcutInfo: 'x',
          criticalInputs: [],
          externalTasks: { maxConcurrent: 4, allowedExecutables: [] },
          visualRules: { warn: { display: 'banner' } }
        }
      }
    }),
    subscribeToDeploy: () => () => {}, applyConfiguration: () => {}, writeRules: () => {}, suspend: () => {}, resume: async () => {}
  })
  const pluginOptions = {
    audioDevice: 'plugin-device',
    alarmSoundTest: { intervalDays: 7 },
    historyLimit: 500,
    shortcutInfo: 'i',
    criticalInputs: [{ name: 'GPS' }],
    externalTasks: { maxConcurrent: 2, allowedExecutables: [] }
  }

  const started = await runtime.start(pluginOptions)

  for (const field of Object.keys(pluginOptions)) assert.deepEqual(started.flowOptions[field], pluginOptions[field])
  assert.deepEqual(started.flowOptions.visualRules, { warn: { display: 'banner' } })
})

test('latches invalid reload fail-closed and retries only on forced deploy', async () => {
  const reads = [config('one'), new Error('invalid flow'), config('two')]
  let suspended = 0
  let resumed = 0
  const applied = []
  const runtime = new PluginRuntime({
    getNodeRed: () => ({}),
    readConfiguration: async () => { const value = reads.shift(); if (value instanceof Error) throw value; return value },
    subscribeToDeploy: () => () => {}, applyConfiguration: value => applied.push(value), writeRules: () => {},
    suspend: () => { suspended += 1 }, resume: async () => { resumed += 1 }, error: () => {}
  })
  await runtime.start()
  await runtime.refresh({ force: true })
  assert.equal(runtime.status().state, 'error')
  assert.equal(suspended, 1)
  await runtime.refresh()
  assert.equal(reads.length, 1)
  await runtime.refresh({ force: true })
  assert.equal(runtime.status().state, 'ready')
  assert.equal(resumed, 1)
  assert.equal(applied[0].activeRules[0].name, 'two')
})

test('stop unsubscribes and invalidates asynchronous startup work', async () => {
  let unsubscribed = 0
  const runtime = new PluginRuntime({
    getNodeRed: () => ({}), readConfiguration: async () => config(), subscribeToDeploy: () => () => { unsubscribed += 1 },
    applyConfiguration: () => {}, writeRules: () => {}, suspend: () => {}, resume: async () => {}
  })
  const { token } = await runtime.start()
  runtime.subscribe()
  runtime.stop()
  assert.equal(unsubscribed, 1)
  assert.equal(runtime.isCurrent(token), false)
  assert.equal(runtime.eventsAvailable(), false)
})
