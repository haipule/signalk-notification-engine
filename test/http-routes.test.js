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

test('does not reinterpret a history repository failure as an action conflict', async () => {
  const router = fakeRouter()
  const failure = new Error('history write failed')
  registerHttpRoutes(router, api({ clearHistory: async () => { throw failure } }))
  const route = router.routes.find(candidate => candidate.method === 'delete' && candidate.path === '/history')
  await assert.rejects(route.handler({ query: {} }, {}), failure)
})
