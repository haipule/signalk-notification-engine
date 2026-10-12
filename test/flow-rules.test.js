'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const { extractActiveRules, normalizeFlowRules, rulesMarkdown, validateRules } = require('../lib/flow-rules')

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

test('extracts one connected execute path without a redundant activation flag', () => {
  const flow = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"alarm"}', wires: [['execute']] },
    { id: 'execute', type: 'change', rules: [{ t: 'set', p: 'payload.execute', pt: 'msg', to: '/home/pi/scripts/SignalK/testscript_time.sh', tot: 'str' }, { t: 'set', p: 'payload.execute_task', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'unused', type: 'change', rules: [{ t: 'set', p: 'payload.execute', pt: 'msg', to: '/opt/unused.sh', tot: 'str' }], wires: [[]] }
  ]

  assert.deepEqual(validateRules(extractActiveRules(flow)), [{
    id: 'alarm-1', match: { state: 'alarm' }, actions: { execute: '/home/pi/scripts/SignalK/testscript_time.sh' }
  }])
})

test('rejects execute values that are not one exact absolute path', () => {
  const rule = execute => ({ id: 'alarm-1', match: { state: 'alarm' }, actions: { execute } })
  assert.throws(() => validateRules([rule('relative.sh')]), /invalid execute path/)
  assert.throws(() => validateRules([rule('/opt/task.sh ')]), /invalid execute path/)
  assert.throws(() => validateRules([rule(true)]), /invalid execute path/)
  assert.doesNotThrow(() => validateRules([rule('/opt/task.sh')]))
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

test('preserves an explicit inactive sound branch through policy normalization', () => {
  const flow = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"warn"}', wires: [['inactive']] },
    { id: 'inactive', type: 'change', rules: [{ t: 'set', p: 'payload.sound.active', pt: 'msg', to: 'false', tot: 'bool' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  const extracted = extractActiveRules(flow)
  assert.deepEqual(extracted, [{ id: 'warn-1', match: { state: 'warn' }, actions: { sound: { active: false } } }])
  assert.deepEqual(normalizeFlowRules(extracted), [{
    name: 'warn-1',
    state: 'warn',
    match: { state: 'warn', path: undefined },
    audio: 'on',
    sound: { active: false, count: 1 }
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

test('extracts canonical sound counts without mixing independent branches', () => {
  const flow = [
    { id: 'warn', type: 'inject', payloadType: 'json', payload: '{"state":"warn"}', wires: [['finite'], ['loop']] },
    { id: 'finite', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'finite.wav', tot: 'str' }, { t: 'set', p: 'payload.sound.count', pt: 'msg', to: '3', tot: 'num' }, { t: 'set', p: 'payload.sound.pauseSeconds', pt: 'msg', to: '2', tot: 'num' }], wires: [['activate']] },
    { id: 'loop', type: 'change', rules: [{ t: 'set', p: 'payload.match.path', pt: 'msg', to: 'notifications.loop', tot: 'str' }, { t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'loop.wav', tot: 'str' }, { t: 'set', p: 'payload.sound.count', pt: 'msg', to: '0', tot: 'num' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  const rules = validateRules(extractActiveRules(flow))
  assert.deepEqual(normalizeFlowRules(rules).map(rule => rule.sound), [
    { active: true, file: 'loop.wav', count: 0 },
    { active: true, file: 'finite.wav', count: 3, pauseSeconds: 2 }
  ])
})

test('rejects invalid and conflicting canonical sound counts', () => {
  const base = { id: 'warn-1', match: { state: 'warn' }, actions: { soundFile: 'warn.wav', sound: { count: 100 } } }
  assert.throws(() => validateRules([base]), /integer from 0 to 99/)
  assert.throws(() => validateRules([{ ...base, actions: { ...base.actions, sound: { count: 0, mode: 'once' } } }]), /conflicts/)
  assert.throws(() => validateRules([{ ...base, actions: { ...base.actions, sound: { count: 3, pauseSeconds: 6 } } }]), /integer from 0 to 5/)
})

test('rejects an explicitly empty active sound file and permits explicit deactivation', () => {
  const rule = soundFile => ({
    id: 'warn-1',
    match: { state: 'warn' },
    actions: { soundFile }
  })

  assert.throws(() => validateRules([rule('')]), /empty active sound file/)
  assert.throws(() => validateRules([rule('   ')]), /empty active sound file/)
  assert.throws(() => validateRules([{
    id: 'warn-1',
    match: { state: 'warn' },
    actions: { sound: { active: true, file: '' } }
  }]), /empty active sound file/)
  assert.doesNotThrow(() => validateRules([{
    id: 'warn-1',
    match: { state: 'warn' },
    actions: { sound: { active: false, file: '' } }
  }]))
})

test('rejects an invalid pauseSeconds literal from a function node', () => {
  const flow = [
    { id: 'warn', type: 'inject', payloadType: 'json', payload: '{"state":"warn"}', wires: [['sound']] },
    { id: 'sound', type: 'function', func: 'msg.payload.soundFile = "speech.wav"; msg.payload.sound.count = 3; msg.payload.sound.pauseSeconds = "3"; return msg;', wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.throws(() => validateRules(extractActiveRules(flow)), /integer from 0 to 5/)
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

test('canonicalizes known notification states and rejects unknown states', () => {
  const known = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: JSON.stringify({ state: 'WARN' }), wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [] }
  ]
  assert.equal(extractActiveRules(known)[0].match.state, 'warn')

  const unknown = structuredClone(known)
  unknown[0].payload = JSON.stringify({ state: 'Info' })
  assert.throws(() => extractActiveRules(unknown), /Invalid notification state 'Info'/)
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

test('supports separate rules ending at separate Activate nodes', () => {
  const flow = [
    { id: 'warn', type: 'inject', payloadType: 'json', payload: '{"state":"warn"}', wires: [['warn-table']] },
    { id: 'alarm', type: 'inject', payloadType: 'json', payload: '{"state":"alarm"}', wires: [['alarm-table']] },
    { id: 'warn-table', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate-warn']] },
    { id: 'alarm-table', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate-alarm']] },
    { id: 'activate-warn', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'activate-alarm', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.deepEqual(extractActiveRules(flow), [
    { id: 'warn-1', match: { state: 'warn' }, actions: { visibleInTable: true } },
    { id: 'alarm-2', match: { state: 'alarm' }, actions: { visibleInTable: true } }
  ])
})

test('deduplicates one complete branch fanned out to multiple Activate nodes', () => {
  const flow = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"alert"}', wires: [['table']] },
    { id: 'table', type: 'change', rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate-a', 'activate-b']] },
    { id: 'activate-a', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'activate-b', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.deepEqual(extractActiveRules(flow), [
    { id: 'alert-1', match: { state: 'alert' }, actions: { visibleInTable: true } }
  ])
})

test('merges complementary same-scope branches including nested sound fields', () => {
  const flow = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"alarm"}', wires: [['sound-file'], ['sound-count'], ['history']] },
    { id: 'sound-file', type: 'change', rules: [{ t: 'set', p: 'payload.sound.file', pt: 'msg', to: 'alarm.wav', tot: 'str' }], wires: [['activate-a']] },
    { id: 'sound-count', type: 'change', rules: [{ t: 'set', p: 'payload.sound.count', pt: 'msg', to: '3', tot: 'num' }], wires: [['activate-b']] },
    { id: 'history', type: 'change', rules: [{ t: 'set', p: 'payload.history', pt: 'msg', to: 'true', tot: 'bool' }], wires: [['activate-b']] },
    { id: 'activate-a', type: 'debug', name: 'Activate', wires: [[]] },
    { id: 'activate-b', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.deepEqual(extractActiveRules(flow), [{
    id: 'alarm-1',
    match: { state: 'alarm' },
    actions: { sound: { file: 'alarm.wav', count: 3 }, history: true }
  }])
})

test('rejects conflicting same-scope parallel assignments independent of flow order', () => {
  const branch = value => ({
    id: `table-${value}`,
    type: 'change',
    rules: [{ t: 'set', p: 'payload.visibleInTable', pt: 'msg', to: String(value), tot: 'bool' }],
    wires: [['activate']]
  })
  const build = branches => [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"alarm"}', wires: [branches.map(node => node.id)] },
    ...branches,
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.throws(() => extractActiveRules(build([branch(true), branch(false)])), /Conflicting parallel assignments.*actions\.visibleInTable/)
  assert.throws(() => extractActiveRules(build([branch(false), branch(true)])), /Conflicting parallel assignments.*actions\.visibleInTable/)
})

test('rejects conflicting legacy and canonical sound file assignments', () => {
  const flow = [
    { id: 'source', type: 'inject', payloadType: 'json', payload: '{"state":"alarm"}', wires: [['legacy'], ['canonical']] },
    { id: 'legacy', type: 'change', rules: [{ t: 'set', p: 'payload.soundFile', pt: 'msg', to: 'old.wav', tot: 'str' }], wires: [['activate']] },
    { id: 'canonical', type: 'change', rules: [{ t: 'set', p: 'payload.sound.file', pt: 'msg', to: 'new.wav', tot: 'str' }], wires: [['activate']] },
    { id: 'activate', type: 'debug', name: 'Activate', wires: [[]] }
  ]

  assert.throws(() => validateRules(extractActiveRules(flow)), /conflicting sound file assignments/)
  flow[2].rules[0].to = 'old.wav'
  assert.doesNotThrow(() => validateRules(extractActiveRules(flow)))
})

test('rejects a flow without an active rule', () => {
  assert.throws(() => validateRules([]), /No active/)
})

test('creates a readable rule description', () => {
  const text = rulesMarkdown([{ id: 'anchor-alarm', match: { state: 'alarm', path: 'notifications.navigation.anchor' }, actions: { history: true } }], 'r1')
  assert.match(text, /anchor-alarm/)
  assert.match(text, /notifications\.navigation\.anchor/)
})
