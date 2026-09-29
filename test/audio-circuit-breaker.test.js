'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { AudioCircuitBreaker } = require('../lib/audio-circuit-breaker')

function notification(id = 'one', occurrenceId = `occurrence-${id}`) {
  return { id, occurrenceId, path: `notifications.test.${id}`, historyKey: `notifications.test.${id}|test`, state: 'alarm' }
}

test('opens on the fifth consecutive technical failure', () => {
  let now = 0
  const transitions = []
  const breaker = new AudioCircuitBreaker({ now: () => now, onTransition: event => transitions.push(event.type) })
  const record = notification()
  for (let count = 1; count <= 5; count += 1) {
    const state = breaker.recordFailure(record, { code: 1, stderr: 'device missing' })
    assert.equal(state.failureCount, count)
  }
  assert.equal(breaker.get(record.occurrenceId).state, 'open')
  assert.equal(breaker.get(record.occurrenceId).nextProbeAt, 300000)
  assert.equal(transitions.filter(type => type === 'audio_circuit_failure').length, 5)
  assert.equal(transitions.at(-1), 'audio_circuit_opened')
})

test('allows one probe after five minutes and reopens it after failure', () => {
  let now = 0
  const breaker = new AudioCircuitBreaker({ now: () => now })
  const record = notification()
  for (let count = 0; count < 5; count += 1) breaker.recordFailure(record, { code: 1 })
  assert.equal(breaker.beginAttempt(record).allowed, false)
  now = 300000
  assert.deepEqual(breaker.beginAttempt(record), { allowed: true, probe: true })
  assert.equal(breaker.get(record.occurrenceId).state, 'half-open')
  breaker.recordFailure(record, { code: 1 })
  assert.equal(breaker.get(record.occurrenceId).state, 'open')
  assert.equal(breaker.get(record.occurrenceId).nextProbeAt, 600000)
})

test('serializes probes globally and defers another lifecycle', () => {
  let now = 300000
  const breaker = new AudioCircuitBreaker({ now: () => now })
  const first = notification('one')
  const second = notification('two')
  now = 0
  for (let count = 0; count < 5; count += 1) {
    breaker.recordFailure(first, { code: 1 })
    breaker.recordFailure(second, { code: 1 })
  }
  now = 300000
  assert.equal(breaker.beginAttempt(first).allowed, true)
  const denied = breaker.beginAttempt(second)
  assert.equal(denied.allowed, false)
  assert.equal(denied.retryAt, 600000)
})

test('successful playback recovers and lifecycle end closes without Signal K changes', () => {
  const transitions = []
  const breaker = new AudioCircuitBreaker({ onTransition: event => transitions.push(event.type) })
  const record = notification()
  breaker.recordFailure(record, { code: 1 })
  assert.equal(breaker.recordSuccess(record), true)
  assert.equal(breaker.get(record.occurrenceId), null)
  breaker.recordFailure(record, { code: 1 })
  assert.equal(breaker.endLifecycle(record), true)
  assert.equal(breaker.get(record.occurrenceId), null)
  assert.deepEqual(transitions.filter(type => type.includes('recovered') || type.includes('lifecycle_end')), ['audio_circuit_recovered', 'audio_circuit_closed_on_lifecycle_end'])
  assert.equal(record.state, 'alarm')
})

test('watchdog recovery permits only one early probe', () => {
  const breaker = new AudioCircuitBreaker()
  const first = notification('one')
  const second = notification('two')
  for (let count = 0; count < 5; count += 1) {
    breaker.recordFailure(first, { code: 1 })
    breaker.recordFailure(second, { code: 1 })
  }
  assert.equal(breaker.watchdogRecovered(), first.occurrenceId)
  assert.equal(breaker.beginAttempt(first).allowed, true)
  assert.equal(breaker.watchdogRecovered(), null)
  assert.equal(breaker.beginAttempt(second).allowed, false)
})

test('persisted state is adopted after restart with a new occurrence id', () => {
  let now = 1000
  const original = notification('one', 'old-occurrence')
  const first = new AudioCircuitBreaker({ now: () => now })
  for (let count = 0; count < 5; count += 1) first.recordFailure(original, { code: 1 })

  now = 2000
  const restored = new AudioCircuitBreaker({ now: () => now })
  restored.restore(first.snapshot())
  const reconstructed = notification('one', 'new-occurrence')
  const adopted = restored.adopt(reconstructed)
  assert.equal(adopted.key, 'new-occurrence')
  assert.equal(adopted.failureCount, 5)
  assert.equal(adopted.state, 'open')
  assert.equal(restored.get('old-occurrence'), null)
})

test('startup reconciliation removes persisted breakers without an active lifecycle', () => {
  const transitions = []
  const active = notification('active')
  const ended = notification('ended')
  const beforeRestart = new AudioCircuitBreaker()
  beforeRestart.recordFailure(active, { code: 1 })
  beforeRestart.recordFailure(ended, { code: 1 })

  const restored = new AudioCircuitBreaker({ onTransition: event => transitions.push(event.type) })
  restored.restore(beforeRestart.snapshot())
  assert.equal(restored.reconcileActive([active]), 1)
  assert.equal(restored.toJSON().states.length, 1)
  assert.equal(restored.toJSON().states[0].identity, active.historyKey)
  assert.deepEqual(transitions, ['audio_circuit_closed_on_lifecycle_end'])
})
