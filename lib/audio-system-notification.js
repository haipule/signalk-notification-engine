'use strict'

const AUDIO_SYSTEM_PATH = 'notifications.system.notificationEngine.audio'
const AUDIO_SYSTEM_ID = 'notification-engine-audio-system'

/**
 * Latch technical playback failures into one visual-only Signal K notification.
 *
 * A failure is cleared only by a successful player exit for the same local
 * notification occurrence. Passive health, another sound, and lifecycle end
 * are deliberately insufficient evidence of recovery.
 */
class AudioSystemNotification {
  constructor({ publish = () => {}, onChange = () => {}, now = () => new Date().toISOString() } = {}) {
    this.publish = publish
    this.onChange = onChange
    this.now = now
    this.failures = new Map()
    this.lastPublishedState = null
  }

  /** Restore unresolved occurrence-specific failures without resolving them. */
  restore(snapshot) {
    this.failures.clear()
    for (const failure of snapshot?.failures || []) {
      if (!failure?.occurrenceId || failure.path === AUDIO_SYSTEM_PATH) continue
      this.failures.set(failure.occurrenceId, structuredClone(failure))
    }
    this.lastPublishedState = null
  }

  /** Publish the restored latched state after Signal K startup is ready. */
  synchronize() {
    if (this.failures.size > 0) this.publishState('alarm')
  }

  /** Latch one genuine player failure for its originating lifecycle. */
  recordFailure(notification, result = {}) {
    if (!notification?.occurrenceId || notification.path === AUDIO_SYSTEM_PATH) return false
    this.failures.set(notification.occurrenceId, {
      occurrenceId: notification.occurrenceId,
      path: notification.path || '',
      source: structuredClone(notification.source || null),
      state: notification.state || '',
      message: notification.message || '',
      failedAt: this.now(),
      error: result.error?.message || result.stderr || result.error || `Player exited with code ${result.code ?? 'unknown'}`
    })
    this.publishState('alarm')
    this.changed()
    return true
  }

  /** Resolve only the exact occurrence whose player execution succeeded. */
  recordSuccess(notification) {
    if (!notification?.occurrenceId || !this.failures.has(notification.occurrenceId)) return false
    this.failures.delete(notification.occurrenceId)
    if (this.failures.size === 0) this.publishState('normal')
    this.changed()
    return true
  }

  snapshot() {
    return { version: 1, failures: [...this.failures.values()].map(value => structuredClone(value)) }
  }

  toJSON() {
    return {
      path: AUDIO_SYSTEM_PATH,
      state: this.failures.size > 0 ? 'alarm' : 'normal',
      unresolvedCount: this.failures.size,
      failures: [...this.failures.values()].map(value => structuredClone(value))
    }
  }

  changed() {
    this.onChange(this.snapshot())
  }

  publishState(state) {
    if (state === this.lastPublishedState) return
    this.lastPublishedState = state
    this.publish({
      id: AUDIO_SYSTEM_ID,
      path: AUDIO_SYSTEM_PATH,
      state,
      message: state === 'alarm'
        ? 'Notification Engine audio playback failed. See Diagnostics.'
        : 'Notification Engine audio playback recovered.',
      method: ['visual'],
      temporarySilenceSupport: 'No',
      acknowledgeSupport: 'No',
      data: {
        notificationEngineAudioSystem: true,
        unresolvedCount: this.failures.size
      }
    })
  }
}

module.exports = { AudioSystemNotification, AUDIO_SYSTEM_PATH, AUDIO_SYSTEM_ID }
