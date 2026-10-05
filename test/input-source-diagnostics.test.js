'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { inspectInputSources, normalizeInputSources } = require('../lib/input-source-diagnostics')

const input = [{ name: 'Android GPS', path: 'navigation.position', source: 'android_udp.gps', staleAfterSeconds: 15 }]
const now = Date.parse('2026-10-05T02:40:20.000Z')

test('reports the age and freshness of the expected critical input source', () => {
  const [view] = inspectInputSources(input, () => ({
    value: { latitude: 11, longitude: -60 },
    $source: 'android_udp.gps',
    timestamp: '2026-10-05T02:40:10.000Z'
  }), { now: () => now })

  assert.deepEqual(view, {
    name: 'Android GPS',
    path: 'navigation.position',
    expectedSource: 'android_udp.gps',
    observedSource: 'android_udp.gps',
    state: 'fresh',
    timestamp: '2026-10-05T02:40:10.000Z',
    ageMs: 10000,
    staleAfterSeconds: 15,
    valuePresent: true
  })
})

test('distinguishes stale, missing, mismatched, and timestamp-less inputs', () => {
  const stale = inspectInputSources(input, () => ({ value: {}, $source: 'android_udp.gps', timestamp: '2026-10-05T02:40:00.000Z' }), { now: () => now })[0]
  const missing = inspectInputSources(input, () => undefined, { now: () => now })[0]
  const mismatch = inspectInputSources(input, () => ({ value: {}, $source: 'other.gps', timestamp: '2026-10-05T02:40:19.000Z' }), { now: () => now })[0]
  const timestampMissing = inspectInputSources(input, () => ({ value: {}, $source: 'android_udp.gps' }), { now: () => now })[0]

  assert.equal(stale.state, 'stale')
  assert.equal(missing.state, 'missing')
  assert.equal(mismatch.state, 'source_mismatch')
  assert.equal(timestampMissing.state, 'timestamp_missing')
})

test('validates critical input definitions and applies the default threshold', () => {
  assert.deepEqual(normalizeInputSources([{ name: 'GPS', path: 'navigation.position', source: 'gps' }]), [{
    name: 'GPS', path: 'navigation.position', source: 'gps', staleAfterSeconds: 15
  }])
  assert.throws(() => normalizeInputSources([{ name: 'GPS', path: '', source: 'gps' }]), /requires name, path, and source/)
  assert.throws(() => normalizeInputSources([{ name: 'GPS', path: 'navigation.position', source: 'gps', staleAfterSeconds: 0 }]), /integer from 1 to 3600/)
})
