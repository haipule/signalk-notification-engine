'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { sourceAllowsAction, notificationActionState } = require('../public/action-availability')

const notification = overrides => ({
  state: 'alarm',
  status: { canSilence: true, canAcknowledge: true, canClear: true, silenced: false, acknowledged: false },
  ...overrides
})

test('keeps a Signal K-permitted action applicable but disabled for a read-only browser', () => {
  const state = notificationActionState(notification(), 'acknowledge', {
    connected: true, configurationReady: true, writeAuthorized: false
  })
  assert.deepEqual(state, { applicable: true, enabled: false, reason: 'write_permission' })
})

test('distinguishes source denial from missing browser authorization', () => {
  const state = notificationActionState(notification({ status: { canAcknowledge: false } }), 'acknowledge', {
    connected: true, configurationReady: true, writeAuthorized: false
  })
  assert.deepEqual(state, { applicable: false, enabled: false, reason: 'source' })
})

test('follows Signal K acknowledgement permission in normal state', () => {
  const normal = notification({ state: 'normal' })
  assert.equal(sourceAllowsAction(normal, 'acknowledge'), true)
  assert.equal(sourceAllowsAction(normal, 'clear'), false)
})

test('never offers silence for emergency', () => {
  assert.equal(sourceAllowsAction(notification({ state: 'emergency' }), 'silence'), false)
})
