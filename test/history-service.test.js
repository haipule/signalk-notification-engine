'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const HistoryService = require('../lib/history-service')

function fakeStore() {
  return {
    events: [],
    replaceHistory(events) { this.events = structuredClone(events) },
    history() { return structuredClone(this.events) }
  }
}

test('resolves explicit history before rules and otherwise inherits table visibility', () => {
  const service = new HistoryService({ directory: null, store: fakeStore(), resolvePolicy: notification => notification.policy || {} })
  service.setRules([{ pathPrefix: 'notifications.engine', source: 'sensor', history: true }])

  assert.equal(service.shouldRecord({ path: 'notifications.engine.oil', source: { label: 'sensor' } }), true)
  assert.equal(service.shouldRecord({ path: 'notifications.engine.oil', source: { label: 'sensor' }, policy: { history: false } }), false)
  assert.equal(service.shouldRecord({ path: 'notifications.system.visible', source: { label: 'system' }, policy: { visible: true } }), true)
  assert.equal(service.shouldRecord({ path: 'notifications.system.hidden', source: { label: 'system' }, policy: { visible: false } }), false)
  assert.equal(service.shouldRecord({ path: 'notifications.system.hidden-retained', source: { label: 'system' }, policy: { visible: false, history: true } }), true)
  assert.equal(service.shouldRecord({ path: 'notifications.navigation.anchor', source: { label: 'anchor' } }), false)
})

test('loads and applies startup retention without configuration-driven deletion', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-service-'))
  const store = fakeStore()
  const service = new HistoryService({ directory, store, resolvePolicy: () => ({}), now: () => Date.parse('2026-10-05T00:00:00Z') })
  service.configure({ historyRetentionDays: 10 })
  service.append({ at: '2026-09-01T00:00:00Z', notification: { occurrenceId: 'old', path: 'notifications.keep', state: 'warn' } })
  service.append({ at: '2026-10-04T00:00:00Z', notification: { occurrenceId: 'normal', path: 'notifications.engine.oil', state: 'normal' } })
  service.append({ at: '2026-10-04T00:00:00Z', notification: { occurrenceId: 'alarm', path: 'notifications.engine.fire', state: 'alarm' } })
  service.append({ at: '2026-10-04T00:00:00Z', notification: { occurrenceId: 'remove-me', path: 'notifications.keep', state: 'warn' } })
  await service.repository.flush()

  const state = await service.initialize()

  assert.equal(state.lastAudioTest, null)
  assert.deepEqual(store.events.map(event => event.notification.occurrenceId).sort(), ['alarm', 'normal', 'remove-me'])
  await service.stop()
})

test('clear query removes only local matching audit entries', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-service-clear-'))
  const store = fakeStore()
  const service = new HistoryService({ directory, store, resolvePolicy: () => ({}) })
  service.configure()
  service.append({ at: '2026-10-05T00:00:00Z', notification: { occurrenceId: 'one', path: 'notifications.engine.oil' } })
  service.append({ at: '2026-10-05T00:00:01Z', notification: { occurrenceId: 'two', path: 'notifications.navigation.anchor' } })
  await service.repository.flush()

  assert.equal(await service.clear({ path: 'notifications.engine' }), true)
  assert.deepEqual(store.events.map(event => event.notification.occurrenceId), ['two'])
  await service.stop()
})

test('resolves a Signal K data-directory provider only when configured', () => {
  let directory = null
  const service = new HistoryService({ directory: () => directory, store: fakeStore(), resolvePolicy: () => ({}) })
  directory = '/runtime/plugin-data'

  service.configure()

  assert.equal(service.repository.directory, '/runtime/plugin-data')
})
