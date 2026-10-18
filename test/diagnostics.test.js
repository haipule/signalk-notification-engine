'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const Diagnostics = require('../lib/diagnostics')

test('records snapshot duration and clears a previous snapshot error', () => {
  let now = 1000
  const diagnostics = new Diagnostics({ now: () => now })
  let finish = diagnostics.beginSnapshot()
  now = 1042
  finish(new Error('offline'), { timedOut: true })
  assert.equal(diagnostics.snapshot.durationMs, 42)
  assert.equal(diagnostics.snapshot.lastError.message, 'offline')
  assert.equal(diagnostics.snapshot.failedCount, 1)
  assert.equal(diagnostics.snapshot.timeoutCount, 1)

  now = 2000
  finish = diagnostics.beginSnapshot()
  now = 2010
  finish()
  assert.equal(diagnostics.snapshot.durationMs, 10)
  assert.equal(diagnostics.snapshot.lastError, null)
  assert.equal(diagnostics.snapshot.completedCount, 1)
  assert.equal(diagnostics.snapshot.lastSuccessfulDurationMs, 10)
  assert.equal(diagnostics.snapshot.maxConcurrency, 1)
})

test('records coalesced and cancelled snapshot scheduler state', () => {
  const diagnostics = new Diagnostics()
  diagnostics.beginSnapshot()
  diagnostics.recordSnapshotCoalesced()
  diagnostics.recordSnapshotCoalesced()
  assert.equal(diagnostics.snapshot.active, true)
  assert.equal(diagnostics.snapshot.pending, true)
  assert.equal(diagnostics.snapshot.coalescedCount, 2)

  diagnostics.cancelSnapshot()
  assert.equal(diagnostics.snapshot.active, false)
  assert.equal(diagnostics.snapshot.pending, false)
  assert.equal(diagnostics.snapshot.currentConcurrency, 0)
})

test('counts notification deltas and exposes component details', () => {
  let now = 1000
  const diagnostics = new Diagnostics({ now: () => now })
  diagnostics.recordDelta()
  now = 2000
  diagnostics.recordDelta()
  const view = diagnostics.toJSON({ nodeRed: { revision: 'abc' } })
  assert.equal(view.delta.count, 2)
  assert.equal(view.delta.lastReceivedAt, new Date(2000).toISOString())
  assert.equal(view.nodeRed.revision, 'abc')
})
