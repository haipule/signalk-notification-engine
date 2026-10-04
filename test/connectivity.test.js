'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_FETCH_TIMEOUT_MS, DEFAULT_STALE_AFTER_MS, createRefreshScheduler, fetchJsonWithTimeout, isRefreshStale } = require('../public/connectivity')

test('uses Pi-tolerant connectivity deadlines', () => {
  assert.equal(DEFAULT_FETCH_TIMEOUT_MS, 12000)
  assert.equal(DEFAULT_STALE_AFTER_MS, 15000)
})

test('aborts an unreachable poll at the configured deadline', async () => {
  let aborted = false
  class FakeAbortController {
    constructor() { this.signal = {}; this.signal.controller = this }
    abort() { aborted = true; this.signal.onabort?.() }
  }
  const fetchFn = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.onabort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
  })

  await assert.rejects(fetchJsonWithTimeout('/notifications', { fetchFn, timeoutMs: 1, AbortControllerClass: FakeAbortController }), /aborted/)
  assert.equal(aborted, true)
})

test('clears the deadline after a successful response', async () => {
  let cleared = false
  const result = await fetchJsonWithTimeout('/notifications', {
    fetchFn: async () => ({ ok: true, json: async () => ({ state: 'ready' }) }),
    setTimer: () => 42,
    clearTimer: timer => { cleared = timer === 42 }
  })

  assert.deepEqual(result, { state: 'ready' })
  assert.equal(cleared, true)
})

test('serializes overlapping polls and runs one pending refresh', async () => {
  let release
  let active = 0
  let maximumActive = 0
  let calls = 0
  const schedule = createRefreshScheduler(async () => {
    calls += 1
    active += 1
    maximumActive = Math.max(maximumActive, active)
    if (calls === 1) await new Promise(resolve => { release = resolve })
    active -= 1
  })

  const first = schedule()
  const second = schedule()
  const third = schedule()
  release()
  await Promise.all([first, second, third])

  assert.equal(calls, 2)
  assert.equal(maximumActive, 1)
})

test('marks a never-loaded or old snapshot stale after the deadline', () => {
  assert.equal(isRefreshStale(null, 14999, 0), false)
  assert.equal(isRefreshStale(null, 15000, 0), true)
  assert.equal(isRefreshStale(5000, 19999, 0), false)
  assert.equal(isRefreshStale(5000, 20000, 0), true)
  assert.equal(isRefreshStale(5000, 25000, 0, 15000, true), false)
})
