'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
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
