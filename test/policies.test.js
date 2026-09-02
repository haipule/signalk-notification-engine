'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { PolicyResolver } = require('../lib/policies')

test('uses the first matching policy and preserves Signal K state', () => {
  const resolver = new PolicyResolver([
    { name: 'Anchor night mode', match: { category: 'ANCHOR', source: 'anchor' }, priority: 'critical', audio: 'on' },
    { name: 'All system', match: { category: 'SYSTEM', source: 'system' }, priority: 'low' }
  ])
  const notification = { category: 'ANCHOR', path: 'notifications.navigation.anchor', source: { label: 'anchor' }, state: 'alarm' }

  assert.deepEqual(resolver.resolve(notification), {
    priority: 'critical', audio: 'on', sound: null, soundConfig: null, visible: true, matchedPolicy: 'Anchor night mode'
  })
  assert.equal(notification.state, 'alarm')
})

test('derives a safe priority when no policy matches', () => {
  const resolver = new PolicyResolver()

  assert.equal(resolver.resolve({ category: 'OTHER', path: 'notifications.x', state: 'warn' }).priority, 'high')
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

  assert.equal(resolver.resolve({ category: 'SYSTEM', path: 'notifications.system.diagnostic', source: { label: 'diagnostic-plugin' }, state: 'warn' }).visible, false)
})
