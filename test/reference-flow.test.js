'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { extractActiveRules, validateRules } = require('../lib/flow-rules')

const flowPath = path.join(__dirname, '..', 'node-red', 'notification-engine-release-flow.json')

function loadFlow() {
  return JSON.parse(fs.readFileSync(flowPath, 'utf8'))
}

test('Node-RED 4 visual-only fixture contains complete inject defaults', () => {
  const fixturePath = path.join(__dirname, '..', 'node-red', 'test-fixtures', 'visual-only-alert-node-red-4.json')
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  const inject = fixture.find(node => node.type === 'inject')
  assert.ok(inject)
  for (const field of ['repeat', 'crontab', 'once', 'onceDelay', 'topic']) {
    assert.equal(Object.hasOwn(inject, field), true, `missing Node-RED 4 inject field ${field}`)
  }
  assert.equal(fixture.some(node => node.name === 'TEMP: sound inactive'), true)
  assert.equal(fixture.every(node => node.z === 'tab-adjective-mapping'), true)
})

test('release reference flow is importable and entirely inactive by default', () => {
  const flow = loadFlow()
  assert.ok(Array.isArray(flow))
  assert.equal(new Set(flow.map(node => node.id)).size, flow.length)
  assert.deepEqual(extractActiveRules(flow), [])
  assert.throws(() => validateRules(extractActiveRules(flow)), /No active notification rule/)
})

test('release flow requires direct tab selection and contains no legacy config node', () => {
  const flow = loadFlow()
  const tab = flow.find(node => node.type === 'tab' && node.id === 'notification-engine-release-flow')
  assert.match(tab.info, /Rule Builder Flow/)
  assert.match(tab.info, /stable ID/)
  assert.match(tab.info, /connect at least one intended complete branch.*deploy/i)
  assert.equal(flow.some(node => node.name === 'Notification Engine config'), false)
})

test('every instructional release-flow node has useful English info', () => {
  const flow = loadFlow()
  const instructional = flow.filter(node => !['tab', 'group'].includes(node.type))
  for (const node of instructional) {
    assert.equal(typeof node.info, 'string', `${node.id} has no info`)
    assert.ok(node.info.trim().length >= 80, `${node.id} info is too short`)
  }
  assert.match(flow.find(node => node.type === 'tab').info, /No rule .* active by default/i)
})

test('release flow groups every instructional node exactly once', () => {
  const flow = loadFlow()
  const groups = flow.filter(node => node.type === 'group')
  assert.deepEqual(groups.map(group => group.name), [
    'Instructions - open each comment for details',
    'Quick Start - connect the final wire deliberately',
    'Notification States',
    'Match Scope',
    'Display and History',
    'Sound - disconnected by default',
    'Control and External Delivery'
  ])

  const members = groups.flatMap(group => group.nodes)
  assert.equal(new Set(members).size, members.length)
  const instructional = flow.filter(node => !['tab', 'group'].includes(node.type))
  assert.deepEqual(new Set(members), new Set(instructional.map(node => node.id)))
  for (const node of instructional) {
    const owner = groups.find(group => group.id === node.g)
    assert.ok(owner?.nodes.includes(node.id), `${node.id} has no matching group`)
  }
})

test('connecting only the documented Quick Start final wire creates one safe alert rule', () => {
  const flow = loadFlow()
  const table = flow.find(node => node.id === 'ne-quick-table')
  table.wires = [['ne-activate']]

  assert.deepEqual(validateRules(extractActiveRules(flow)), [{
    id: 'alert-1',
    match: { state: 'alert' },
    actions: { visibleInTable: true }
  }])
})

test('release flow contains every documented builder option without obsolete flags', () => {
  const flow = loadFlow()
  const text = JSON.stringify(flow.flatMap(node => node.rules || []))
  const required = [
    'payload.match.path',
    'payload.match.conditions',
    'payload.visibleInTable',
    'payload.display',
    'payload.color',
    'payload.hex',
    'payload.flash',
    'payload.history',
    'payload.sound.active',
    'payload.soundFile',
    'payload.sound.count',
    'payload.sound.pauseSeconds',
    'payload.ignore',
    'payload.execute'
  ]
  for (const field of required) assert.match(text, new RegExp(field.replaceAll('.', '\\.')))
  assert.doesNotMatch(text, /execute_task/)
  assert.doesNotMatch(text, /payload\.category/)
})
