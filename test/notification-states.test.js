'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { NOTIFICATION_STATES, normalizeNotificationState } = require('../lib/notification-states')

test('uses the fixed descending Signal K presentation order', () => {
  assert.deepEqual(NOTIFICATION_STATES, [
    'emergency', 'alarm', 'warn', 'alert', 'normal', 'nominal'
  ])
})

test('normalizes known states without treating foreign states as known', () => {
  assert.equal(normalizeNotificationState(' WARN '), 'warn')
  assert.equal(normalizeNotificationState('foreign-state'), null)
})
