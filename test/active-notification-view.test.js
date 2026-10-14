'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { isActiveNotification } = require('../lib/active-notification-view')

test('removes a normal record after Signal K removes its managed id', () => {
  assert.equal(isActiveNotification({ state: 'normal', actionManaged: false }), false)
  assert.equal(isActiveNotification({ state: 'normal', actionManaged: true }), true)
})

test('keeps non-normal records visible when manager membership is unavailable', () => {
  for (const state of ['emergency', 'alarm', 'warn', 'alert', 'nominal', 'foreign']) {
    assert.equal(isActiveNotification({ state, actionManaged: false }), true)
  }
})
