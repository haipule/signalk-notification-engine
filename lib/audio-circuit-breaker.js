'use strict'

const DEFAULT_FAILURE_THRESHOLD = 5
const DEFAULT_PROBE_INTERVAL_MS = 5 * 60 * 1000

/**
 * Bound repeated local audio failures without changing Signal K state.
 *
 * Breaker entries are keyed by the current local occurrence ID, while the
 * stable identity allows an active lifecycle to adopt persisted state after a
 * plugin restart assigns a new occurrence ID.
 */
class AudioCircuitBreaker {
  constructor({
    failureThreshold = DEFAULT_FAILURE_THRESHOLD,
    probeIntervalMs = DEFAULT_PROBE_INTERVAL_MS,
    now = () => Date.now(),
    onTransition = () => {},
    onChange = () => {}
  } = {}) {
    this.failureThreshold = failureThreshold
    this.probeIntervalMs = probeIntervalMs
    this.now = now
    this.onTransition = onTransition
    this.onChange = onChange
    this.states = new Map()
    this.globalProbeKey = null
    this.lastTransition = null
  }

  /** Restore persisted local policy state without replaying audit events. */
  restore(snapshot) {
    this.states.clear()
    this.globalProbeKey = null
    this.lastTransition = snapshot?.lastTransition ? structuredClone(snapshot.lastTransition) : null
    const restoredAt = this.now()
    for (const candidate of snapshot?.states || []) {
      if (!candidate?.key || !candidate.identity) continue
      const state = normalizeState(candidate)
      if (state.state === 'half-open') {
        state.state = 'open'
        state.probeInProgress = false
        state.nextProbeAt = Math.max(Number(state.nextProbeAt) || 0, restoredAt + this.probeIntervalMs)
      }
      this.states.set(state.key, state)
    }
  }

  /** Return a persistence-safe snapshot of all active breaker entries. */
  snapshot() {
    return { version: 1, lastTransition: this.lastTransition ? structuredClone(this.lastTransition) : null, states: [...this.states.values()].map(state => structuredClone(state)) }
  }

  /** Return read-only operational state for Diagnostics. */
  toJSON() {
    return {
      failureThreshold: this.failureThreshold,
      probeIntervalMs: this.probeIntervalMs,
      globalProbeInProgress: this.globalProbeKey,
      openCount: [...this.states.values()].filter(state => state.state === 'open' || state.state === 'half-open').length,
      lastTransition: this.lastTransition ? structuredClone(this.lastTransition) : null,
      states: [...this.states.values()].map(state => ({
        ...structuredClone(state),
        nextProbeAtMs: state.nextProbeAt,
        nextProbeAt: state.nextProbeAt ? iso(state.nextProbeAt) : null
      }))
    }
  }

  /** Adopt persisted state for the currently reconstructed notification. */
  adopt(notification) {
    const key = String(notification?.occurrenceId || '')
    if (!key) return null
    const identity = stableIdentity(notification)
    let state = this.states.get(key)
    if (!state) {
      state = [...this.states.values()].find(candidate => candidate.identity === identity) || null
      if (state) {
        this.states.delete(state.key)
        state.key = key
        this.states.set(key, state)
      }
    }
    if (state) state.notification = notificationSummary(notification)
    return state
  }

  /**
   * Decide whether a normal attempt or a due half-open probe may start.
   * Only one half-open probe is allowed globally at a time.
   */
  beginAttempt(notification) {
    const state = this.adopt(notification)
    if (!state || state.state === 'closed') return { allowed: true, probe: false }
    const now = this.now()
    const due = state.watchdogProbeAvailable || now >= Number(state.nextProbeAt || 0)
    if (!due) {
      state.suppressedRetries += 1
      this.changed()
      return { allowed: false, probe: false, retryAt: state.nextProbeAt }
    }
    if (this.globalProbeKey && this.globalProbeKey !== state.key) {
      state.suppressedRetries += 1
      state.nextProbeAt = now + this.probeIntervalMs
      this.changed()
      return { allowed: false, probe: false, retryAt: state.nextProbeAt }
    }
    state.state = 'half-open'
    state.probeInProgress = true
    state.watchdogProbeAvailable = false
    this.globalProbeKey = state.key
    this.transition('audio_circuit_probe_started', state)
    this.changed()
    return { allowed: true, probe: true }
  }

  /** Count one genuine backend failure and open/reopen when required. */
  recordFailure(notification, result) {
    const state = this.ensure(notification)
    const wasProbe = state.state === 'half-open'
    if (wasProbe && this.globalProbeKey === state.key) this.globalProbeKey = null
    state.failureCount += 1
    state.lastFailureAt = iso(this.now())
    state.lastError = resultError(result)
    state.probeInProgress = false
    if (wasProbe) {
      state.state = 'open'
      state.openedAt ||= state.lastFailureAt
      state.nextProbeAt = this.now() + this.probeIntervalMs
      this.transition('audio_circuit_probe_failed', state)
    } else {
      this.transition('audio_circuit_failure', state)
      if (state.failureCount >= this.failureThreshold) {
        state.state = 'open'
        state.openedAt ||= state.lastFailureAt
        state.nextProbeAt = this.now() + this.probeIntervalMs
        this.transition('audio_circuit_opened', state)
      }
    }
    this.changed()
    return structuredClone(state)
  }

  /** Close and forget a breaker only after technically successful playback. */
  recordSuccess(notification) {
    const state = this.adopt(notification)
    if (!state) return false
    if (this.globalProbeKey === state.key) this.globalProbeKey = null
    this.transition('audio_circuit_recovered', { ...state, state: 'closed', probeInProgress: false })
    this.states.delete(state.key)
    this.changed()
    return true
  }

  /** Remove local breaker state when Signal K authoritatively ends a lifecycle. */
  endLifecycle(notification) {
    const state = this.adopt(notification)
    if (!state) return false
    if (this.globalProbeKey === state.key) this.globalProbeKey = null
    this.transition('audio_circuit_closed_on_lifecycle_end', { ...state, state: 'closed', probeInProgress: false })
    this.states.delete(state.key)
    this.changed()
    return true
  }

  /**
   * Permit one globally serialized early probe after passive device recovery.
   * Other open lifecycles retain their existing five-minute schedule.
   */
  watchdogRecovered() {
    if (this.globalProbeKey) return null
    const state = [...this.states.values()]
      .filter(candidate => candidate.state === 'open' && !candidate.probeInProgress)
      .sort((left, right) => Date.parse(left.openedAt || 0) - Date.parse(right.openedAt || 0))[0]
    if (!state) return null
    state.watchdogProbeAvailable = true
    state.nextProbeAt = this.now()
    this.changed()
    return state.key
  }

  /**
   * Remove persisted entries whose authoritative notification lifecycle is no
   * longer present after startup reconstruction.
   */
  reconcileActive(notifications) {
    const activeIdentities = new Set((notifications || []).map(stableIdentity))
    let removed = 0
    for (const state of [...this.states.values()]) {
      if (activeIdentities.has(state.identity)) continue
      if (this.globalProbeKey === state.key) this.globalProbeKey = null
      this.transition('audio_circuit_closed_on_lifecycle_end', { ...state, state: 'closed', probeInProgress: false })
      this.states.delete(state.key)
      removed += 1
    }
    if (removed > 0) this.changed()
    return removed
  }

  get(key) {
    const state = this.states.get(key)
    return state ? structuredClone(state) : null
  }

  ensure(notification) {
    let state = this.adopt(notification)
    if (state) return state
    const key = String(notification?.occurrenceId || '')
    state = normalizeState({
      key,
      identity: stableIdentity(notification),
      notification: notificationSummary(notification),
      state: 'closed'
    })
    this.states.set(key, state)
    return state
  }

  transition(type, state) {
    const event = { type, at: iso(this.now()), circuit: structuredClone(state), notification: structuredClone(state.notification) }
    this.lastTransition = { type: event.type, at: event.at, key: state.key }
    this.onTransition(event)
  }

  changed() {
    this.onChange(this.snapshot())
  }
}

function normalizeState(candidate) {
  return {
    key: String(candidate.key),
    identity: String(candidate.identity),
    notification: candidate.notification ? structuredClone(candidate.notification) : null,
    state: ['closed', 'open', 'half-open'].includes(candidate.state) ? candidate.state : 'closed',
    failureCount: Math.max(0, Number(candidate.failureCount) || 0),
    lastFailureAt: candidate.lastFailureAt || null,
    lastError: candidate.lastError || null,
    openedAt: candidate.openedAt || null,
    nextProbeAt: Number(candidate.nextProbeAt) || null,
    probeInProgress: candidate.probeInProgress === true,
    watchdogProbeAvailable: candidate.watchdogProbeAvailable === true,
    suppressedRetries: Math.max(0, Number(candidate.suppressedRetries) || 0)
  }
}

function stableIdentity(notification) {
  if (notification?.historyKey) return String(notification.historyKey)
  const source = notification?.source?.label || notification?.source?.type || ''
  return `${notification?.path || notification?.id || ''}|${source}`
}

function notificationSummary(notification) {
  return {
    id: notification?.id || null,
    occurrenceId: notification?.occurrenceId || null,
    path: notification?.path || '',
    source: notification?.source ? structuredClone(notification.source) : null,
    state: notification?.state || 'unknown',
    message: notification?.message || '',
    historyKey: notification?.historyKey || stableIdentity(notification)
  }
}

function resultError(result) {
  return result?.error?.message || result?.stderr || (result?.signal ? `Player terminated by ${result.signal}` : `Player exited with code ${result?.code}`)
}

function iso(milliseconds) {
  return new Date(milliseconds).toISOString()
}

module.exports = { AudioCircuitBreaker, DEFAULT_FAILURE_THRESHOLD, DEFAULT_PROBE_INTERVAL_MS }
