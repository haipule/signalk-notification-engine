'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const NotificationActions = require('../lib/actions')

function record(overrides = {}) {
  return {
    id: 'alarm-1',
    state: 'alarm',
    actionManaged: true,
    status: { canSilence: true, canAcknowledge: true, canClear: true },
    ...overrides
  }
}

test('calls Signal K only for a permitted action', async () => {
  const calls = []
  const actions = new NotificationActions({ notifications: { silence: id => calls.push(id) } })

  await actions.execute(record(), 'silence')

  assert.deepEqual(calls, ['alarm-1'])
})

test('waits for all permitted global actions', async () => {
  const calls = []
  const actions = new NotificationActions({ notifications: { silence: async id => { await new Promise(resolve => setTimeout(resolve, 1)); calls.push(id) } } })
  await actions.executeAll([record(), record({ id: 'alarm-2' }), record({ state: 'emergency' })], 'silence')
  assert.deepEqual(calls.sort(), ['alarm-1', 'alarm-2'])
})

test('does not silence an emergency notification', async () => {
  const actions = new NotificationActions({ notifications: { silence() { throw new Error('must not call') } } })

  await assert.rejects(actions.execute(record({ state: 'emergency' }), 'silence'), /cannot be silenced/)
})

test('does not clear a notification without clear capability', async () => {
  const actions = new NotificationActions({ notifications: { clear() { throw new Error('must not call') } } })

  await assert.rejects(actions.execute(record({ status: { canClear: false } }), 'clear'), /cannot be cleared/)
})

test('does not clear an already normal notification', async () => {
  const actions = new NotificationActions({ notifications: { clear() { throw new Error('must not call') } } })

  await assert.rejects(actions.execute(record({ state: 'normal' }), 'clear'), /cannot be cleared/)
})

test('does not repeat an already acknowledged action', async () => {
  const actions = new NotificationActions({ notifications: { acknowledge() { throw new Error('must not call') } } })

  await assert.rejects(actions.execute(record({ status: { canAcknowledge: true, acknowledged: true } }), 'acknowledge'), /cannot be acknowledged/)
})

test('rejects stale capabilities after Signal K removes the id from its manager', async () => {
  const actions = new NotificationActions({ notifications: { acknowledge() { throw new Error('must not call') } } })

  await assert.rejects(
    actions.execute(record({ actionManaged: false, state: 'normal' }), 'acknowledge'),
    /cannot be acknowledged/
  )
})

test('allows acknowledgement in normal and nominal state when Signal K permits it', async () => {
  const acknowledged = []
  const actions = new NotificationActions({ notifications: { acknowledge: id => acknowledged.push(id) } })

  await actions.execute(record({ id: 'normal-1', state: 'normal' }), 'acknowledge')
  await actions.execute(record({ id: 'nominal-1', state: 'nominal' }), 'acknowledge')

  assert.deepEqual(acknowledged, ['normal-1', 'nominal-1'])
})

test('never applies operator lifecycle actions to the audio system notification', async () => {
  const actions = new NotificationActions({ notifications: { clear() { throw new Error('must not call') } } })
  const system = record({ path: 'notifications.system.notificationEngine.audio' })
  assert.equal(actions.allowed(system, 'silence'), false)
  assert.equal(actions.allowed(system, 'acknowledge'), false)
  assert.equal(actions.allowed(system, 'clear'), false)
})
