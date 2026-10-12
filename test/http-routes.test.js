'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const registerHttpRoutes = require('../lib/http-routes')

function fakeRouter() {
  const routes = []
  return {
    routes,
    access(level) {
      return Object.fromEntries(['get', 'post', 'patch', 'delete'].map(method => [method, (path, handler) => routes.push({ level, method, path, handler })]))
    }
  }
}

function api(overrides = {}) {
  return {
    notifications: async () => ({ notifications: [] }), rules: () => null, history: () => [],
    translations: () => ({}), translation: () => ({}), diagnostics: () => ({}),
    processingUnavailable: () => null, configurationError: () => null, audioUnavailable: () => null,
    runtimeTests: { list: () => [], raise: () => ({}), update: () => ({}), clear: async () => true },
    audioTest: { enabled: () => true, start: () => ({}), notHeard: () => ({}), heard: () => ({}) }, clearHistory: async () => true,
    actionAll: async () => 0, action: async () => {}, ...overrides
  }
}

test('keeps readonly and readwrite routes on their Signal K access boundaries', () => {
  const router = fakeRouter()
  registerHttpRoutes(router, api())
  assert.deepEqual(router.routes.map(({ level, method, path }) => ({ level, method, path })), [
    { level: 'readonly', method: 'get', path: '/notifications' },
    { level: 'readonly', method: 'get', path: '/rules' },
    { level: 'readonly', method: 'get', path: '/history' },
    { level: 'readonly', method: 'get', path: '/translations' },
    { level: 'readonly', method: 'get', path: '/translations/:locale' },
    { level: 'readonly', method: 'get', path: '/diagnostics' },
    { level: 'readwrite', method: 'get', path: '/write-access' },
    { level: 'readwrite', method: 'get', path: '/runtime-tests' },
    { level: 'readwrite', method: 'post', path: '/runtime-tests/:slot' },
    { level: 'readwrite', method: 'patch', path: '/runtime-tests/:slot' },
    { level: 'readwrite', method: 'delete', path: '/runtime-tests/:slot' },
    { level: 'readwrite', method: 'post', path: '/audio-test/start' },
    { level: 'readwrite', method: 'post', path: '/audio-test/not-heard' },
    { level: 'readwrite', method: 'post', path: '/audio-test/heard' },
    { level: 'readwrite', method: 'delete', path: '/history' },
    { level: 'readwrite', method: 'post', path: '/notifications/action-all/:action' },
    { level: 'readwrite', method: 'post', path: '/notifications/:id/:action' }
  ])
  const posts = router.routes.filter(route => route.method === 'post').map(route => route.path)
  assert.ok(posts.indexOf('/notifications/action-all/:action') < posts.indexOf('/notifications/:id/:action'))
})

test('write-access probe crosses only the readwrite boundary and changes no state', () => {
  const router = fakeRouter()
  registerHttpRoutes(router, api())
  const route = router.routes.find(candidate => candidate.method === 'get' && candidate.path === '/write-access')
  let body
  route.handler({}, { json(value) { body = value } })
  assert.deepEqual(body, { authorized: true })
})

test('rejects mutating runtime tests while processing is unavailable', () => {
  const router = fakeRouter()
  registerHttpRoutes(router, api({ processingUnavailable: () => 'Notification processing is not ready' }))
  const route = router.routes.find(candidate => candidate.method === 'post' && candidate.path === '/runtime-tests/:slot')
  let status
  let body
  route.handler({ params: { slot: 'a' }, body: {} }, { status(value) { status = value; return this }, json(value) { body = value } })
  assert.equal(status, 503)
  assert.equal(body.state, 'REJECTED')
})

test('rejects starting a disabled alarm sound test server-side', () => {
  const router = fakeRouter()
  registerHttpRoutes(router, api({ audioTest: { enabled: () => false } }))
  const route = router.routes.find(candidate => candidate.method === 'post' && candidate.path === '/audio-test/start')
  let status
  let body
  route.handler({}, { status(value) { status = value; return this }, json(value) { body = value } })
  assert.equal(status, 409)
  assert.equal(body.state, 'REJECTED')
  assert.match(body.message, /disabled/)
})

test('passes only the submitted visible IDs to a bulk action', async () => {
  let received
  const router = fakeRouter()
  registerHttpRoutes(router, api({ actionAll: async (action, ids) => { received = { action, ids }; return ids.length } }))
  const route = router.routes.find(candidate => candidate.method === 'post' && candidate.path === '/notifications/action-all/:action')
  let status
  let body
  await route.handler(
    { params: { action: 'acknowledge' }, body: { ids: ['visible-warn'] } },
    { status(value) { status = value; return this }, json(value) { body = value } }
  )
  assert.deepEqual(received, { action: 'acknowledge', ids: ['visible-warn'] })
  assert.equal(status, 202)
  assert.deepEqual(body, { state: 'ACCEPTED', count: 1 })
})

test('does not reinterpret a history repository failure as an action conflict', async () => {
  const router = fakeRouter()
  const failure = new Error('history write failed')
  registerHttpRoutes(router, api({ clearHistory: async () => { throw failure } }))
  const route = router.routes.find(candidate => candidate.method === 'delete' && candidate.path === '/history')
  await assert.rejects(route.handler({ query: {} }, {}), failure)
})
