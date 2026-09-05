'use strict'

const METHODS = {
  silence: 'silence',
  acknowledge: 'acknowledge',
  clear: 'clear'
}

/**
 * Adapter for the Signal K Notification API's permitted lifecycle operations.
 *
 * This module deliberately refuses to guess when a capability is absent. A
 * caller must refresh its view from Signal K rather than treating a local UI
 * decision as an alarm-state change.
 */
class NotificationActions {
  /** @param {{notifications?: object}} app Signal K plugin API. */
  constructor(app) {
    this.notifications = app.notifications
  }

  /** Return whether a lifecycle action is currently safe to offer. */
  allowed(record, action) {
    if (!record || !METHODS[action] || !record.status) return false
    if (action === 'silence') {
      return record.state !== 'emergency' && record.status.canSilence === true && record.status.silenced !== true
    }
    if (action === 'acknowledge') return record.status.canAcknowledge === true && record.status.acknowledged !== true
    return !['normal', 'nominal'].includes(record.state) && record.status.canClear === true
  }

  /**
   * Invoke one Signal K operation after applying manager-side safeguards.
   * @throws {Error} when the operation is unavailable or rejected by Signal K.
   */
  async execute(record, action) {
    if (!this.allowed(record, action)) {
      const pastTense = { silence: 'silenced', acknowledge: 'acknowledged', clear: 'cleared' }[action]
      throw new Error(`Notification cannot be ${pastTense} in its current state`)
    }
    const method = METHODS[action]
    if (typeof this.notifications?.[method] !== 'function') {
      throw new Error('Signal K Notification API is unavailable')
    }
    await this.notifications[method](record.id)
  }

  /** Execute an action for every currently permitted record. */
  async executeAll(records, action) {
    const candidates = records.filter(record => this.allowed(record, action))
    await Promise.all(candidates.map(record => this.execute(record, action)))
    return candidates
  }
}

module.exports = NotificationActions
