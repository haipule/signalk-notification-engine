'use strict'

/**
 * Track operational timings without becoming authoritative for notifications.
 * Diagnostics are observational only and never change Signal K state.
 */
class Diagnostics {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now
    this.startedAt = new Date(this.now()).toISOString()
    this.snapshot = {
      lastStartedAt: null,
      lastCompletedAt: null,
      durationMs: null,
      lastSuccessfulAt: null,
      lastSuccessfulDurationMs: null,
      lastError: null,
      active: false,
      pending: false,
      completedCount: 0,
      failedCount: 0,
      timeoutCount: 0,
      coalescedCount: 0,
      currentConcurrency: 0,
      maxConcurrency: 0
    }
    this.delta = { lastReceivedAt: null, count: 0 }
  }

  beginSnapshot() {
    const startedMs = this.now()
    this.snapshot.lastStartedAt = new Date(startedMs).toISOString()
    this.snapshot.currentConcurrency += 1
    this.snapshot.maxConcurrency = Math.max(this.snapshot.maxConcurrency, this.snapshot.currentConcurrency)
    this.snapshot.active = true
    return (error, { timedOut = false } = {}) => {
      const completedMs = this.now()
      this.snapshot.lastCompletedAt = new Date(completedMs).toISOString()
      this.snapshot.durationMs = completedMs - startedMs
      this.snapshot.lastError = error ? { message: error.message, at: this.snapshot.lastCompletedAt } : null
      this.snapshot.currentConcurrency = Math.max(0, this.snapshot.currentConcurrency - 1)
      this.snapshot.active = this.snapshot.currentConcurrency > 0
      if (error) {
        this.snapshot.failedCount += 1
        if (timedOut) this.snapshot.timeoutCount += 1
      } else {
        this.snapshot.completedCount += 1
        this.snapshot.lastSuccessfulAt = this.snapshot.lastCompletedAt
        this.snapshot.lastSuccessfulDurationMs = this.snapshot.durationMs
      }
    }
  }

  /** Record one suppressed overlap and retain one pending follow-up marker. */
  recordSnapshotCoalesced() {
    this.snapshot.coalescedCount += 1
    this.snapshot.pending = true
  }

  /** Update the read-only scheduler state. */
  setSnapshotPending(pending) {
    this.snapshot.pending = pending === true
  }

  /** End observational activity synchronously when the service is stopped. */
  cancelSnapshot() {
    this.snapshot.active = false
    this.snapshot.pending = false
    this.snapshot.currentConcurrency = 0
  }

  recordDelta() {
    this.delta.lastReceivedAt = new Date(this.now()).toISOString()
    this.delta.count += 1
  }

  toJSON(extra = {}) {
    return { startedAt: this.startedAt, snapshot: { ...this.snapshot }, delta: { ...this.delta }, ...extra }
  }
}

module.exports = Diagnostics
