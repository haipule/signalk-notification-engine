'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { RuntimeTestNotifications, PATH_PREFIX } = require('../lib/runtime-test-notifications')

function fixture() {
  const calls = []
  let sequence = 0
  const manager = new RuntimeTestNotifications({ notifications: {
    raise: options => { calls.push(['raise', options]); return `id-${++sequence}` },
    update: (id, options) => calls.push(['update', id, options]),
    clear: id => calls.push(['clear', id])
  } })
  return { manager, calls }
}

test('raises two isolated bounded slots in the fixed test namespace', async () => {
  const { manager, calls } = fixture()
  const a = manager.raise('a', { state: 'alarm', runtimeSeconds: 30 })
  const b = manager.raise('b', { state: 'warn', runtimeSeconds: 30 })
  assert.equal(a.path, `${PATH_PREFIX}.a`)
  assert.equal(b.path, `${PATH_PREFIX}.b`)
  assert.equal(calls[0][1].data.notificationEngineRuntimeTest, true)
  assert.equal(manager.list().length, 2)
  await manager.clearAll()
})

test('updates and clears only the id registered for that slot', async () => {
  const { manager, calls } = fixture()
  manager.raise('a', { state: 'warn' })
  manager.update('a', { state: 'normal', message: 'ended' })
  await manager.clear('a')
  assert.deepEqual(calls.slice(1), [
    ['update', 'id-1', { state: 'normal', message: 'ended' }],
    ['clear', 'id-1']
  ])
})

test('rejects arbitrary slots, invalid states, duplicates, and unknown updates', async () => {
  const { manager } = fixture()
  assert.throws(() => manager.raise('../foreign'), /slot must match/)
  assert.throws(() => manager.raise('a', { state: 'nominal' }), /Unsupported/)
  manager.raise('a')
  assert.throws(() => manager.raise('a'), /already active/)
  assert.throws(() => manager.update('b', { state: 'normal' }), /not active/)
  assert.equal(await manager.clear('b'), false)
  await manager.clearAll()
})

test('clamps runtime duration to the safe 10 to 600 second window', async () => {
  const { manager } = fixture()
  assert.equal(manager.raise('a', { runtimeSeconds: 1 }).runtimeSeconds, 10)
  assert.equal(manager.raise('b', { runtimeSeconds: 9999 }).runtimeSeconds, 600)
  await manager.clearAll()
})

test('startup cleanup clears only marked notifications in the fixed namespace', async () => {
  const cleared = []
  const manager = new RuntimeTestNotifications({ notifications: {
    list: () => ({
      stale: { path: `${PATH_PREFIX}.a`, data: { notificationEngineRuntimeTest: true } },
      foreign: { path: 'notifications.navigation.anchor', data: { notificationEngineRuntimeTest: true } },
      unmarked: { path: `${PATH_PREFIX}.b`, data: {} }
    }),
    clear: id => cleared.push(id)
  } })
  assert.equal(await manager.clearStale(), 1)
  assert.deepEqual(cleared, ['stale'])
})

test('clear is idempotent after Signal K removes a normal notification', async () => {
  const manager = new RuntimeTestNotifications({ notifications: {
    raise: () => 'id-1',
    update: () => {},
    clear: () => { throw new Error('Alarm not found!') }
  } })
  manager.raise('a')
  manager.update('a', { state: 'normal' })
  assert.equal(await manager.clear('a'), true)
  assert.deepEqual(manager.list(), [])
})
