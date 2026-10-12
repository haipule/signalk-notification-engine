'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { buildDiagnosticsModel } = require('../public/diagnostics-view')

function healthyServer(overrides = {}) {
  return {
    plugin: { version: '0.1.69' },
    snapshot: { lastError: null },
    nodeRed: { configurationStatus: { state: 'ready' }, runtimeDeployEventsAvailable: true },
    criticalInputs: [{ name: 'GPS', state: 'fresh', observedSource: 'gps', expectedSource: 'gps', ageMs: 20 }],
    audio: { ready: true, activeProcesses: 0, watchdog: { state: 'ready' }, systemNotification: { state: 'normal' } },
    externalTasks: { active: 0 },
    history: { available: true, lastError: null },
    localization: { locales: [{ locale: 'en' }], errors: [] },
    ...overrides
  }
}

test('builds a healthy structured view when browser and server versions match', () => {
  const model = buildDiagnosticsModel({ server: healthyServer(), webAppVersion: '0.1.69', connected: true })
  assert.equal(model.overall, 'healthy')
  assert.equal(model.reloadRequired, false)
  assert.deepEqual(model.sections.map(section => section.key), ['overview', 'browser', 'server', 'inputs', 'audio', 'tasks', 'history', 'localization'])
  assert.equal(model.raw.server.plugin.version, '0.1.69')
})

test('marks a browser/server mismatch as reload required without changing raw data', () => {
  const server = healthyServer()
  const model = buildDiagnosticsModel({ server, webAppVersion: '0.1.68', connected: true })
  assert.equal(model.overall, 'warning')
  assert.equal(model.reloadRequired, true)
  assert.equal(model.raw.server, server)
})

test('surfaces disconnected, invalid configuration, and stale inputs as errors or warnings', () => {
  const model = buildDiagnosticsModel({
    server: healthyServer({
      nodeRed: { configurationStatus: { state: 'error' } },
      criticalInputs: [{ name: 'GPS', state: 'stale' }]
    }),
    webAppVersion: '0.1.69', connected: false
  })
  assert.equal(model.overall, 'error')
  assert.equal(model.sections.find(section => section.key === 'inputs').status, 'warning')
})
