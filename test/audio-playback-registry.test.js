'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const AudioPlaybackRegistry = require('../lib/audio-playback-registry')

test('retains a completed finite sound for the same occurrence and signature', () => {
  const registry = new AudioPlaybackRegistry()

  assert.equal(registry.begin('occurrence-1', 'warn.wav|once|1'), true)
  assert.equal(registry.complete('occurrence-1', 'warn.wav|once|1'), true)
  assert.equal(registry.begin('occurrence-1', 'warn.wav|once|1'), false)
})

test('allows a changed sound configuration and a later lifecycle', () => {
  const registry = new AudioPlaybackRegistry()

  assert.equal(registry.begin('occurrence-1', 'warn.wav|once|1'), true)
  assert.equal(registry.begin('occurrence-1', 'warn.wav|repeat|3'), true)
  registry.end('occurrence-1')
  assert.equal(registry.begin('occurrence-1', 'warn.wav|repeat|3'), true)
  registry.clear()
  assert.equal(registry.begin('occurrence-1', 'warn.wav|repeat|3'), true)
})

test('configuration suspension retains only completed finite signatures', () => {
  const registry = new AudioPlaybackRegistry()
  registry.begin('completed', 'warn.wav|1|0')
  registry.complete('completed', 'warn.wav|1|0')
  registry.begin('playing', 'alarm.wav|0|0')
  registry.begin('pending-repeat', 'speech.wav|3|5')

  registry.retainCompleted()

  assert.equal(registry.current('completed'), 'warn.wav|1|0')
  assert.equal(registry.begin('completed', 'warn.wav|1|0'), false)
  assert.equal(registry.current('playing'), undefined)
  assert.equal(registry.current('pending-repeat'), undefined)
  assert.equal(registry.begin('playing', 'alarm.wav|0|0'), true)
  assert.equal(registry.begin('completed', 'warn.wav|1|2'), true)
  assert.deepEqual(registry.toJSON(), [
    { key: 'completed', signature: 'warn.wav|1|2', completed: false },
    { key: 'playing', signature: 'alarm.wav|0|0', completed: false }
  ])
})

test('restores only completed finite signatures after restart', () => {
  const registry = new AudioPlaybackRegistry()
  registry.restoreCompleted([
    { key: 'finite', signature: 'warn.wav|1|0', completed: true },
    { key: 'loop', signature: 'alarm.wav|0|0', completed: false },
    { key: 42, signature: 'invalid', completed: true }
  ])

  assert.equal(registry.current('finite'), 'warn.wav|1|0')
  assert.equal(registry.current('loop'), undefined)
  assert.deepEqual(registry.toJSON(), [{ key: 'finite', signature: 'warn.wav|1|0', completed: true }])
})
