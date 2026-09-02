'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const HistoryRepository = require('../lib/history-repository')

test('persists history atomically and reloads it after restart', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-'))
  const repository = new HistoryRepository(directory, { limit: 2 })

  repository.append({ type: 'raised', at: '2026-08-23T00:00:00Z', notification: { id: 'one' } })
  repository.append({ type: 'action_requested', action: 'acknowledge', at: '2026-08-23T00:00:01Z', notification: { id: 'one' } })
  await repository.flush()

  const restored = new HistoryRepository(directory, { limit: 2 })
  const events = await restored.load()
  assert.equal(events.length, 2)
  assert.equal(events[0].action, 'acknowledge')
})

test('prunes events before a retention timestamp', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-retention-'))
  const repository = new HistoryRepository(directory)
  repository.append({ type: 'raised', at: '2026-08-01T00:00:00Z', notification: { id: 'old' } })
  repository.append({ type: 'raised', at: '2026-08-29T00:00:00Z', notification: { id: 'new' } })
  await repository.flush()

  await repository.pruneBefore(Date.parse('2026-08-15T00:00:00Z'))

  assert.deepEqual(repository.events.map(event => event.notification.id), ['new'])
})

test('clears local history without affecting notification records', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-clear-'))
  const repository = new HistoryRepository(directory)
  repository.append({ type: 'raised', at: '2026-08-23T00:00:00Z', notification: { id: 'one' } })
  await repository.flush()

  await repository.clear()

  assert.deepEqual(repository.events, [])
  await assert.rejects(fs.readFile(path.join(directory, 'notification-history.json')))
})

test('serializes events appended while history is being cleared', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-race-'))
  const repository = new HistoryRepository(directory)
  repository.append({ type: 'raised', at: '2026-08-23T00:00:00Z', notification: { id: 'old' } })

  const clearing = repository.clear()
  repository.append({ type: 'raised', at: '2026-08-23T00:00:01Z', notification: { id: 'new' } })
  await clearing
  await repository.flush()

  const restored = new HistoryRepository(directory)
  const events = await restored.load()
  assert.deepEqual(events.map(event => event.notification.id), ['new'])
})

test('returns an empty history after a malformed file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-history-invalid-'))
  const filePath = path.join(directory, 'notification-history.json')
  await fs.writeFile(filePath, '{not-json')
  const errors = []
  const repository = new HistoryRepository(directory, { onError: message => errors.push(message) })

  assert.deepEqual(await repository.load(), [])
  assert.equal(errors.length, 1)
})
