'use strict'

/**
 * Track which sound configuration has already run for a notification
 * occurrence.
 *
 * A finite `once` or `repeat` completion deliberately remains registered.
 * Later snapshot or condition refreshes for the same occurrence must not turn
 * an unchanged finite sound into an implicit periodic alarm. Lifecycle end,
 * Silence, or a changed sound signature clears/replaces the registration.
 */
class AudioPlaybackRegistry {
  constructor() {
    this.signatures = new Map()
    this.completed = new Set()
  }

  current(key) {
    return this.signatures.get(key)
  }

  begin(key, signature) {
    if (this.signatures.get(key) === signature) return false
    this.signatures.set(key, signature)
    this.completed.delete(key)
    return true
  }

  isCurrent(key, signature) {
    return this.signatures.get(key) === signature
  }

  complete(key, signature) {
    if (!this.isCurrent(key, signature)) return false
    this.completed.add(key)
    return true
  }

  /**
   * Discard interrupted playback while retaining completed finite signatures.
   *
   * A fail-closed configuration suspension must cancel loops, players, and
   * pending repeats. Completed finite sounds are different: forgetting them
   * would turn configuration recovery into a new alarm occurrence and replay
   * an otherwise unchanged notification.
   */
  retainCompleted() {
    for (const key of this.signatures.keys()) {
      if (!this.completed.has(key)) this.signatures.delete(key)
    }
  }

  /** Return immutable diagnostics for active and completed signatures. */
  toJSON() {
    return [...this.signatures].map(([key, signature]) => ({
      key,
      signature,
      completed: this.completed.has(key)
    }))
  }

  end(key) {
    this.signatures.delete(key)
    this.completed.delete(key)
  }

  clear() {
    this.signatures.clear()
    this.completed.clear()
  }
}

module.exports = AudioPlaybackRegistry
