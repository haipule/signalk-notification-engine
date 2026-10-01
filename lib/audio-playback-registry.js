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
  }

  current(key) {
    return this.signatures.get(key)
  }

  begin(key, signature) {
    if (this.signatures.get(key) === signature) return false
    this.signatures.set(key, signature)
    return true
  }

  isCurrent(key, signature) {
    return this.signatures.get(key) === signature
  }

  complete(key, signature) {
    return this.isCurrent(key, signature)
  }

  end(key) {
    this.signatures.delete(key)
  }

  clear() {
    this.signatures.clear()
  }
}

module.exports = AudioPlaybackRegistry
