'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { AudioSystemNotification, AUDIO_SYSTEM_PATH } = require('../lib/audio-system-notification')
const { AUDIO_SELF_TEST_ORIGIN_PATH } = require('../lib/audio-self-test')

function notification(occurrenceId, path = `notifications.test.${occurrenceId}`) {
  return { occurrenceId, path, state: 'alarm', message: occurrenceId, source: { label: 'test' } }
}

test('publishes one visual-only system alarm without accepting its own failure', () => {
  const published = []
  const system = new AudioSystemNotification({ publish: value => published.push(value), now: () => '2026-09-29T00:00:00.000Z' })
  assert.equal(system.recordFailure(notification('one'), { code: 1, stderr: 'device missing' }), true)
  assert.equal(system.recordFailure(notification('two'), { code: 1 }), true)
  assert.equal(system.recordFailure(notification('self', AUDIO_SYSTEM_PATH), { code: 1 }), false)

  assert.equal(published.length, 1)
  assert.equal(published[0].state, 'alarm')
  assert.deepEqual(published[0].method, ['visual'])
  assert.equal(published[0].temporarySilenceSupport, 'No')
  assert.equal(published[0].acknowledgeSupport, 'No')
  assert.equal(system.toJSON().unresolvedCount, 2)
})

test('only success from the same failed lifecycle resolves its latch', () => {
  const published = []
  const system = new AudioSystemNotification({ publish: value => published.push(value) })
  system.recordFailure(notification('one'), { code: 1 })
  system.recordFailure(notification('two'), { code: 1 })

  assert.equal(system.recordSuccess(notification('other')), false)
  assert.equal(system.recordSuccess(notification('one')), true)
  assert.equal(system.toJSON().state, 'alarm')
  assert.equal(system.recordSuccess(notification('two')), true)
  assert.equal(system.toJSON().state, 'normal')
  assert.deepEqual(published.map(value => value.state), ['alarm', 'normal'])
})

test('restores unresolved failures and republishes the visual alarm', () => {
  const published = []
  const system = new AudioSystemNotification({ publish: value => published.push(value) })
  system.restore({ version: 1, failures: [{ occurrenceId: 'one', path: 'notifications.test.one', failedAt: 'earlier' }] })
  system.synchronize()
  assert.equal(system.toJSON().unresolvedCount, 1)
  assert.equal(published[0].state, 'alarm')
})

test('latches an inaudible self-test under a distinct internal origin', () => {
  const published = []
  const system = new AudioSystemNotification({ publish: value => published.push(value) })
  const selfTest = notification('notification-engine-audio-self-test', AUDIO_SELF_TEST_ORIGIN_PATH)

  assert.equal(system.recordFailure(selfTest, { error: new Error('Operator reported that the test tone was not heard') }), true)
  assert.equal(system.toJSON().state, 'alarm')
  assert.equal(system.toJSON().failures[0].path, AUDIO_SELF_TEST_ORIGIN_PATH)
  assert.equal(published[0].path, AUDIO_SYSTEM_PATH)
  assert.equal(system.recordSuccess(selfTest), true)
  assert.equal(system.toJSON().state, 'normal')
})
