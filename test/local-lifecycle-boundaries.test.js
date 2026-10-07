'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const classify = require('../lib/classifier')
const { applyLifecycleBoundary, lifecycleBoundaryPaths } = require('../lib/local-lifecycle-boundaries')
const NotificationStore = require('../lib/notification-store')

function anchorUpdate(state = 'normal', message = '') {
  return {
    id: 'shared-anchor-id',
    path: 'notifications.navigation.anchor',
    source: { label: 'hoekens-anchor-alarm' },
    value: { id: 'shared-anchor-id', state, message }
  }
}

test('exposes the authoritative anchor state subscription path', () => {
  assert.deepEqual(lifecycleBoundaryPaths(), ['navigation.anchor.state'])
})

test('anchor off ends only the local occurrence and remains idempotent', () => {
  const changes = []
  const store = new NotificationStore({ classify, onChange: event => changes.push(event) })
  store.upsert(anchorUpdate('alarm', 'Anchor dragging'))
  const first = store.list()[0]

  assert.equal(applyLifecycleBoundary(store, 'navigation.anchor.state', 'off'), 1)
  assert.equal(applyLifecycleBoundary(store, 'navigation.anchor.state', 'off'), 0)

  const ended = store.list()[0]
  assert.equal(ended.id, first.id)
  assert.equal(ended.state, 'alarm')
  assert.equal(ended.occurrenceId, first.occurrenceId)
  assert.equal(ended.localLifecycleEnded, true)
  assert.deepEqual(changes.map(event => event.type), ['raised', 'local_lifecycle_ended'])
  assert.equal(store.history()[0].type, 'local_lifecycle_ended')
})

test('repeated snapshots while off do not create a false occurrence', () => {
  const store = new NotificationStore({ classify })
  store.upsert(anchorUpdate())
  const firstOccurrence = store.list()[0].occurrenceId
  applyLifecycleBoundary(store, 'navigation.anchor.state', 'off')
  store.upsert(anchorUpdate())

  assert.equal(store.list()[0].occurrenceId, firstOccurrence)
  assert.equal(store.list()[0].localLifecycleEnded, true)
})

test('a removed anchor state value is the live inactive boundary', () => {
  const store = new NotificationStore({ classify })
  store.upsert(anchorUpdate())

  assert.equal(applyLifecycleBoundary(store, 'navigation.anchor.state', null), 1)
  assert.equal(store.list()[0].localLifecycleEnded, true)
})

test('anchor on arms the next authoritative update as a fresh occurrence', () => {
  const store = new NotificationStore({ classify })
  store.upsert(anchorUpdate())
  const firstOccurrence = store.list()[0].occurrenceId
  applyLifecycleBoundary(store, 'navigation.anchor.state', 'off')
  applyLifecycleBoundary(store, 'navigation.anchor.state', 'on')

  assert.equal(store.list()[0].state, 'normal')
  store.upsert(anchorUpdate('normal', 'Watching'))
  assert.notEqual(store.list()[0].occurrenceId, firstOccurrence)
  assert.equal(store.history()[0].type, 'raised')
})

test('anchor boundary does not affect unrelated notifications or inputs', () => {
  const store = new NotificationStore({ classify })
  store.upsert({ id: 'bilge', path: 'notifications.environment.bilge', value: { id: 'bilge', state: 'alarm' } })

  assert.equal(applyLifecycleBoundary(store, 'navigation.anchor.state', 'off'), 0)
  assert.equal(applyLifecycleBoundary(store, 'navigation.position', 'off'), 0)
  assert.equal(store.list()[0].localLifecycleEnded, false)
})
