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
  assert.deepEqual(extractActiveRules(flow), [{ id: 'alarm-1', match: { state: 'alarm', path: 'notifications.navigation.anchor' }, actions: { soundFile: '2bells.wav' } }])
})

test('does not force history for emergency and alarm', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'emergency'}; return msg;", wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.equal(extractActiveRules(flow)[0].actions.history, undefined)
})


test('extracts sound and loop settings from connected function nodes', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'warn'}; return msg;", wires: [['sound']] },
    { id: 'sound', type: 'function', func: "msg.payload.soundFile='/home/pi/.signalk/sounds/1bells.wav'; msg.payload.soundMode='loop'; return msg;", wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [{
    id: 'warn-1',
    match: { state: 'warn' },
    actions: { soundFile: '/home/pi/.signalk/sounds/1bells.wav', soundMode: 'loop' }
  }])
})


test('path-specific sound overrides a general state sound', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'warn'}; return msg;", wires: [['path'], ['general']] },
    { id: 'general', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'beep.wav', tot: 'str' }, { t: 'set', p: 'payload.sound.mode', pt: 'msg', to: 'repeat', tot: 'str' }], wires: [['a']] },
    { id: 'path', type: 'change', rules: [{ t: 'set', p: 'payload.match.path', pt: 'msg', to: 'notifications.navigation.anchor', tot: 'str' }, { t: 'set', p: 'payload.soundFile', pt: 'msg', to: '1bells.wav', tot: 'str' }, { t: 'set', p: 'payload.sound.mode', pt: 'msg', to: 'loop', tot: 'str' }], wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [
    {
      id: 'warn-1',
      match: { state: 'warn', path: 'notifications.navigation.anchor' },
      actions: { soundFile: '1bells.wav', sound: { mode: 'loop' } }
    },
    {
      id: 'warn-2',
      match: { state: 'warn' },
      actions: { soundFile: 'beep.wav', sound: { mode: 'repeat' } }
    }
  ])
})

test('uses payload.state from an inject node without depending on its type', () => {
  const flow = [
    { id: 'n', type: 'inject', payloadType: 'json', payload: '{"state":"alert"}', wires: [['table']] },
    { id: 'table', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [{
    id: 'alert-1',
    match: { state: 'alert' },
    actions: { visibleInTable: true }
  }])
})

test('keeps conditions attached only to their branch and preserves all conditions', () => {
  const flow = [
    { id: 'n', type: 'inject', payloadType: 'json', payload: '{"state":"warn"}', wires: [['short'], ['long']] },
    { id: 'short', type: 'change', rules: [{ t: 'set', p: 'payload.match.conditions', pt: 'msg', to: { path: 'propulsion.portEngine.state', operator: 'eq', value: 'started' }, tot: 'json' }], wires: [['short-action']] },
    { id: 'short-action', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'short.wav', tot: 'str' }], wires: [['a']] },
    { id: 'long', type: 'change', rules: [{ t: 'set', p: 'payload.match.conditions', pt: 'msg', to: [{ path: 'propulsion.portEngine.state', operator: 'eq', value: 'started' }, { path: 'electrical.batteries.house.voltage', operator: '<', value: 12 }], tot: 'json' }], wires: [['long-action']] },
    { id: 'long-action', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'long.wav', tot: 'str' }], wires: [['a']] },
    { id: 'a', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [
    {
      id: 'warn-1',
      match: { state: 'warn', conditions: [{ path: 'propulsion.portEngine.state', operator: 'eq', value: 'started' }] },
      actions: { soundFile: 'short.wav' }
    },
    {
      id: 'warn-2',
      match: { state: 'warn', conditions: [{ path: 'propulsion.portEngine.state', operator: 'eq', value: 'started' }, { path: 'electrical.batteries.house.voltage', operator: '<', value: 12 }] },
      actions: { soundFile: 'long.wav' }
    }
  ])
})

test('keeps an ignore action only on a connected path rule', () => {
  const flow = [
    { id: 'n', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['path']] },
    { id: 'path', type: 'change', rules: [{ t: 'set', p: 'payload.match.path', pt: 'msg', to: 'notifications.environment.bilgeWater.port', tot: 'str' }], wires: [['ignore']] },
    { id: 'ignore', type: 'change', rules: [{ t: 'set', p: 'payload.ignore', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'unused-ignore', type: 'change', rules: [{ t: 'set', p: 'payload.ignore', pt: 'msg', to: 'true', tot: 'bool' }], wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [{
    id: 'alarm-1',
    match: { state: 'alarm', path: 'notifications.environment.bilgeWater.port' },
    actions: { ignore: true }
  }])
})

test('does not merge a disconnected branch from the same notification source', () => {
  const flow = [
    { id: 'source', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['active'], ['path']] },
    { id: 'active', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate']] },
    { id: 'path', type: 'change', rules: [{ t: 'set', p: 'payload.match.path', pt: 'msg', to: 'notifications.environment.bilgeWater.port', tot: 'str' }], wires: [['ignore']] },
    { id: 'ignore', type: 'change', rules: [{ t: 'set', p: 'payload.ignore', pt: 'msg', to: 'true', tot: 'bool' }], wires: [[]] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [{
    id: 'alarm-1',
    match: { state: 'alarm' },
    actions: { visibleInTable: true }
  }])
})

test('does not merge properties from separate notification branches', () => {
  const flow = [
    { id: 'alarm', type: 'function', func: "msg.payload={state:'alarm'}; return msg;", wires: [['sound']] },
    { id: 'normal', type: 'function', func: "msg.payload={state:'normal'}; return msg;", wires: [['table']] },
    { id: 'sound', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'alarm.wav', tot: 'str' }], wires: [['activate']] },
    { id: 'table', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]
  assert.deepEqual(extractActiveRules(flow), [
    { id: 'alarm-1', match: { state: 'alarm' }, actions: { soundFile: 'alarm.wav' } },
    { id: 'normal-2', match: { state: 'normal' }, actions: { visibleInTable: true } }
  ])
})

test('rejects a flow without an active rule', () => {
  assert.throws(() => validateRules([]), /No active/)
})

test('creates a readable rule description', () => {
  const text = rulesMarkdown([{ id: 'anchor-alarm', match: { state: 'alarm', path: 'notifications.navigation.anchor' }, actions: { history: true } }], 'r1')
  assert.match(text, /anchor-alarm/)
  assert.match(text, /notifications\.navigation\.anchor/)
})
