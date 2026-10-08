'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { historyForTableNotifications } = require('../public/history-filter')

function event(path, occurrenceId, state = 'normal', source = 'producer', at = '2026-10-08T10:00:00.000Z') {
  return { at, notification: { path, occurrenceId, state, source: { label: source } } }
}

test('shows complete occurrences when at least one event was table-visible', () => {
  const events = [
    event('notifications.navigation.anchor', 'anchor-current', 'warn', 'hoekens-anchor-alarm', '2026-10-08T11:13:44.458Z'),
    event('notifications.navigation.anchor', 'anchor-current', 'normal', 'hoekens-anchor-alarm', '2026-10-08T11:19:42.863Z'),
    event('notifications.navigation.gnss.headingUnavailable', 'gnss-current', 'warn', 'signalk-server', '2026-10-08T12:00:00.000Z'),
    event('notifications.navigation.anchor', 'anchor-old', 'normal', 'hoekens-anchor-alarm', '2026-10-07T12:00:00.000Z'),
    event('notifications.hidden', 'hidden-current', 'normal')
  ]
  const isVisible = notification => ['warn', 'alarm', 'emergency'].includes(notification.state)

  assert.deepEqual(historyForTableNotifications(events, isVisible), [events[2], events[1], events[0]])
})

test('does not expose history when the table has no visible notifications', () => {
  assert.deepEqual(historyForTableNotifications(
    [event('notifications.navigation.anchor', 'anchor')],
    notification => notification.state === 'alarm'
  ), [])
})

test('keeps producers separate for events without an occurrence identity', () => {
  const matching = event('notifications.navigation.anchor', null, 'warn', 'hoekens-anchor-alarm')
  const recovered = event('notifications.navigation.anchor', null, 'normal', 'hoekens-anchor-alarm', '2026-10-08T10:01:00.000Z')
  const otherProducer = event('notifications.navigation.anchor', null, 'normal', 'other')

  assert.deepEqual(historyForTableNotifications(
    [matching, recovered, otherProducer],
    notification => notification.state === 'warn'
  ), [recovered, matching])
})

test('sorts retained table history newest first across reconstructed occurrences', () => {
  const older = event('notifications.navigation.anchor', 'old', 'warn', 'hoekens-anchor-alarm', '2026-10-08T11:13:44.458Z')
  const newest = event('notifications.navigation.anchor', 'current', 'warn', 'hoekens-anchor-alarm', '2026-10-08T18:29:48.000Z')
  const recovered = event('notifications.navigation.anchor', 'old', 'normal', 'hoekens-anchor-alarm', '2026-10-08T11:19:42.863Z')

  assert.deepEqual(historyForTableNotifications(
    [older, newest, recovered],
    notification => notification.state === 'warn'
  ), [newest, recovered, older])
})

test('keeps hidden history controls visually hidden', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8')
  assert.match(style, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/)
})
