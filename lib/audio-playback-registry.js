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
  constructor(onChange = () => {}) {
    this.signatures = new Map()
    this.completed = new Set()
    this.onChange = onChange
  }

  current(key) {
    return this.signatures.get(key)
  }

  begin(key, signature) {
    if (this.signatures.get(key) === signature) return false
    this.signatures.set(key, signature)
    this.completed.delete(key)
    this.onChange()
    return true
  }

  isCurrent(key, signature) {
    return this.signatures.get(key) === signature
  }

  complete(key, signature) {
    if (!this.isCurrent(key, signature)) return false
    this.completed.add(key)
    this.onChange()
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
    let changed = false
    for (const key of this.signatures.keys()) {
      if (!this.completed.has(key)) {
        this.signatures.delete(key)
        changed = true
      }
    }
    if (changed) this.onChange()
  }

  /** Restore only completed finite signatures from the local restart cache. */
  restoreCompleted(entries) {
    this.signatures.clear()
    this.completed.clear()
    for (const entry of Array.isArray(entries) ? entries : []) {
      if (!entry || entry.completed !== true || typeof entry.key !== 'string' || typeof entry.signature !== 'string') continue
      this.signatures.set(entry.key, entry.signature)
      this.completed.add(entry.key)
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
    const changed = this.signatures.has(key) || this.completed.has(key)
    this.signatures.delete(key)
    this.completed.delete(key)
    if (changed) this.onChange()
  }

  clear() {
    const changed = this.signatures.size > 0 || this.completed.size > 0
    this.signatures.clear()
    this.completed.clear()
    if (changed) this.onChange()
  }
}

module.exports = AudioPlaybackRegistry
