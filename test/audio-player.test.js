'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const AudioPlayer = require('../lib/audio-player')

test('does not interrupt a sound when another sound starts', async () => {
  const player = new AudioPlayer({ player: '/bin/sleep' })
  player.play('1')
  player.play('1')
  assert.equal([...player.processes.values()].reduce((total, processes) => total + processes.size, 0), 2)
  player.stop()
  assert.equal(player.processes.size, 0)
})

test('passes the configured ALSA device to aplay', () => {
  const player = new AudioPlayer({ player: '/usr/bin/aplay', device: 'plughw:2,0' })
  assert.equal(player.device, 'plughw:2,0')
})

test('does not report diagnostic stderr when the player exits successfully', async () => {
  const errors = []
  const child = fakeChild()
  const times = [1000, 1250]
  const player = new AudioPlayer({ onError: error => errors.push(error), spawnProcess: () => child, now: () => times.shift() })
  const result = new Promise(resolve => player.play('sound.wav', 'alarm', resolve))
  child.stderr.write('Playing WAVE sound.wav\n')
  child.emit('close', 0, null)

  assert.deepEqual(await result, {
    key: 'alarm', file: 'sound.wav', player: 'aplay', device: 'default', pid: null,
    startedAt: '1970-01-01T00:00:01.000Z', completedAt: '1970-01-01T00:00:01.250Z', durationMs: 250,
    ok: true, code: 0, signal: null, stderr: 'Playing WAVE sound.wav', error: null
  })
  assert.equal(errors.length, 0)
})

test('exposes active process metadata and retains the last completed result', async () => {
  const child = fakeChild()
  child.pid = 42
  const player = new AudioPlayer({ player: '/usr/bin/aplay', device: 'plughw:2,0', spawnProcess: () => child, now: () => 2000 })
  player.play('/sounds/alarm.wav', 'occurrence-1')
  assert.deepEqual(player.activeProcessDetails(), [{
    key: 'occurrence-1', file: '/sounds/alarm.wav', player: '/usr/bin/aplay', device: 'plughw:2,0', pid: 42, startedAt: '1970-01-01T00:00:02.000Z'
  }])
  child.emit('close', 0, null)
  assert.equal(player.activeProcessDetails().length, 0)
  assert.equal(player.lastResult.key, 'occurrence-1')
  assert.equal(player.lastResult.completedAt, '1970-01-01T00:00:02.000Z')
})

test('reports a non-zero player exit once and returns its diagnostics', async () => {
  const errors = []
  const child = fakeChild()
  const player = new AudioPlayer({ onError: error => errors.push(error), spawnProcess: () => child })
  const result = new Promise(resolve => player.play('sound.wav', 'alarm', resolve))
  child.stderr.write('audio open error')
  child.emit('close', 1, null)

  assert.equal((await result).ok, false)
  assert.equal(errors.length, 1)
  assert.match(errors[0].message, /audio open error/)
})

function fakeChild() {
  const child = new EventEmitter()
  child.stderr = new PassThrough()
  child.kill = () => child.emit('close', null, 'SIGTERM')
  return child
}
