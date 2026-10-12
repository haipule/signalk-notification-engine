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
  assert.deepEqual(store.list()[0].source, { label: 'fallback-source' })
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

test('does not replace a recovered producer with the notification handler', () => {
  const store = new NotificationStore({ classify })
  store.replaceSnapshot({
    'engine-1': {
      path: 'notifications.propulsion.stbdEngine.exhaustTemperature',
      source: { label: 'engineroomStbd.XX' },
      value: { id: 'engine-1', state: 'nominal', message: 'Normal' }
    }
  })

  store.applyDelta({ updates: [{
    source: { label: 'self.notificationhandler' },
    values: [{
      path: 'notifications.propulsion.stbdEngine.exhaustTemperature',
      value: { id: 'engine-1', state: 'nominal', message: 'Normal' }
    }]
  }] })

  assert.deepEqual(store.list()[0].source, { label: 'engineroomStbd.XX' })
  assert.equal(store.list()[0].historyKey, 'notifications.propulsion.stbdEngine.exhaustTemperature|engineroomStbd.XX')
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

test('records local audit state without replaying notification processing', () => {
  const changes = []
  const events = []
  const store = new NotificationStore({ classify, onChange: event => changes.push(event), onEvent: event => events.push(event) })
  const record = { id: 'one', occurrenceId: 'occurrence-one', path: 'notifications.test', state: 'alarm' }

  store.recordLocalAuditEvent('audio_circuit_opened', record, { circuit: { failureCount: 5 } })

  assert.equal(changes.length, 0)
  assert.equal(events[0].type, 'audio_circuit_opened')
  assert.equal(store.history()[0].circuit.failureCount, 5)
})

test('retains the final hidden normal state once an occurrence entered history', () => {
  const store = new NotificationStore({
    classify,
    shouldRecord: notification => notification.state === 'alarm'
  })
  const delta = state => ({ updates: [{ values: [{
    path: 'notifications.custom.engine',
    value: { id: 'engine-1', state, message: state === 'alarm' ? 'Overheat' : 'OK' }
  }] }] })

  store.applyDelta(delta('alarm'))
  store.applyDelta(delta('normal'))

  assert.deepEqual(store.history().map(event => event.notification.state), ['normal', 'alarm'])
})

test('does not record an initially hidden normal occurrence', () => {
  const store = new NotificationStore({ classify, shouldRecord: notification => notification.state === 'alarm' })
  store.applyDelta({ updates: [{ values: [{
    path: 'notifications.custom.engine',
    value: { id: 'engine-1', state: 'normal', message: 'OK' }
  }] }] })

  assert.equal(store.history().length, 0)
})

test('keeps an initially suppressed occurrence out of history through normal and clear', () => {
  const store = new NotificationStore({
    classify,
    shouldRecord: notification => notification.state === 'normal'
  })
  const delta = value => ({ updates: [{ values: [{
    path: 'notifications.custom.suppressed',
    value
  }] }] })

  store.applyDelta(delta({ id: 'suppressed-1', state: 'alarm', message: 'Alarm' }))
  store.applyDelta(delta({ id: 'suppressed-1', state: 'normal', message: 'OK' }))
  store.applyDelta(delta(null))

  assert.equal(store.history().length, 0)
})

test('re-evaluates history policy for a new occurrence after the prior one ends', () => {
  let enabled = false
  const store = new NotificationStore({ classify, shouldRecord: () => enabled })
  const delta = value => ({ updates: [{ values: [{ path: 'notifications.custom.repeat', value }] }] })

  store.applyDelta(delta({ id: 'repeat-1', state: 'alarm', message: 'First' }))
  store.applyDelta(delta(null))
  enabled = true
  store.applyDelta(delta({ id: 'repeat-2', state: 'alarm', message: 'Second' }))

  assert.equal(store.history().length, 1)
  assert.equal(store.history()[0].notification.message, 'Second')
})

test('preserves a suppressed occurrence decision across exact restart correlation', () => {
  const original = new NotificationStore({ classify, shouldRecord: () => false })
  const active = { updates: [{ source: { label: 'sensor' }, values: [{
    path: 'notifications.custom.restart-suppressed',
    value: { id: 'restart-suppressed-1', state: 'alarm', message: 'Alarm' }
  }] }] }
  original.applyDelta(active)
  const saved = original.restartSnapshot()
  assert.equal(saved[0].historyRecording, false)

  const restored = new NotificationStore({ classify, shouldRecord: () => true })
  restored.restoreExactOccurrences(saved)
  restored.applyDelta(active)
  restored.applyDelta({ updates: [{ source: { label: 'sensor' }, values: [{
    path: 'notifications.custom.restart-suppressed',
    value: { id: 'restart-suppressed-1', state: 'normal', message: 'OK' }
  }] }] })

  assert.equal(restored.list()[0].occurrenceId, saved[0].occurrenceId)
  assert.equal(restored.list()[0].historyRecording, false)
  assert.equal(restored.history().length, 0)
})

test('restores an occurrence only for an exactly identical notification', () => {
  const original = {
    id: 'same-id', path: 'notifications.navigation.heading', source: { label: 'gnss' },
    state: 'warn', message: 'Heading unavailable', method: ['visual'], createdAt: null,
    data: { reason: 'missing' }, status: { acknowledged: false },
    occurrenceId: 'occurrence-before-restart', firstSeenAt: '2026-10-07T00:00:00.000Z'
  }
  const store = new NotificationStore({ classify })
  store.restoreExactOccurrences([original])
  store.applyDelta({ updates: [{ source: { label: 'gnss' }, values: [{
    path: original.path,
    value: {
      id: original.id, state: original.state, message: original.message,
      method: original.method, data: original.data, status: original.status
    }
  }] }] })

  assert.equal(store.list()[0].occurrenceId, original.occurrenceId)
  assert.equal(store.history().length, 0)
})

test('treats reordered authoritative object keys as the same exact notification', () => {
  const original = new NotificationStore({ classify })
  original.applyDelta({ updates: [{ source: { label: 'gnss' }, values: [{
    path: 'notifications.navigation.heading',
    value: {
      id: 'stable-id', state: 'alarm', message: 'Heading unavailable',
      data: { latitude: 12, longitude: -61 },
      status: { canClear: true, canSilence: false }
    }
  }] }] })
  const saved = original.restartSnapshot()
  const restored = new NotificationStore({ classify })
  restored.restoreExactOccurrences(saved)
  restored.applyDelta({ updates: [{ source: { label: 'gnss' }, values: [{
    path: 'notifications.navigation.heading',
    value: {
      id: 'stable-id', state: 'alarm', message: 'Heading unavailable',
      data: { longitude: -61, latitude: 12 },
      status: { canSilence: false, canClear: true }
    }
  }] }] })
  assert.equal(restored.list()[0].occurrenceId, saved[0].occurrenceId)
})

test('does not restore an occurrence when producer id or content changed', () => {
  const original = {
    id: 'old-id', path: 'notifications.navigation.heading', source: { label: 'gnss' },
    state: 'warn', message: 'Heading unavailable', method: ['visual'], createdAt: null,
    data: null, status: null, occurrenceId: 'occurrence-before-restart'
  }
  const store = new NotificationStore({ classify })
  store.restoreExactOccurrences([original])
  store.applyDelta({ updates: [{ source: { label: 'gnss' }, values: [{
    path: original.path,
    value: { id: 'new-id', state: 'warn', message: 'Heading unavailable', method: ['visual'] }
  }] }] })

  assert.notEqual(store.list()[0].occurrenceId, original.occurrenceId)
  assert.equal(store.history()[0].type, 'raised')
})

test('diagnoses exact restart matches, field mismatches, and later removal', () => {
  const original = {
    id: 'stable-id', path: 'notifications.navigation.heading', source: { label: 'gnss' },
    state: 'warn', message: 'Heading unavailable', method: ['visual'], createdAt: null,
    data: null, status: { canClear: false }, occurrenceId: 'occurrence-before-restart'
  }
  const store = new NotificationStore({ classify })
  store.restoreExactOccurrences([original])
  store.upsert({ path: original.path, source: original.source, value: {
    id: original.id, state: original.state, message: original.message,
    method: original.method, status: original.status
  } })
  store.removeByPath(original.path)
  store.upsert({ path: original.path, source: original.source, value: {
    id: original.id, state: original.state, message: 'Different message',
    method: original.method, status: original.status
  } })

  const diagnostics = store.restartCorrelationDiagnostics()
  assert.equal(diagnostics.stagedCount, 1)
  assert.equal(diagnostics.attempts[0].result, 'matched')
  assert.equal(diagnostics.attempts[1].result, 'removed')
  assert.equal(diagnostics.attempts[2].result, 'not_matched')
  assert.deepEqual(diagnostics.attempts[2].mismatchedFields, ['message'])
})
