'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { PolicyResolver } = require('../lib/policies')

test('uses the first matching policy and preserves Signal K state', () => {
  const resolver = new PolicyResolver([
    { name: 'Anchor night mode', match: { pathPrefix: 'notifications.navigation', source: 'anchor' }, priority: 'critical', audio: 'on' },
    { name: 'All system', match: { pathPrefix: 'notifications.system', source: 'system' }, priority: 'low' }
  ])
  const notification = { path: 'notifications.navigation.anchor', source: { label: 'anchor' }, state: 'alarm' }

  assert.deepEqual(resolver.resolve(notification), {
    priority: 'critical', audio: 'on', sound: null, soundConfig: null, visible: true, matchedPolicy: 'Anchor night mode'
  })
  assert.equal(notification.state, 'alarm')
})

test('derives a safe priority when no policy matches', () => {
  const resolver = new PolicyResolver()

  assert.equal(resolver.resolve({ path: 'notifications.x', state: 'warn' }).priority, 'high')
})

test('resolves state sound by default and allows a specific override', () => {
  const resolver = new PolicyResolver([
    { name: 'GPS alarm sound', match: { pathPrefix: 'notifications.gps' }, sound: 'gps-alarm.wav' }
  ], { alarm: 'alarm.wav', warn: 'warning.wav' })

  assert.equal(resolver.resolve({ path: 'notifications.engine', state: 'alarm' }).sound, 'alarm.wav')
  assert.equal(resolver.resolve({ path: 'notifications.gps.stale', state: 'alarm' }).sound, 'gps-alarm.wav')
  assert.equal(resolver.resolve({ path: 'notifications.engine', state: 'alarm' }).audio, 'inherit')
  assert.equal(new PolicyResolver([{ match: { source: 'engine' }, audio: 'off' }], { alarm: 'alarm.wav' }).resolve({ path: 'notifications.engine', source: { label: 'engine' }, state: 'alarm' }).sound, null)
})

test('allows an explicit policy to hide a known notification from the active view', () => {
  const resolver = new PolicyResolver([
    { name: 'Quiet diagnostic', match: { source: 'diagnostic-plugin' }, visible: false }
  ])

  assert.equal(resolver.resolve({ path: 'notifications.system.diagnostic', source: { label: 'diagnostic-plugin' }, state: 'warn' }).visible, false)
})

test('resolves history independently with an explicit override', () => {
  const resolver = new PolicyResolver([
    { name: 'Visible default', match: { pathPrefix: 'notifications.engine' }, visible: true, history: true },
    { name: 'No history', match: { path: 'notifications.engine.test' }, visible: true, history: false }
  ])

  assert.equal(resolver.resolve({ path: 'notifications.engine.main', state: 'normal' }).history, true)
  assert.equal(resolver.resolve({ path: 'notifications.engine.test', state: 'normal' }).history, false)
})

test('prefers the longer satisfied condition chain in the same scope', () => {
  const resolver = new PolicyResolver([
    { name: 'short', match: { state: 'warn', path: 'notifications.engine', conditions: [{ path: 'engine.state', operator: 'eq', value: 'started' }] }, sound: 'short.wav' },
    { name: 'long', match: { state: 'warn', path: 'notifications.engine', conditions: [{ path: 'engine.state', operator: 'eq', value: 'started' }, { path: 'engine.mode', operator: 'eq', value: 'test' }] }, sound: 'long.wav' }
  ], {}, path => ({ 'engine.state': 'started', 'engine.mode': 'test' }[path]))

  assert.equal(resolver.resolve({ state: 'warn', path: 'notifications.engine' }).matchedPolicy, 'long')
  assert.equal(resolver.resolve({ state: 'warn', path: 'notifications.engine' }).sound, 'long.wav')
})
