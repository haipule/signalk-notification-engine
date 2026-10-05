'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const PluginRuntime = require('../lib/plugin-runtime')

function config(checksum = 'one') {
  return { checksum, rules: [{ name: checksum }], config: { notificationEngine: { stateOrder: ['warn'] } } }
}

test('loads mandatory Node-RED configuration before returning a lifecycle token', async () => {
  const written = []
  const runtime = new PluginRuntime({
    getNodeRed: () => ({ id: 'red' }), readConfiguration: async () => config(), subscribeToDeploy: () => () => {},
    applyConfiguration: () => {}, writeRules: (...args) => written.push(args), suspend: () => {}, resume: async () => {}
  })
  const started = await runtime.start({ audioDevice: 'default' })
  assert.equal(runtime.isCurrent(started.token), true)
  assert.equal(started.flowOptions.audioDevice, 'default')
  assert.deepEqual(written[0], [[{ name: 'one' }], 'one'])
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
