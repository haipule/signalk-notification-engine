'use strict'

/**
 * Coordinate the plugin lifecycle and fail-closed Node-RED configuration.
 * Domain services are injected callbacks; this class does not own Signal K
 * notifications, audio policy, history entries, or HTTP response formatting.
 */
class PluginRuntime {
  constructor({ getNodeRed, readConfiguration, subscribeToDeploy, applyConfiguration, writeRules, suspend, resume, debug = () => {}, error = () => {} }) {
    Object.assign(this, { getNodeRed, readConfiguration, subscribeToDeploy, applyConfiguration, writeRules, suspend, resume, debug, error })
    this.lifecycle = 0
    this.runtime = null
    this.options = {}
    this.checksum = null
    this.rules = []
    this.configurationError = null
    this.unsubscribe = null
    this.reloadPromise = null
  }

  /** Load the mandatory initial configuration and return its effective options. */
  async start(options = {}) {
    const token = ++this.lifecycle
    this.runtime = this.getNodeRed()
    this.options = { ...options }
    const next = await this.readConfiguration(this.runtime)
    this.adopt(next)
    return { token, flowOptions: this.initialFlowOptions(next) }
  }

  /** Subscribe only after dependent services are ready for deploy callbacks. */
  subscribe() {
    this.unsubscribe?.()
    this.unsubscribe = this.subscribeToDeploy(this.runtime, async () => this.refresh({ force: true }))
  }

  /** Re-read Node-RED, latching invalid configuration until a deploy event. */
  async refresh({ force = false } = {}) {
    if (this.configurationError && !force) return
    if (!this.runtime || this.reloadPromise) return this.reloadPromise
    this.reloadPromise = (async () => {
      try {
        const next = await this.readConfiguration(this.runtime)
        if (next.checksum === this.checksum && !this.configurationError) return
        const recovering = Boolean(this.configurationError)
        this.adopt(next)
        this.applyConfiguration(this.flowOptions(next))
        this.configurationError = null
        if (recovering) await this.resume()
        this.debug('Notification Engine configuration updated from Node-RED')
      } catch (failure) {
        this.configurationError = { message: failure.message, failedAt: new Date().toISOString() }
        this.suspend()
        this.error(`Unable to refresh Node-RED notification rules: ${failure.message}`)
      } finally {
        this.reloadPromise = null
      }
    })()
    return this.reloadPromise
  }

  /** End callbacks and invalidate asynchronous startup work. */
  stop() {
    this.lifecycle += 1
    this.unsubscribe?.()
    this.unsubscribe = null
    this.checksum = null
    this.configurationError = null
    this.runtime = null
  }

  isCurrent(token) { return token === this.lifecycle }
  status() { return this.configurationError ? { state: 'error', ...this.configurationError } : { state: 'ready' } }
  eventsAvailable() { return Boolean(this.unsubscribe) }

  adopt(next) {
    this.checksum = next.checksum
    this.rules = next.rules
    this.configurationError = null
    this.writeRules(this.rules, this.checksum)
  }

  flowOptions(next) {
    return {
      ...this.options,
      ...next.config.notificationEngine,
      activeRules: next.rules,
      stateOrder: next.config.notificationEngine.stateOrder,
      visibleStates: next.config.notificationEngine.visibleStates
    }
  }

  initialFlowOptions(next) {
    return this.flowOptions(next)
  }
}

module.exports = PluginRuntime
