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
