'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { hasGlobalActionTarget, globalActionTargetIds } = require('../public/global-actions')

test('shows global silence only for unfinished permitted audio work', () => {
  const permitted = { id: 'alarm-1', state: 'alarm', actionManaged: true, audioActionable: true, status: { canSilence: true, silenced: false } }
  assert.equal(hasGlobalActionTarget([permitted], 'silence'), true)
  assert.equal(hasGlobalActionTarget([{ ...permitted, audioActionable: false }], 'silence'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canSilence: true, silenced: true } }], 'silence'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, state: 'emergency' }], 'silence'), false)
})

test('shows global acknowledge for any unacknowledged permitted notification', () => {
  const permitted = { id: 'warn-1', state: 'warn', actionManaged: true, audioActionable: false, status: { canAcknowledge: true, acknowledged: false } }
  assert.equal(hasGlobalActionTarget([permitted], 'acknowledge'), true)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canAcknowledge: true, acknowledged: true } }], 'acknowledge'), false)
  assert.equal(hasGlobalActionTarget([{ ...permitted, status: { canAcknowledge: false, acknowledged: false } }], 'acknowledge'), false)
})

test('returns only exact eligible visible IDs for a bulk action', () => {
  const visible = [
    { id: 'visible-warn', state: 'warn', actionManaged: true, status: { canAcknowledge: true, acknowledged: false } },
    { id: 'already-acknowledged', state: 'warn', actionManaged: true, status: { canAcknowledge: true, acknowledged: true } },
    { id: 'missing-permission', state: 'warn', actionManaged: true, status: { canAcknowledge: false, acknowledged: false } }
  ]
  assert.deepEqual(globalActionTargetIds(visible, 'acknowledge'), ['visible-warn'])
})

test('does not create a bulk acknowledge target from records omitted by the table', () => {
  const hiddenNormal = { id: 'hidden-normal', state: 'normal', actionManaged: true, status: { canAcknowledge: true, acknowledged: false } }
  assert.equal(hasGlobalActionTarget([], 'acknowledge'), false)
  assert.deepEqual(globalActionTargetIds([], 'acknowledge'), [])
  assert.equal(hasGlobalActionTarget([hiddenNormal], 'acknowledge'), true)
  assert.deepEqual(globalActionTargetIds([hiddenNormal], 'acknowledge'), ['hidden-normal'])
})

test('follows Signal K acknowledgement permission for normal and nominal table records', () => {
  const records = ['normal', 'nominal'].map(state => ({
    id: state, state, actionManaged: true, status: { canAcknowledge: true, acknowledged: false }
  }))
  assert.deepEqual(globalActionTargetIds(records, 'acknowledge'), ['normal', 'nominal'])
})
