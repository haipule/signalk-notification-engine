'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const NotificationStore = require('../lib/notification-store')
const classify = require('../lib/classifier')
const { endsLifecycle } = require('../lib/lifecycle-rules')

test('reconstructs records from a Signal K notification snapshot', () => {
  const store = new NotificationStore({ classify })
  store.replaceSnapshot({
    'alarm-1': {
      path: 'notifications.navigation.anchor',
      value: { id: 'alarm-1', state: 'alarm', message: 'Anchor dragging' }
    }
  })

  assert.equal(store.size, 1)
  assert.deepEqual(store.list()[0].category, 'ANCHOR')
  assert.equal(store.list()[0].state, 'alarm')
})

test('updates and removes records from notification deltas', () => {
  const store = new NotificationStore({ classify })
  store.applyDelta({
    updates: [{
      source: { label: 'collision-detector' },
      values: [{
        path: 'notifications.custom.collision',
        value: { id: 'collision-1', state: 'warn', message: 'Target close' }
      }]
    }]
  })

  assert.equal(store.list()[0].category, 'COLLISION')
  store.applyDelta({ updates: [{ values: [{ path: 'notifications.custom.collision', value: null }] }] })
  assert.equal(store.size, 0)
  assert.equal(store.history()[0].type, 'cleared')
})

test('normalizes string and $source delta representations', () => {
  const store = new NotificationStore({ classify })
  store.applyDelta({ updates: [{ $source: 'fallback-source', values: [{
    path: 'notifications.custom.engine',
    value: { id: 'engine-1', state: 'warn', message: 'Oil temperature' }
  }] }] })
  assert.deepEqual(store.list()[0].source, { label: 'fallback-source' })

  store.applyDelta({ updates: [{ source: { $source: 'self.notificationhandler' }, values: [{
    path: 'notifications.custom.engine',
    value: { id: 'engine-1', state: 'alarm', message: 'Oil temperature high' }
  }] }] })
  assert.deepEqual(store.list()[0].source, { label: 'self.notificationhandler' })
})

test('reads a source embedded on the notification value', () => {
  const store = new NotificationStore({ classify })
  store.applyDelta({ updates: [{ values: [{
    path: 'notifications.propulsion.portEngine.transmission.oilTemperature',
    value: {
      id: 'oil-1',
      state: 'normal',
      message: 'OK',
      $source: 'engineroomPort.XX'
    }
  }] }] })

  assert.deepEqual(store.list()[0].source, { label: 'engineroomPort.XX' })
})

test('prefers the producer source in a delta over the handler source', () => {
  const store = new NotificationStore({ classify })
  store.applyDelta({ updates: [{
    source: { label: 'self.notificationhandler' },
    values: [{
      path: 'notifications.propulsion.portEngine.transmission.oilTemperature',
      value: {
        id: 'oil-2',
        state: 'normal',
        data: { source: 'engineroomPort.XX' }
      }
    }]
  }] })

  assert.deepEqual(store.list()[0].source, { label: 'engineroomPort.XX' })
})

test('does not record an audit update when a snapshot value is unchanged', () => {
  const store = new NotificationStore({ classify })
  const snapshot = {
    'alarm-1': { path: 'notifications.system.example', value: { id: 'alarm-1', state: 'normal', message: 'OK' } }
  }

  store.replaceSnapshot(snapshot)
  store.replaceSnapshot(snapshot)

  assert.equal(store.history().length, 1)
})

test('preserves a known source when a later snapshot omits it', () => {
  const store = new NotificationStore({ classify })
  store.replaceSnapshot({
    'alarm-1': {
      path: 'notifications.custom.engine',
      source: { label: 'engine-monitor' },
      value: { id: 'alarm-1', state: 'alarm', message: 'Overheat' }
    }
  })

  store.replaceSnapshot({
    'alarm-1': {
      path: 'notifications.custom.engine',
      source: null,
      value: { id: 'alarm-1', state: 'alarm', message: 'Overheat' }
    }
  })

  assert.deepEqual(store.list()[0].source, { label: 'engine-monitor' })
})

test('starts a new occurrence after a configured lifecycle end marker', () => {
  const rules = [{ source: 'hoekens-anchor-alarm', path: 'notifications.navigation.anchor', endWhen: { state: 'normal', message: 'Off' } }]
  const store = new NotificationStore({ classify, lifecycleRules: rules, endsLifecycle })
  const emit = (state, message) => store.applyDelta({ updates: [{ source: { label: 'hoekens-anchor-alarm' }, values: [{ path: 'notifications.navigation.anchor', value: { id: 'same-id', state, message } }] }] })
  emit('alarm', 'Dragging')
  const first = store.list()[0].occurrenceId
  emit('normal', 'Off')
  emit('alarm', 'Dragging')
  assert.notEqual(store.list()[0].occurrenceId, first)
  assert.equal(store.history()[0].type, 'raised')
})

test('keeps one occurrence when a notification id changes', () => {
  const store = new NotificationStore({ classify })
  store.applyDelta({ updates: [{ source: { label: 'watcher' }, values: [{
    path: 'notifications.custom.anchor',
    value: { id: 'old-id', state: 'alarm', message: 'Dragging' }
  }] }] })
  const first = store.list()[0]

  store.applyDelta({ updates: [{ source: { label: 'watcher' }, values: [{
    path: 'notifications.custom.anchor',
    value: { id: 'new-id', state: 'alarm', message: 'Still dragging' }
  }] }] })

  const current = store.list()[0]
  assert.equal(store.size, 1)
  assert.equal(current.id, 'new-id')
  assert.equal(current.occurrenceId, first.occurrenceId)
  assert.equal(current.firstSeenAt, first.firstSeenAt)
  assert.equal(store.history()[0].notification.occurrenceId, first.occurrenceId)
})

test('does not record an audit update for position-only changes', () => {
  const store = new NotificationStore({ classify })
  const update = position => ({ updates: [{ values: [{
    path: 'notifications.custom.anchor',
    value: { id: 'anchor-1', state: 'alarm', message: 'Dragging', position }
  }] }] })

  store.applyDelta(update({ latitude: 1, longitude: 2 }))
  store.applyDelta(update({ latitude: 3, longitude: 4 }))

  assert.equal(store.list()[0].position.latitude, 3)
  assert.equal(store.history().length, 1)
})

test('records the notification lifecycle from detection to resolution', () => {
  const store = new NotificationStore({ classify })
  const delta = state => ({ updates: [{ values: [{
    path: 'notifications.custom.engine',
    value: { id: 'engine-1', state, message: state === 'alarm' ? 'Overheat' : 'OK' }
  }] }] })

  store.applyDelta(delta('alarm'))
  store.applyDelta(delta('normal'))
  store.applyDelta({ updates: [{ values: [{ path: 'notifications.custom.engine', value: null }] }] })

  assert.deepEqual(store.history().map(event => event.type), ['cleared', 'updated', 'raised'])
  assert.equal(new Set(store.history().map(event => event.notification.occurrenceId)).size, 1)
})

test('notifies audio consumers even when history recording is disabled', () => {
  const changes = []
  const store = new NotificationStore({ classify, onChange: event => changes.push(event), shouldRecord: () => false })

  store.applyDelta({ updates: [{ values: [{
    path: 'notifications.custom.alert',
    value: { id: 'alert-1', state: 'alert', message: 'Alert' }
  }] }] })

  assert.equal(changes.length, 1)
  assert.equal(changes[0].type, 'raised')
  assert.equal(store.history().length, 0)
})
