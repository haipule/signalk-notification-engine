'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const AudioCircuitRepository = require('../lib/audio-circuit-repository')

test('persists circuit state atomically and reloads it', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-circuit-'))
  const repository = new AudioCircuitRepository(directory)
  repository.save({ version: 1, states: [{ key: 'one', identity: 'path|source', state: 'open', failureCount: 5 }] })
  await repository.flush()

  const restored = new AudioCircuitRepository(directory)
  const snapshot = await restored.load()
  assert.equal(snapshot.states[0].failureCount, 5)
  assert.equal(snapshot.states[0].state, 'open')
})

test('malformed circuit state fails empty without affecting notifications', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-circuit-invalid-'))
  await fs.writeFile(path.join(directory, 'audio-circuit-breakers.json'), '{invalid')
  const errors = []
  const repository = new AudioCircuitRepository(directory, { onError: message => errors.push(message) })

  assert.deepEqual(await repository.load(), { version: 1, lastTransition: null, states: [] })
  assert.equal(errors.length, 1)
})
