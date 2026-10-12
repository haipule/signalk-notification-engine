'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const AudioController = require('../lib/audio-controller')

function fixture(policy = { audio: 'on', soundConfig: { file: 'warn.wav', count: 1 } }) {
  const callbacks = []
  const player = {
    player: 'aplay', device: 'default', lastResult: null, stopped: [],
    play(file, key, callback) { callbacks.push({ file, key, callback }) },
    stopKey(key) { this.stopped.push(key) }, stop() {},
    activeProcessCount: () => 0, activeProcessDetails: () => []
  }
  const circuit = {
    ended: [], adopt() {}, beginAttempt: () => ({ allowed: true }), recordSuccess() {},
    recordFailure: () => ({ state: 'closed', failureCount: 1 }), endLifecycle(notification) { this.ended.push(notification) },
    watchdogRecovered: () => null
  }
  const system = { successes: [], failures: [], recordSuccess(n) { this.successes.push(n) }, recordFailure(n) { this.failures.push(n) } }
  const controller = new AudioController({ player, circuitBreaker: circuit, systemNotification: system, resolvePolicy: () => policy, isEnabledState: () => true, baseDirectory: '/sounds' })
  return { controller, player, circuit, system, callbacks }
}

test('keeps the plugin-owned audio failure notification visual-only', () => {
  const { controller, player, callbacks } = fixture()
  controller.ready = true
  controller.apply({ type: 'raised', notification: { path: 'notifications.system.notificationEngine.audio', occurrenceId: 'system', state: 'alarm' } })
  assert.equal(callbacks.length, 0)
  assert.deepEqual(player.stopped, ['system'])
})

test('ends local playback and circuit lifecycle on normal', () => {
  const { controller, circuit, player } = fixture()
  const notification = { path: 'notifications.engine', occurrenceId: 'one', state: 'normal' }
  controller.apply({ type: 'updated', notification })
  assert.deepEqual(circuit.ended, [notification])
  assert.deepEqual(player.stopped, ['one'])
})

test('ends local playback on a local lifecycle boundary without changing state', () => {
  const { controller, circuit, player } = fixture()
  const notification = { path: 'notifications.navigation.anchor', occurrenceId: 'anchor-one', state: 'alarm' }
  controller.apply({ type: 'local_lifecycle_ended', notification })

  assert.equal(notification.state, 'alarm')
  assert.deepEqual(circuit.ended, [notification])
  assert.deepEqual(player.stopped, ['anchor-one'])
})

test('retains a completed finite signature and does not replay a refresh', () => {
  const { controller, callbacks, system } = fixture()
  const notification = { path: 'notifications.engine', occurrenceId: 'one', state: 'warn' }
  controller.enable([notification])
  assert.equal(callbacks.length, 1)
  assert.equal(controller.isAudioActionable('one'), true)
  callbacks[0].callback({ ok: true })
  assert.equal(controller.isAudioActionable('one'), false)
  controller.apply({ type: 'updated', notification })
  assert.equal(callbacks.length, 1)
  assert.equal(system.successes.length, 1)
})

test('acknowledging an active emergency does not stop or restart its audio', () => {
  const { controller, callbacks, player } = fixture({ audio: 'on', soundConfig: { file: 'emergency.wav', count: 0 } })
  const notification = { path: 'notifications.engine', occurrenceId: 'emergency-one', state: 'emergency', status: { acknowledged: false } }
  controller.enable([notification])
  assert.equal(callbacks.length, 1)
  const stopsBeforeAcknowledge = player.stopped.length

  controller.apply({ type: 'updated', notification: { ...notification, status: { acknowledged: true } } })

  assert.equal(callbacks.length, 1)
  assert.equal(player.stopped.length, stopsBeforeAcknowledge)
  assert.equal(controller.isAudioActionable('emergency-one'), true)
})

test('keeps silence actionable while a repeat waits for its next attempt', () => {
  const timers = []
  const { controller, callbacks } = fixture({ audio: 'on', soundConfig: { file: 'warn.wav', count: 2, pauseSeconds: 1 } })
  controller.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return timers.length }
  controller.enable([{ path: 'notifications.engine', occurrenceId: 'repeat', state: 'warn' }])
  callbacks[0].callback({ ok: true })

  assert.equal(timers.length, 1)
  assert.equal(controller.isAudioActionable('repeat'), true)
})

test('does not replay a restored completed finite signature', () => {
  const { controller, callbacks } = fixture()
  const notification = { path: 'notifications.engine', occurrenceId: 'one', state: 'warn' }
  controller.restoreCompletedPlayback([{ key: 'one', signature: '/sounds/warn.wav|1|0', completed: true }])
  controller.enable([notification])
  assert.equal(callbacks.length, 0)
})

test('does not restore an interrupted loop', () => {
  const { controller, callbacks } = fixture({ audio: 'on', soundConfig: { file: 'alarm.wav', count: 0 } })
  const notification = { path: 'notifications.engine', occurrenceId: 'one', state: 'alarm' }
  controller.restoreCompletedPlayback([{ key: 'one', signature: '/sounds/alarm.wav|0|0', completed: false }])
  controller.enable([notification])
  assert.equal(callbacks.length, 1)
})

test('optimistic silence can be rolled back without changing notification state', () => {
  const { controller, player } = fixture()
  const notification = { occurrenceId: 'one', state: 'alarm' }
  controller.silence(notification)
  assert.equal(controller.silenced.get('one'), 'alarm')
  assert.deepEqual(player.stopped, ['one'])
  controller.rollbackSilence(notification)
  assert.equal(controller.silenced.has('one'), false)
  assert.equal(notification.state, 'alarm')
})
