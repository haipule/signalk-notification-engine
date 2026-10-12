'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const ConfiguredTestNotification = require('../lib/configured-test-notification')

function fixture(overrides = {}) {
  const calls = []
  let timerCallback = null
  const manager = new ConfiguredTestNotification({
    notifications: {
      raise: options => { calls.push(['raise', options]); return 'owned-id' },
      clear: async id => { calls.push(['clear', id]) },
      ...overrides.notifications
    },
    onComplete: (configuration, context) => calls.push(['complete', configuration, context]),
    debug: message => calls.push(['debug', message]),
    error: message => calls.push(['error', message]),
    setTimer: (callback, delay) => { timerCallback = callback; calls.push(['timer', delay]); return 1 },
    clearTimer: id => calls.push(['clearTimer', id])
  })
  return { manager, calls, expire: async () => { timerCallback(); await new Promise(resolve => setImmediate(resolve)) } }
}

test('keeps the configured test visible for its lifetime and resets only after clearing its owned id', async () => {
  const { manager, calls, expire } = fixture()
  const configuration = { enabled: true, state: 'alert', message: 'Test', path: 'notifications.test', runtimeSeconds: 60 }
  const context = { lifecycle: 1 }

  assert.equal(manager.start(configuration, context), true)
  assert.equal(calls[0][0], 'raise')
  assert.equal(calls[0][1].state, 'alert')
  assert.equal(calls[0][1].path, 'notifications.test')
  assert.deepEqual(calls[1], ['timer', 60000])
  assert.equal(calls.some(call => call[0] === 'complete'), false)

  await expire()

  assert.deepEqual(calls.find(call => call[0] === 'clear'), ['clear', 'owned-id'])
  assert.deepEqual(calls.find(call => call[0] === 'complete'), ['complete', configuration, context])
})

test('plugin stop clears only the owned id and does not consume the one-shot request', async () => {
  const { manager, calls } = fixture()
  manager.start({ enabled: true, runtimeSeconds: 30 }, {})

  await manager.stop()

  assert.deepEqual(calls.find(call => call[0] === 'clearTimer'), ['clearTimer', 1])
  assert.deepEqual(calls.find(call => call[0] === 'clear'), ['clear', 'owned-id'])
  assert.equal(calls.some(call => call[0] === 'complete'), false)
})

test('does not reset configuration when Signal K cannot clear the owned notification', async () => {
  const { manager, calls, expire } = fixture({ notifications: { clear: async () => { throw new Error('clear failed') } } })
  manager.start({ enabled: true }, {})

  await expire()

  assert.equal(calls.some(call => call[0] === 'complete'), false)
  assert.match(calls.find(call => call[0] === 'error')[1], /clear failed/)
  assert.equal(manager.id, 'owned-id')
})

test('hides only the completed configured test from the active engine view', () => {
  const configuredTest = { data: { notificationManagerTest: true } }
  const foreign = { data: { notificationManagerTest: false } }

  assert.equal(ConfiguredTestNotification.isVisibleInActiveView(configuredTest, true), true)
  assert.equal(ConfiguredTestNotification.isVisibleInActiveView(configuredTest, false), false)
  assert.equal(ConfiguredTestNotification.isVisibleInActiveView(foreign, false), true)
})
