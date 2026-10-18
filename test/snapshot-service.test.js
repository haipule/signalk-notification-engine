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

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function response(id) {
  return { ok: true, json: async () => ({ navigation: { test: { value: { id, state: 'warn' } } } }) }
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

test('serializes slow snapshots and coalesces overlaps into one follow-up', async () => {
  const store = fakeStore()
  const diagnostics = new Diagnostics()
  const requests = []
  let activeRequests = 0
  let maxRequests = 0
  const service = new SnapshotService({
    app: {}, store, diagnostics,
    fetchImpl: (_url, options) => {
      const request = deferred()
      requests.push({ ...request, options })
      activeRequests += 1
      maxRequests = Math.max(maxRequests, activeRequests)
      return request.promise.finally(() => { activeRequests -= 1 })
    }
  })

  const first = service.sync()
  const second = service.sync()
  const third = service.sync()
  assert.equal(requests.length, 1)
  assert.equal(diagnostics.snapshot.pending, true)
  assert.equal(diagnostics.snapshot.coalescedCount, 2)

  service.applyDelta({ updates: [{ values: [{ path: 'notifications.test', value: { id: 'delta', state: 'warn' } }] }] })
  assert.equal(store.deltas.length, 1)

  requests[0].resolve(response('first'))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(requests.length, 2)
  requests[1].resolve(response('second'))
  await Promise.all([first, second, third])

  assert.equal(maxRequests, 1)
  assert.equal(store.snapshots.length, 2)
  assert.equal(diagnostics.snapshot.maxConcurrency, 1)
  assert.equal(diagnostics.snapshot.pending, false)
})

test('stop aborts an active snapshot and prevents late store or diagnostics callbacks', async () => {
  const store = fakeStore()
  const diagnostics = new Diagnostics()
  const errors = []
  const request = deferred()
  const service = new SnapshotService({
    app: { error: message => errors.push(message) }, store, diagnostics,
    fetchImpl: () => request.promise
  })

  const sync = service.sync()
  service.stop()
  request.resolve(response('late'))
  assert.equal(await sync, false)
  assert.equal(store.snapshots.length, 0)
  assert.equal(diagnostics.snapshot.active, false)
  assert.equal(diagnostics.snapshot.lastCompletedAt, null)
  assert.deepEqual(errors, [])
})

test('can begin a fresh serialized lifecycle after stop', async () => {
  const store = fakeStore()
  const service = new SnapshotService({
    app: {}, store, diagnostics: new Diagnostics(),
    fetchImpl: async () => response('fresh')
  })

  service.stop()
  assert.equal(await service.sync(), false)
  service.start()
  assert.equal(await service.sync(), true)
  assert.equal(store.snapshots[0].fresh.value.state, 'warn')
})

test('a timed-out API snapshot preserves the store and a later success recovers', async () => {
  const store = fakeStore([{ id: 'existing' }])
  const diagnostics = new Diagnostics()
  const timers = []
  let attempt = 0
  const service = new SnapshotService({
    app: { error() {} }, store, diagnostics, requestTimeoutMs: 50,
    setTimeoutFn: callback => { timers.push(callback); return callback },
    clearTimeoutFn() {},
    fetchImpl: (_url, { signal }) => {
      attempt += 1
      if (attempt > 1) return Promise.resolve(response('recovered'))
      return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
        const error = new Error('aborted')
        error.name = 'AbortError'
        reject(error)
      }))
    }
  })

  const timedOut = service.sync()
  timers[0]()
  await assert.rejects(timedOut, /timed out after 50 ms/)
  assert.equal(store.snapshots.length, 0)
  assert.equal(diagnostics.snapshot.timeoutCount, 1)
  assert.match(diagnostics.snapshot.lastError.message, /timed out/)

  await service.sync()
  assert.equal(store.snapshots.length, 1)
  assert.equal(store.snapshots[0].recovered.value.state, 'warn')
  assert.equal(diagnostics.snapshot.lastError, null)
  assert.equal(diagnostics.snapshot.completedCount, 1)
})
