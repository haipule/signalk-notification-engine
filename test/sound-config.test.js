'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { normalizeSoundConfig, resolveSoundCount } = require('../lib/sound-config')

test('uses count as the canonical playback model', () => {
  assert.deepEqual(normalizeSoundConfig({ active: true, file: 'alarm.wav', count: 0 }), { active: true, file: 'alarm.wav', count: 0 })
  assert.deepEqual(normalizeSoundConfig({ file: 'warn.wav', count: 1 }), { file: 'warn.wav', count: 1 })
  assert.deepEqual(normalizeSoundConfig({ file: 'alert.wav', count: 99 }), { file: 'alert.wav', count: 99 })
})

test('translates legacy once repeat and loop values', () => {
  assert.equal(resolveSoundCount({ mode: 'once', repeatCount: 7 }), 1)
  assert.equal(resolveSoundCount({ mode: 'repeat', repeatCount: 7 }), 7)
  assert.equal(resolveSoundCount({ mode: 'loop', repeatCount: 7 }), 0)
  assert.deepEqual(normalizeSoundConfig({ active: true, file: 'old.wav', mode: 'repeat', repeatCount: 3 }), { active: true, file: 'old.wav', count: 3 })
})

test('defaults a missing count to one and rejects unsafe values', () => {
  assert.equal(resolveSoundCount({}), 1)
  for (const count of [-1, 1.5, 100, '3']) assert.throws(() => resolveSoundCount({ count }), /integer from 0 to 99/)
  assert.throws(() => resolveSoundCount({ count: 0, mode: 'once' }), /conflicts/)
  assert.throws(() => resolveSoundCount({ mode: 'repeat', repeatCount: 100 }), /integer from 1 to 99/)
})
