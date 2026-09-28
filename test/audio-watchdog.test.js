'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { AudioWatchdog, inspectDevice } = require('../lib/audio-watchdog')

test('passively recognizes the configured hardware playback PCM', () => {
  const inventory = '02-00: USB Audio : USB Audio : playback 1 : capture 1\n'
  assert.equal(inspectDevice('plughw:2,0', inventory).available, true)
  assert.equal(inspectDevice('plughw:3,0', inventory).available, false)
})

test('reports backend and device health without opening the device', () => {
  const reads = []
  const watchdog = new AudioWatchdog({
    readFile: file => { reads.push(file); return '02-00: USB Audio : USB Audio : playback 1\n' },
    access: file => { if (file !== '/usr/bin/aplay') throw new Error('missing') },
    pathValue: '/bin:/usr/bin',
    now: () => '2026-09-28T00:00:00.000Z'
  })
  const result = watchdog.check('aplay', 'plughw:2,0')
  assert.equal(result.state, 'ready')
  assert.equal(result.backend.path, '/usr/bin/aplay')
  assert.equal(result.device.available, true)
  assert.deepEqual(reads, ['/proc/asound/pcm'])
})

test('fails when the backend and playback inventory are missing', () => {
  const watchdog = new AudioWatchdog({ readFile: () => '', access: () => { throw new Error('missing') }, pathValue: '/bin' })
  const result = watchdog.check('aplay', 'plughw:2,0')
  assert.equal(result.state, 'error')
  assert.match(result.message, /backend not found/i)
  assert.match(result.message, /PCM inventory/i)
})
