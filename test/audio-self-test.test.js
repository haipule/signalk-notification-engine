'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { AudioSelfTest } = require('../lib/audio-self-test')

test('logs technical success and passes only after the feedback window', () => {
  let now = 0
  let close
  let timer
  const events = []
  const passed = []
  const selfTest = new AudioSelfTest({
    play: (_file, callback) => { close = callback },
    onEvent: event => events.push(event.type),
    onPassed: value => passed.push(value),
    now: () => now,
    setTimer: callback => { timer = callback; return 1 }
  })
  selfTest.start({ actor: 'hans', device: 'plughw:2,0', file: '/test.wav' })
  assert.equal(selfTest.toJSON().statement, 'Test started; technical playback is in progress.')
  now = 1000
  close({ ok: true, code: 0, signal: null })
  assert.equal(selfTest.toJSON().state, 'awaiting_feedback')
  assert.equal(selfTest.toJSON().statement, 'Technically played; 15 seconds remain to confirm whether the sound was heard.')
  assert.equal(selfTest.toJSON().feedbackDeadlineAt, '1970-01-01T00:00:16.000Z')
  now = 16000
  timer()
  assert.equal(selfTest.toJSON().state, 'passed_no_counter_report')
  assert.equal(selfTest.toJSON().statement, 'Technically played with no counter-report; human audibility was not confirmed.')
  assert.equal(passed.length, 1)
  assert.deepEqual(events, ['audio_test_started', 'audio_test_technically_played', 'audio_test_passed_no_counter_report'])
})

test('not heard feedback fails the test and cancels automatic passing', () => {
  let close
  let timer
  let cleared = false
  const failures = []
  const selfTest = new AudioSelfTest({
    play: (_file, callback) => { close = callback },
    onFailure: value => failures.push(value),
    setTimer: callback => { timer = callback; return 7 },
    clearTimer: id => { assert.equal(id, 7); cleared = true }
  })
  selfTest.start({ actor: 'hans', device: 'default', file: '/test.wav' })
  close({ ok: true, code: 0 })
  selfTest.reportNotHeard('hans')
  timer()
  assert.equal(cleared, true)
  assert.equal(selfTest.toJSON().state, 'not_heard')
  assert.equal(selfTest.toJSON().statement, 'Sound not heard; the audio system notification remains active.')
  assert.equal(failures.length, 1)
})

test('heard feedback records explicit human confirmation and passes immediately', () => {
  let close
  let cleared = false
  const passed = []
  const events = []
  const selfTest = new AudioSelfTest({
    play: (_file, callback) => { close = callback },
    onPassed: value => passed.push(value),
    onEvent: event => events.push(event.type),
    setTimer: () => 9,
    clearTimer: id => { assert.equal(id, 9); cleared = true }
  })
  selfTest.start({ actor: 'hans', device: 'default', file: '/test.wav' })
  close({ ok: true, code: 0 })
  const result = selfTest.reportHeard('hans')
  assert.equal(cleared, true)
  assert.equal(result.state, 'passed_heard')
  assert.equal(result.operatorFeedback.heard, true)
  assert.equal(result.statement, 'Sound heard; human audibility was confirmed.')
  assert.equal(passed.length, 1)
  assert.equal(events.at(-1), 'audio_test_heard')
})

test('technical failure never opens a human feedback window', () => {
  let close
  const failures = []
  const selfTest = new AudioSelfTest({
    play: (_file, callback) => { close = callback },
    onFailure: (value, result) => failures.push({ value, result })
  })
  selfTest.start({ actor: 'hans', device: 'missing', file: '/test.wav' })
  close({ ok: false, code: 1, error: new Error('missing') })
  assert.equal(selfTest.toJSON().state, 'technical_failure')
  assert.equal(selfTest.toJSON().statement, 'Technical playback failed; audibility was not evaluated.')
  assert.equal(failures.length, 1)
  assert.throws(() => selfTest.reportNotHeard('hans'), /awaiting feedback/)
  assert.throws(() => selfTest.reportHeard('hans'), /awaiting feedback/)
})

test('uses an English idle statement', () => {
  const selfTest = new AudioSelfTest({ play: () => {} })
  assert.deepEqual(selfTest.toJSON(), { state: 'idle', statement: 'No alarm sound test has been run yet.' })
})

test('restores only a terminal audited test after restart', () => {
  const selfTest = new AudioSelfTest({ play: () => {} })
  selfTest.restore({ state: 'passed_no_counter_report', completedAt: '2026-09-29T00:00:00.000Z', statement: 'Technically played' })
  assert.equal(selfTest.toJSON().state, 'passed_no_counter_report')
  selfTest.restore({ state: 'awaiting_feedback', statement: 'stale active state' })
  assert.equal(selfTest.toJSON().state, 'passed_no_counter_report')
  selfTest.restore({ state: 'passed_heard', completedAt: '2026-09-30T00:00:00.000Z', statement: 'Sound heard' })
  assert.equal(selfTest.toJSON().state, 'passed_heard')
})
