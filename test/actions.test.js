'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const NotificationActions = require('../lib/actions')

function record(overrides = {}) {
  return {
    id: 'alarm-1',
    state: 'alarm',
    status: { canSilence: true, canAcknowledge: true, canClear: true },
    ...overrides
  }
}

test('calls Signal K only for a permitted action', () => {
  const calls = []
  const actions = new NotificationActions({ notifications: { silence: id => calls.push(id) } })

  actions.execute(record(), 'silence')

  assert.deepEqual(calls, ['alarm-1'])
})

test('does not silence an emergency notification', () => {
  const actions = new NotificationActions({ notifications: { silence() { throw new Error('must not call') } } })

  assert.throws(() => actions.execute(record({ state: 'emergency' }), 'silence'), /cannot be silenced/)
})

test('does not clear a notification without clear capability', () => {
  const actions = new NotificationActions({ notifications: { clear() { throw new Error('must not call') } } })

  assert.throws(() => actions.execute(record({ status: { canClear: false } }), 'clear'), /cannot be cleared/)
})

test('does not clear an already normal notification', () => {
  const actions = new NotificationActions({ notifications: { clear() { throw new Error('must not call') } } })

  assert.throws(() => actions.execute(record({ state: 'normal' }), 'clear'), /cannot be cleared/)
})

test('does not repeat an already acknowledged action', () => {
  const actions = new NotificationActions({ notifications: { acknowledge() { throw new Error('must not call') } } })

  assert.throws(() => actions.execute(record({ status: { canAcknowledge: true, acknowledged: true } }), 'acknowledge'), /cannot be acknowledged/)
})
