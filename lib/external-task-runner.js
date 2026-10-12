'use strict'

const path = require('node:path')
const { spawn } = require('node:child_process')

const OUTPUT_LIMIT = 4096
const MAX_ATTEMPTS = 5000

/**
 * Deliver configured notification side effects without becoming notification
 * authority. The runner starts only exact, per-file Plugin Config grants and
 * never changes the originating Signal K notification.
 */
class ExternalTaskRunner {
  constructor({ spawnProcess = spawn, killProcess = process.kill, onAudit = () => {}, onRegistryChange = () => {}, log = () => {}, now = () => Date.now() } = {}) {
    this.spawnProcess = spawnProcess
    this.killProcess = killProcess
    this.onAudit = onAudit
    this.onRegistryChange = onRegistryChange
    this.log = log
    this.now = now
    this.enabled = false
    this.allowed = new Map()
    this.rules = []
    this.readValue = () => undefined
    this.maxConcurrent = 2
    this.attempted = new Map()
    this.active = new Map()
    this.lastResult = null
  }

  /** Install protected grants and declarative Builder rules without running them. */
  configure(options = {}, rules = [], readValue = () => undefined) {
    const normalized = normalizeExternalTasks(options)
    this.allowed = new Map(normalized.allowedExecutables.map(entry => [entry.path, entry]))
    this.maxConcurrent = normalized.maxConcurrent
    this.rules = Array.isArray(rules) ? structuredClone(rules) : []
    this.readValue = readValue
  }

  /** Permit future store changes after startup reconstruction is complete. */
  enable() { this.enabled = true }

  /** Suspend new delivery while retaining the persisted once-only registry. */
  disable() { this.enabled = false }

  /** Restore accepted attempts so restart reconstruction cannot repeat them. */
  restore(entries) {
    this.attempted.clear()
    for (const entry of Array.isArray(entries) ? entries.slice(-MAX_ATTEMPTS) : []) {
      if (typeof entry?.key !== 'string' || !entry.key) continue
      this.attempted.set(entry.key, structuredClone(entry))
    }
  }

  /** Return bounded accepted-attempt evidence for atomic restart persistence. */
  restartSnapshot() { return [...this.attempted.values()].slice(-MAX_ATTEMPTS).map(entry => structuredClone(entry)) }

  /**
   * Handle a real store transition. Re-evaluation and unchanged snapshots do
   * not call this method with a changed event, while startup stays disabled.
   */
  apply(event) {
    if (!this.enabled || !['raised', 'updated'].includes(event?.type) || !event.notification) return false
    const executable = resolveExecute(this.rules, event.notification, this.readValue)
    if (!executable) return false
    if (event.type === 'updated' && resolveExecute(this.rules, event.previous, this.readValue) === executable) return false
    const key = attemptKey(event.notification.occurrenceId, executable)
    if (this.attempted.has(key) || this.active.has(key)) return false
    const grant = this.allowed.get(executable)
    if (!grant) return this.#deny(event.notification, executable, 'path_not_configured')
    if (!grant.enabled) return this.#deny(event.notification, executable, 'task_disabled')
    if (event.notification.state === 'normal' && !grant.allowNormal) return this.#deny(event.notification, executable, 'normal_not_allowed')
    if ([...this.active.values()].some(execution => execution.path === executable)) return this.#deny(event.notification, executable, 'task_already_active')
    if (this.active.size >= this.maxConcurrent) return this.#deny(event.notification, executable, 'concurrency_limit')
    return this.#start(event.notification, grant, key)
  }

  /** Stop every owned process group and prevent new delivery. */
  shutdown() {
    this.enabled = false
    for (const execution of this.active.values()) {
      clearTimeout(execution.timer)
      clearTimeout(execution.killTimer)
      this.#terminate(execution, 'SIGTERM')
    }
    this.active.clear()
  }

  /** Return read-only operational state and the most recent delivery result. */
  diagnostics() {
    return {
      configured: this.allowed.size,
      enabled: [...this.allowed.values()].filter(entry => entry.enabled).length,
      active: this.active.size,
      maxConcurrent: this.maxConcurrent,
      attempted: this.attempted.size,
      activeTasks: [...this.active.values()].map(execution => ({
        path: execution.path,
        occurrenceId: execution.notification.occurrenceId,
        startedAt: execution.startedAt,
        timeoutSeconds: execution.timeoutSeconds
      })),
      lastResult: this.lastResult ? structuredClone(this.lastResult) : null
    }
  }

  #deny(notification, executable, reason) {
    const result = {
      result: 'denied', reason, path: executable,
      occurrenceId: notification.occurrenceId, notificationPath: notification.path,
      completedAt: new Date(this.now()).toISOString()
    }
    this.lastResult = result
    this.onAudit('external_task_denied', notification, result)
    this.log(`External task denied path=${executable} reason=${reason}`)
    return false
  }

  #start(notification, grant, key) {
    const startedAt = new Date(this.now()).toISOString()
    const attempt = { key, occurrenceId: notification.occurrenceId, path: grant.path, acceptedAt: startedAt }
    // Persist acceptance before spawn. Across a crash this intentionally gives
    // at-most-once delivery rather than risking a duplicate external effect.
    this.attempted.set(key, attempt)
    this.onRegistryChange()
    let child
    try {
      child = this.spawnProcess(grant.path, [], { shell: false, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
      this.#finishStartFailure(notification, grant.path, startedAt, error)
      return true
    }
    const execution = {
      child, key, path: grant.path, notification: structuredClone(notification), startedAt,
      startedMs: this.now(), timeoutSeconds: grant.timeoutSeconds,
      stdout: '', stderr: '', settled: false, timer: null, killTimer: null, timedOut: false
    }
    this.active.set(key, execution)
    child.stdout?.on('data', chunk => { execution.stdout = appendLimited(execution.stdout, chunk) })
    child.stderr?.on('data', chunk => { execution.stderr = appendLimited(execution.stderr, chunk) })
    child.once('error', error => this.#finish(execution, { result: 'start_failed', errorCode: error.code || null, error: error.message }))
    child.once('close', (code, signal) => this.#finish(execution, {
      result: execution.timedOut ? 'timed_out' : 'completed', exitCode: code, signal: signal || null
    }))
    execution.timer = setTimeout(() => {
      execution.timedOut = true
      this.#terminate(execution, 'SIGTERM')
      execution.killTimer = setTimeout(() => this.#terminate(execution, 'SIGKILL'), 2000)
      execution.killTimer.unref?.()
    }, grant.timeoutSeconds * 1000)
    execution.timer.unref?.()
    this.onAudit('external_task_accepted', notification, { path: grant.path, startedAt, timeoutSeconds: grant.timeoutSeconds })
    this.log(`External task accepted path=${grant.path} occurrence=${notification.occurrenceId}`)
    return true
  }

  #finishStartFailure(notification, executable, startedAt, error) {
    const result = {
      result: 'start_failed', path: executable, occurrenceId: notification.occurrenceId,
      notificationPath: notification.path, startedAt, completedAt: new Date(this.now()).toISOString(),
      durationMs: 0, errorCode: error.code || null, error: error.message, stdout: '', stderr: ''
    }
    this.lastResult = result
    this.onAudit('external_task_start_failed', notification, result)
    this.log(`External task start failed path=${executable}: ${error.message}`)
  }

  #finish(execution, outcome) {
    if (execution.settled) return
    execution.settled = true
    clearTimeout(execution.timer)
    clearTimeout(execution.killTimer)
    this.active.delete(execution.key)
    const result = {
      ...outcome,
      path: execution.path,
      occurrenceId: execution.notification.occurrenceId,
      notificationPath: execution.notification.path,
      startedAt: execution.startedAt,
      completedAt: new Date(this.now()).toISOString(),
      durationMs: Math.max(0, this.now() - execution.startedMs),
      stdout: execution.stdout,
      stderr: execution.stderr
    }
    this.lastResult = result
    const type = outcome.result === 'completed' ? 'external_task_completed'
      : outcome.result === 'timed_out' ? 'external_task_timed_out'
        : 'external_task_start_failed'
    this.onAudit(type, execution.notification, result)
    this.log(`External task ${outcome.result} path=${execution.path}`)
  }

  #terminate(execution, signal) {
    try {
      if (Number.isInteger(execution.child.pid) && execution.child.pid > 0) this.killProcess(-execution.child.pid, signal)
      else execution.child.kill?.(signal)
    } catch {
      try { execution.child.kill?.(signal) } catch {}
    }
  }
}

/** Normalize protected per-file grants without interpreting executable content. */
function normalizeExternalTasks(value = {}) {
  const maxConcurrent = Number.isInteger(value.maxConcurrent) ? Math.max(1, Math.min(4, value.maxConcurrent)) : 2
  const allowedExecutables = []
  const seen = new Set()
  for (const item of Array.isArray(value.allowedExecutables) ? value.allowedExecutables : []) {
    const executable = typeof item?.path === 'string' ? item.path : ''
    if (!path.isAbsolute(executable) || seen.has(executable)) continue
    seen.add(executable)
    allowedExecutables.push({
      name: String(item.name || path.basename(executable)).slice(0, 64),
      path: executable,
      enabled: item.enabled === true,
      timeoutSeconds: Number.isInteger(item.timeoutSeconds) ? Math.max(1, Math.min(60, item.timeoutSeconds)) : 10,
      allowNormal: item.allowNormal === true
    })
  }
  return { maxConcurrent, allowedExecutables }
}

/** Resolve the most-specific matching execute action with normal inheritance. */
function resolveExecute(rules, notification, readValue = () => undefined) {
  if (!notification) return null
  const matching = (Array.isArray(rules) ? rules : [])
    .filter(rule => matches(rule.match || {}, notification, readValue))
    .sort((left, right) => specificity(left) - specificity(right))
  let executable = null
  for (const rule of matching) {
    if (typeof rule.actions?.execute === 'string') executable = rule.actions.execute
  }
  return executable
}

function matches(match, notification, readValue) {
  if (match.state && match.state !== notification.state) return false
  if (match.path && match.path.includes('*')) {
    const pattern = match.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    if (!new RegExp(`^${pattern}$`).test(String(notification.path || ''))) return false
  } else if (match.path && match.path !== notification.path) return false
  return (match.conditions || []).every(condition => compare(readValue(condition.path), condition.operator, condition.value))
}

function compare(actual, operator, expected) {
  if (actual === undefined) return false
  if (operator === 'eq') return actual === expected
  if (operator === 'neq') return actual !== expected
  if (operator === '>') return actual > expected
  if (operator === '>=') return actual >= expected
  if (operator === '<') return actual < expected
  if (operator === '<=') return actual <= expected
  return false
}

function specificity(rule) {
  const match = rule.match || {}
  const base = match.path && !match.path.includes('*') ? 400 : match.path ? 300 : 100
  return base + (Array.isArray(match.conditions) ? match.conditions.length : 0)
}

function attemptKey(occurrenceId, executable) { return `${occurrenceId || 'unknown'}\u0000${executable}` }
function appendLimited(current, chunk) { return `${current}${String(chunk)}`.slice(0, OUTPUT_LIMIT) }

module.exports = { ExternalTaskRunner, normalizeExternalTasks, resolveExecute }
