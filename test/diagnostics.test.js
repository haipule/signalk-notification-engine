'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const Diagnostics = require('../lib/diagnostics')

test('records snapshot duration and clears a previous snapshot error', () => {
  let now = 1000
  const diagnostics = new Diagnostics({ now: () => now })
  let finish = diagnostics.beginSnapshot()
  now = 1042
  finish(new Error('offline'))
  assert.equal(diagnostics.snapshot.durationMs, 42)
  assert.equal(diagnostics.snapshot.lastError.message, 'offline')

  now = 2000
  finish = diagnostics.beginSnapshot()
  now = 2010
  finish()
  assert.equal(diagnostics.snapshot.durationMs, 10)
  assert.equal(diagnostics.snapshot.lastError, null)
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
