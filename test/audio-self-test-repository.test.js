'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const AudioSelfTestRepository = require('../lib/audio-self-test-repository')

test('persists the last terminal alarm sound test independently of History', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-self-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const repository = new AudioSelfTestRepository(directory)
  const first = { state: 'passed_heard', passedAt: '2026-10-07T12:00:00.000Z' }
  const latest = { state: 'not_heard', completedAt: '2026-10-12T12:00:00.000Z' }

  repository.save(first)
  repository.save(latest)
  await repository.flush()

  assert.deepEqual(await new AudioSelfTestRepository(directory).load(), latest)
  assert.equal((await fs.stat(path.join(directory, 'audio-self-test.json'))).mode & 0o777, 0o600)
})

test('does not persist an in-progress alarm sound test across restart', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-self-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const repository = new AudioSelfTestRepository(directory)

  repository.save({ state: 'awaiting_feedback', feedbackDeadlineAt: '2026-10-12T12:00:15.000Z' })
  await repository.flush()

  assert.equal(await repository.load(), null)
})

test('ignores malformed persistent alarm sound test data and reports the read error', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-self-test-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  await fs.writeFile(path.join(directory, 'audio-self-test.json'), '{broken')
  const errors = []
  const repository = new AudioSelfTestRepository(directory, { onError: message => errors.push(message) })

  assert.equal(await repository.load(), null)
  assert.match(errors[0], /Could not load alarm sound test state/)
})
