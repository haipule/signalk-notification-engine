'use strict'

/**
 * Track one local sound playback run independently of Signal K state.
 *
 * Zero represents an unbounded loop. Positive counts represent the exact
 * number of backend processes that may be started for this run.
 */
class AudioRepeatPlan {
  constructor(count, pauseSeconds = 0) {
    if (!Number.isInteger(count) || count < 0 || count > 99) throw new Error('Audio repeat count must be an integer from 0 to 99')
    if (!Number.isInteger(pauseSeconds) || pauseSeconds < 0 || pauseSeconds > 5) throw new Error('Audio pause must be an integer from 0 to 5 seconds')
    this.count = count
    this.pauseSeconds = pauseSeconds
    this.started = 0
  }

  /** Record one backend start and return its one-based sequence number. */
  startAttempt() {
    this.started += 1
    return this.started
  }

  /** Return whether a successful backend exit must be followed by another play. */
  hasNext() {
    return this.count === 0 || this.started < this.count
  }

  /** Return the configured delay before the next play, or null when complete. */
  nextDelayMs() {
    return this.hasNext() ? this.pauseSeconds * 1000 : null
  }
}

module.exports = AudioRepeatPlan
