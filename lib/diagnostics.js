'use strict'

/**
 * Track operational timings without becoming authoritative for notifications.
 * Diagnostics are observational only and never change Signal K state.
 */
class Diagnostics {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now
    this.startedAt = new Date(this.now()).toISOString()
    this.snapshot = { lastStartedAt: null, lastCompletedAt: null, durationMs: null, lastError: null }
    this.delta = { lastReceivedAt: null, count: 0 }
  }

  beginSnapshot() {
    const startedMs = this.now()
    this.snapshot.lastStartedAt = new Date(startedMs).toISOString()
    return error => {
      const completedMs = this.now()
      this.snapshot.lastCompletedAt = new Date(completedMs).toISOString()
      this.snapshot.durationMs = completedMs - startedMs
      this.snapshot.lastError = error ? { message: error.message, at: this.snapshot.lastCompletedAt } : null
    }
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
