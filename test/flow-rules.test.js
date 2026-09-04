'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { extractActiveRules, rulesMarkdown, validateRules } = require('../lib/flow-rules')

test('extracts only the connected rule ending at Activate', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['c']] },
    { id: 'c', type: 'change', rules: [{ t: 'set', p: 'payload.match.path', pt: 'msg', to: 'notifications.navigation.anchor', tot: 'str' }], wires: [['s']] },
    { id: 's', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: '2bells.wav', tot: 'str' }], wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'unused', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'ignored.wav', tot: 'str' }], wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [{ id: 'alarm-1', match: { state: 'alarm', path: 'notifications.navigation.anchor' }, actions: { soundFile: '2bells.wav', history: true } }])
})

test('forces history for emergency and alarm', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'emergency'}; return msg;", wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.equal(extractActiveRules(flow)[0].actions.history, true)
})

test('rejects a flow without an active rule', () => {
  assert.throws(() => validateRules([]), /No active/)
})

test('creates a readable rule description', () => {
  const text = rulesMarkdown([{ id: 'anchor-alarm', match: { state: 'alarm', path: 'notifications.navigation.anchor' }, actions: { history: true } }], 'r1')
  assert.match(text, /anchor-alarm/)
  assert.match(text, /notifications\.navigation\.anchor/)
})
