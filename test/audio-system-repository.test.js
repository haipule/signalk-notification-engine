'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const AudioSystemRepository = require('../lib/audio-system-repository')

test('persists unresolved audio system failures atomically', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-system-'))
  const repository = new AudioSystemRepository(directory)
  repository.save({ version: 1, failures: [{ occurrenceId: 'one', path: 'notifications.test.one' }] })
  await repository.flush()
  assert.equal((await repository.load()).failures[0].occurrenceId, 'one')
})

test('malformed audio system state fails empty', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-system-invalid-'))
  await fs.writeFile(path.join(directory, 'audio-system-notification.json'), '{invalid')
  const errors = []
  const repository = new AudioSystemRepository(directory, { onError: message => errors.push(message) })
  assert.deepEqual(await repository.load(), { version: 1, failures: [] })
  assert.equal(errors.length, 1)
})
