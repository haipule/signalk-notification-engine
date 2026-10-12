'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const RestartStateRepository = require('../lib/restart-state-repository')

test('persists restart correlation atomically and reloads it', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-restart-state-'))
  const repository = new RestartStateRepository(directory)
  repository.save({
    notifications: [{ id: 'one', path: 'notifications.test', occurrenceId: 'occurrence-one' }],
    completedPlayback: [{ key: 'occurrence-one', signature: 'warn.wav|1|0', completed: true }],
    externalTaskAttempts: [{ key: 'occurrence-one\u0000/opt/task.sh', path: '/opt/task.sh' }]
  })
  await repository.flush()

  const restored = await new RestartStateRepository(directory).load()
  assert.equal(restored.notifications[0].occurrenceId, 'occurrence-one')
  assert.equal(restored.completedPlayback[0].completed, true)
  assert.equal(restored.externalTaskAttempts[0].path, '/opt/task.sh')
})

test('malformed restart state fails empty without affecting notification authority', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'notification-restart-state-'))
  await fs.writeFile(path.join(directory, 'restart-state.json'), '{bad json')
  const errors = []
  const restored = await new RestartStateRepository(directory, { onError: message => errors.push(message) }).load()
  assert.deepEqual(restored, { version: 1, notifications: [], completedPlayback: [], externalTaskAttempts: [] })
  assert.equal(errors.length, 1)
})
