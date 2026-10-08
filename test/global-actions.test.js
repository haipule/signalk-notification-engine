'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { hasGlobalActionTarget } = require('../public/global-actions')

test('shows global silence only for unfinished permitted audio work', () => {
  const permitted = { state: 'alarm', audioActionable: true, status: { canSilence: true, silenced: false } }
  assert.equal(hasGlobalActionTarget([permitted], 'silence'), true)
  assert.equal(hasGlobalActionTarget([{ ...permitted, audioActionable: false }], 'silence'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canSilence: true, silenced: true } }], 'silence'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, state: 'emergency' }], 'silence'), false)
})

test('shows global acknowledge for any unacknowledged permitted notification', () => {
  const permitted = { state: 'warn', audioActionable: false, status: { canAcknowledge: true, acknowledged: false } }
  assert.equal(hasGlobalActionTarget([permitted], 'acknowledge'), true)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canAcknowledge: true, acknowledged: true } }], 'acknowledge'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canAcknowledge: false, acknowledged: false } }], 'acknowledge'), false)
})
