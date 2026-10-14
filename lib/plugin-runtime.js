'use strict'

// These fields are accepted only while the legacy config node still exists.
// Every host, maintenance, persistence, browser and authorization setting is
// owned by Signal K Plugin Config and must never be overridden by flow JSON.
const LEGACY_NODE_RED_TREATMENT_FIELDS = [
  'policies',
  'stateColors',
  'colorPaletteFile',
  'visualRules',
  'soundsByState',
  'soundPaletteFile',
  'historyRules'
]

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
    const next = await this.readConfiguration(this.runtime, this.selectedTabId())
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
        const next = await this.readConfiguration(this.runtime, this.selectedTabId())
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

  selectedTabId() {
    return typeof this.options.ruleBuilderFlow?.id === 'string' ? this.options.ruleBuilderFlow.id.trim() : ''
  }

  adopt(next) {
    this.checksum = next.checksum
    this.rules = next.rules
    this.configurationError = null
    this.writeRules(this.rules, this.checksum)
  }

  flowOptions(next) {
    const flowConfiguration = Object.fromEntries(
      LEGACY_NODE_RED_TREATMENT_FIELDS
        .filter(field => Object.prototype.hasOwnProperty.call(next.config.notificationEngine, field))
        .map(field => [field, next.config.notificationEngine[field]])
    )
    return {
      ...this.options,
      ...flowConfiguration,
      activeRules: next.rules
    }
  }

  initialFlowOptions(next) {
    return this.flowOptions(next)
  }
}

module.exports = PluginRuntime
module.exports.LEGACY_NODE_RED_TREATMENT_FIELDS = LEGACY_NODE_RED_TREATMENT_FIELDS
