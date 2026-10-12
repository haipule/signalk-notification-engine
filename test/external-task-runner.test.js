'use strict'

const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const { PassThrough } = require('node:stream')
const test = require('node:test')

const { ExternalTaskRunner, normalizeExternalTasks, resolveExecute } = require('../lib/external-task-runner')

function notification(overrides = {}) {
  return {
    id: 'one', occurrenceId: 'occurrence-one', path: 'notifications.test.task',
    state: 'alarm', message: 'Run task', ...overrides
  }
}

function rule(executable = '/opt/tasks/test.sh', overrides = {}) {
  return { id: 'alarm-1', match: { state: 'alarm' }, actions: { execute: executable }, ...overrides }
}

function child(pid = 1234) {
  const process = new EventEmitter()
  process.pid = pid
  process.stdout = new PassThrough()
  process.stderr = new PassThrough()
  process.kill = () => {}
  return process
}

function configuration(overrides = {}) {
  return {
    maxConcurrent: 2,
    allowedExecutables: [{ name: 'Test', path: '/opt/tasks/test.sh', enabled: true, timeoutSeconds: 10, allowNormal: false }],
    ...overrides
  }
}

test('normalizes only exact absolute per-file grants', () => {
  assert.deepEqual(normalizeExternalTasks({ maxConcurrent: 9, allowedExecutables: [
    { name: 'One', path: '/opt/one.sh', enabled: true, timeoutSeconds: 99 },
    { name: 'Duplicate', path: '/opt/one.sh', enabled: true },
    { name: 'Relative', path: 'relative.sh', enabled: true }
  ] }), {
    maxConcurrent: 4,
    allowedExecutables: [{ name: 'One', path: '/opt/one.sh', enabled: true, timeoutSeconds: 60, allowNormal: false }]
  })
})

test('resolves a specific execute branch over a general state branch', () => {
  const rules = [
    rule('/opt/tasks/general.sh'),
    rule('/opt/tasks/anchor.sh', { id: 'alarm-2', match: { state: 'alarm', path: 'notifications.navigation.anchor' } })
  ]
  assert.equal(resolveExecute(rules, notification({ path: 'notifications.navigation.anchor' })), '/opt/tasks/anchor.sh')
  assert.equal(resolveExecute(rules, notification()), '/opt/tasks/general.sh')
})

test('starts one exact enabled path once per occurrence and audits completion', async () => {
  const audits = []
  const processes = []
  const runner = new ExternalTaskRunner({
    spawnProcess(executable, args, options) {
      assert.equal(executable, '/opt/tasks/test.sh')
      assert.deepEqual(args, [])
      assert.deepEqual(options, { shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
      const process = child()
      processes.push(process)
      return process
    },
    onAudit: (type, record, detail) => audits.push({ type, record, detail })
  })
  runner.configure(configuration(), [rule()])
  runner.enable()

  assert.equal(runner.apply({ type: 'raised', notification: notification() }), true)
  assert.equal(runner.apply({ type: 'updated', notification: notification({ message: 'Still active' }) }), false)
  processes[0].stdout.write('delivered\n')
  processes[0].emit('close', 0, null)
  await new Promise(resolve => setImmediate(resolve))

  assert.deepEqual(audits.map(entry => entry.type), ['external_task_accepted', 'external_task_completed'])
  assert.equal(runner.diagnostics().lastResult.stdout, 'delivered\n')
  assert.equal(runner.diagnostics().lastResult.exitCode, 0)
  assert.equal(runner.diagnostics().active, 0)
  assert.equal(runner.restartSnapshot().length, 1)
})

test('does not run during startup and reports a disabled exact grant after enable', () => {
  const audits = []
  const runner = new ExternalTaskRunner({ spawnProcess: () => { throw new Error('must not spawn') }, onAudit: type => audits.push(type) })
  runner.configure(configuration({ allowedExecutables: [{ name: 'Test', path: '/opt/tasks/test.sh', enabled: false, timeoutSeconds: 10 }] }), [rule()])

  assert.equal(runner.apply({ type: 'raised', notification: notification() }), false)
  runner.enable()
  assert.equal(runner.apply({ type: 'raised', notification: notification() }), false)
  assert.deepEqual(audits, ['external_task_denied'])
  assert.equal(runner.diagnostics().lastResult.reason, 'task_disabled')
})

test('requires explicit per-file permission for normal-state recovery', () => {
  const audits = []
  const runner = new ExternalTaskRunner({ spawnProcess: () => { throw new Error('must not spawn') }, onAudit: (type, record, detail) => audits.push({ type, detail }) })
  runner.configure(configuration(), [{ id: 'normal-1', match: { state: 'normal' }, actions: { execute: '/opt/tasks/test.sh' } }])
  runner.enable()

  assert.equal(runner.apply({ type: 'updated', notification: notification({ state: 'normal' }) }), false)
  assert.equal(audits[0].detail.reason, 'normal_not_allowed')
})

test('records an OS start error without retrying or changing notification state', () => {
  const audits = []
  const failure = Object.assign(new Error('not found'), { code: 'ENOENT' })
  const runner = new ExternalTaskRunner({ spawnProcess: () => { throw failure }, onAudit: (type, record, detail) => audits.push({ type, record, detail }) })
  runner.configure(configuration(), [rule()])
  runner.enable()
  const record = notification()

  assert.equal(runner.apply({ type: 'raised', notification: record }), true)
  assert.equal(runner.apply({ type: 'updated', notification: record }), false)
  assert.equal(audits[0].type, 'external_task_start_failed')
  assert.equal(audits[0].detail.errorCode, 'ENOENT')
  assert.equal(record.state, 'alarm')
})

test('restored accepted attempts suppress delivery after restart', () => {
  const runner = new ExternalTaskRunner({ spawnProcess: () => { throw new Error('must not spawn') } })
  runner.configure(configuration(), [rule()])
  runner.restore([{ key: 'occurrence-one\u0000/opt/tasks/test.sh', occurrenceId: 'occurrence-one', path: '/opt/tasks/test.sh' }])
  runner.enable()

  assert.equal(runner.apply({ type: 'updated', notification: notification() }), false)
})

test('does not start for an update that already matched the same execute rule', () => {
  const runner = new ExternalTaskRunner({ spawnProcess: () => { throw new Error('must not spawn') } })
  runner.configure(configuration(), [rule()])
  runner.enable()

  assert.equal(runner.apply({ type: 'updated', previous: notification({ message: 'Before' }), notification: notification({ message: 'After' }) }), false)
})

test('caps captured task output', async () => {
  const process = child()
  const runner = new ExternalTaskRunner({ spawnProcess: () => process })
  runner.configure(configuration(), [rule()])
  runner.enable()
  runner.apply({ type: 'raised', notification: notification() })
  process.stdout.write('x'.repeat(5000))
  process.emit('close', 0, null)
  await new Promise(resolve => setImmediate(resolve))

  assert.equal(runner.diagnostics().lastResult.stdout.length, 4096)
})

test('terminates the owned process group at the configured timeout', async () => {
  const process = child(4321)
  const signals = []
  const runner = new ExternalTaskRunner({
    spawnProcess: () => process,
    killProcess(pid, signal) {
      signals.push({ pid, signal })
      queueMicrotask(() => process.emit('close', null, signal))
    }
  })
  runner.configure(configuration({
    allowedExecutables: [{ name: 'Test', path: '/opt/tasks/test.sh', enabled: true, timeoutSeconds: 1 }]
  }), [rule()])
  runner.enable()
  runner.apply({ type: 'raised', notification: notification() })

  await new Promise(resolve => setTimeout(resolve, 1100))

  assert.deepEqual(signals, [{ pid: -4321, signal: 'SIGTERM' }])
  assert.equal(runner.diagnostics().lastResult.result, 'timed_out')
  assert.equal(runner.diagnostics().active, 0)
})

test('does not run the same executable concurrently for another occurrence', () => {
  const process = child()
  const audits = []
  const runner = new ExternalTaskRunner({ spawnProcess: () => process, onAudit: (type, record, detail) => audits.push({ type, detail }) })
  runner.configure(configuration(), [rule()])
  runner.enable()
  runner.apply({ type: 'raised', notification: notification() })

  assert.equal(runner.apply({ type: 'raised', notification: notification({ id: 'two', occurrenceId: 'occurrence-two' }) }), false)
  assert.equal(audits.at(-1).detail.reason, 'task_already_active')
  runner.shutdown()
})
