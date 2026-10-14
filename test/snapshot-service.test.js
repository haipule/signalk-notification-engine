'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const Diagnostics = require('../lib/diagnostics')
const SnapshotService = require('../lib/snapshot-service')

function fakeStore(records = []) {
  return {
    records,
    snapshots: [],
    deltas: [],
    sourceUpdates: [],
    list() { return this.records },
    replaceSnapshot(snapshot) { this.snapshots.push(snapshot) },
    setSourceForPath(path, source) { this.sourceUpdates.push({ path, source }) },
    applyDelta(delta, resolveSource) { this.deltas.push({ delta, source: resolveSource('notifications.propulsion.engine') }) }
  }
}

test('merges Signal K snapshot views and filters disabled manager tests', async () => {
  const store = fakeStore()
  const app = {
    config: { settings: { port: 3001 } },
    notifications: { list: () => ({ managed: { path: 'notifications.navigation.anchor', value: { id: 'managed', state: 'alarm' } } }) },
    getSelfPath(path) {
      if (path === 'notifications') return { system: { test: { value: { id: 'test', state: 'warn', data: { notificationManagerTest: true } } } } }
      return undefined
    },
    getPath: () => ({ environment: { bilge: { value: { id: 'bilge', state: 'alarm' } } } })
  }
  const fetchCalls = []
  const service = new SnapshotService({
    app,
    store,
    diagnostics: new Diagnostics(),
    fetchImpl: async url => {
      fetchCalls.push(url)
      return { ok: true, json: async () => ({ navigation: { gnss: { value: { id: 'gnss', state: 'warn' } } } }) }
    }
  })

  await service.sync()

  assert.equal(fetchCalls[0], 'http://127.0.0.1:3001/signalk/v1/api/vessels/self/notifications')
  assert.deepEqual(Object.keys(store.snapshots[0]).sort(), ['bilge', 'gnss', 'managed'])
  assert.equal(store.snapshots[0].managed.actionManaged, true)
  assert.equal(store.snapshots[0].bilge.actionManaged, false)
  assert.equal(store.snapshots[0].gnss.actionManaged, false)
})

test('retains the API snapshot when an in-process view fails', async () => {
  const errors = []
  const service = new SnapshotService({
    app: { error: message => errors.push(message), getSelfPath: () => { throw new Error('model unavailable') } },
    store: fakeStore(),
    diagnostics: new Diagnostics(),
    fetchImpl: async () => ({ ok: true, json: async () => ({ navigation: { anchor: { value: { id: 'anchor', state: 'alarm' } } } }) })
  })

  const snapshot = await service.read()

  assert.equal(snapshot.anchor.value.state, 'alarm')
  assert.equal(snapshot.anchor.actionManaged, false)
  assert.match(errors[0], /in-process notification snapshot/)
})

test('keeps a stale normal data-model record visible but removes its actions', async () => {
  const service = new SnapshotService({
    app: {
      notifications: { list: () => ({}) },
      getSelfPath: () => ({ navigation: { anchor: { value: {
        id: 'stale-anchor', state: 'normal',
        status: { canAcknowledge: true, canSilence: true }
      } } } }),
      getPath: () => ({})
    },
    store: fakeStore(),
    diagnostics: new Diagnostics(),
    fetchImpl: async () => ({ ok: true, json: async () => ({}) })
  })

  const snapshot = await service.read()

  assert.equal(snapshot['stale-anchor'].value.state, 'normal')
  assert.equal(snapshot['stale-anchor'].actionManaged, false)
})

test('subscribes to notifications and mirrored paths while preserving producer source', () => {
  const store = fakeStore([{ path: 'notifications.propulsion.engine' }])
  let subscription
  const service = new SnapshotService({
    app: {
      subscriptionmanager: {
        subscribe(options, unsubscribes, onError, onDelta) {
          subscription = { options, onError, onDelta }
          unsubscribes.push(() => {})
        }
      }
    },
    store,
    diagnostics: new Diagnostics(),
    fetchImpl: null
  })

  service.subscribe()
  subscription.onDelta({ updates: [
    { source: { label: 'engineroomStbd.XX' }, values: [{ path: 'propulsion.engine', value: 1200 }] },
    { source: { label: 'self.notificationhandler' }, values: [{ path: 'notifications.propulsion.engine', value: { id: 'engine', state: 'warn' } }] }
  ] })

  assert.deepEqual(subscription.options.subscribe, [{ path: 'notifications.*' }, { path: 'propulsion.engine' }])
  assert.deepEqual(store.sourceUpdates[0], { path: 'propulsion.engine', source: { label: 'engineroomStbd.XX' } })
  assert.deepEqual(store.deltas[0].source, { label: 'engineroomStbd.XX' })
})

test('owns and stops one periodic snapshot timer', () => {
  const cleared = []
  const service = new SnapshotService({
    app: {},
    store: fakeStore(),
    diagnostics: new Diagnostics(),
    fetchImpl: null,
    setIntervalFn: (callback, interval) => ({ callback, interval }),
    clearIntervalFn: timer => cleared.push(timer)
  })

  service.startPolling()
  const first = service.timer
  service.startPolling()
  service.stopPolling()

  assert.equal(first.interval, 5000)
  assert.equal(cleared.length, 2)
  assert.equal(service.timer, null)
})
