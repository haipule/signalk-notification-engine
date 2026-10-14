'use strict'

const { normalizeSoundConfig } = require('./sound-config')

const PRIORITIES = new Set(['low', 'normal', 'high', 'critical'])

/**
 * Resolve local presentation policy without altering Signal K alarm state.
 *
 * Matching policies are composed property by property. General state rules
 * provide defaults and more-specific path/condition rules override only the
 * properties they explicitly define.
 */
class PolicyResolver {
  constructor(policies = [], soundsByState = {}, readValue = () => undefined) {
    this.policies = policies.map(validatePolicy).map((policy, index) => ({ policy, index }))
      .sort((left, right) => policySpecificity(right.policy) - policySpecificity(left.policy) || left.index - right.index)
      .map(entry => entry.policy)
    this.soundsByState = Object.fromEntries(Object.entries(soundsByState).map(([state, sound]) => [state, normalizeSoundConfig(sound)]))
    this.readValue = readValue
  }

  resolve(notification) {
    const matching = this.policies.filter(candidate =>
      matchesBase(candidate.match, notification) &&
      conditionsMatch(candidate.match.conditions, this.readValue)
    )
    // Policies are stored most-specific first. Compose from the general rule
    // towards the most-specific rule so a path branch overrides only the
    // properties it actually defines (for example sound) and still inherits
    // visibility/history from the state rule.
    const policy = matching.slice().reverse().reduce((combined, candidate) => ({
      ...combined,
      ...(candidate.priority !== undefined ? { priority: candidate.priority } : {}),
      ...(candidate.audio !== undefined ? { audio: candidate.audio } : {}),
      ...(candidate.sound !== undefined && candidate.sound !== null ? { sound: candidate.sound } : {}),
      ...(candidate.visible !== undefined ? { visible: candidate.visible } : {}),
      ...(candidate.history !== undefined ? { history: candidate.history } : {}),
      ...(candidate.display !== undefined ? { display: candidate.display } : {}),
      ...(candidate.color !== undefined ? { color: candidate.color } : {}),
      ...(candidate.hex !== undefined ? { hex: candidate.hex } : {}),
      ...(candidate.flash !== undefined ? { flash: candidate.flash } : {}),
      name: candidate.name
    }), null)
    const stateSound = this.soundsByState[notification.state] || null
    const policySound = policy?.sound || null
    const soundConfig = policy?.audio === 'off'
      ? null
      : policySound
        ? { ...(stateSound || {}), ...policySound }
        : stateSound
    const sound = soundConfig?.file || null
    return {
      priority: policy?.priority || priorityFromState(notification.state),
      audio: policy?.audio || 'inherit',
      sound,
      soundConfig,
      visible: policy?.visible !== false,
      ...(typeof policy?.history === 'boolean' ? { history: policy.history } : {}),
      ...(policy?.display !== undefined ? { display: policy.display } : {}),
      ...(policy?.color !== undefined ? { color: policy.color } : {}),
      ...(policy?.hex !== undefined ? { hex: policy.hex } : {}),
      ...(policy?.flash !== undefined ? { flash: policy.flash } : {}),
      matchedPolicy: policy?.name || null
    }
  }
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new Error('Each policy must be an object')
  const match = policy.match || {}
  const sound = normalizeSoundConfig(policy.sound)
  if (!match.pathPrefix && !match.path && !match.source && !match.state && !policy.state) throw new Error('Policy requires a state, path prefix, or source')
  if (match.pathPrefix && typeof match.pathPrefix !== 'string') throw new Error('Policy path prefix must be a string')
  if (match.path && typeof match.path !== 'string') throw new Error('Policy path must be a string')
  if (match.source && typeof match.source !== 'string') throw new Error('Policy source must be a string')
  if (policy.priority && !PRIORITIES.has(policy.priority)) throw new Error('Policy priority is invalid')
  if (policy.audio && !['inherit', 'on', 'off'].includes(policy.audio)) throw new Error('Policy audio value is invalid')
  if (sound !== undefined && sound !== null && typeof sound !== 'object') throw new Error('Policy sound must be an object')
  if (sound?.active !== undefined && typeof sound.active !== 'boolean') throw new Error('Policy sound active flag must be a boolean')
  if (sound?.file !== undefined && typeof sound.file !== 'string') throw new Error('Policy sound file must be a string')
  if (policy.display !== undefined && !['table', 'banner', 'overlay'].includes(policy.display)) throw new Error('Policy display value is invalid')
  if (policy.color !== undefined && typeof policy.color !== 'string') throw new Error('Policy color value is invalid')
  if (policy.hex !== undefined && (typeof policy.hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(policy.hex))) throw new Error('Policy hex color is invalid')
  if (policy.flash !== undefined && typeof policy.flash !== 'boolean') throw new Error('Policy flash value is invalid')
  return {
    name: String(policy.name || 'Unnamed policy'), match, priority: policy.priority,
    audio: policy.audio, sound: sound || null, visible: policy.visible,
    ...(typeof policy.history === 'boolean' ? { history: policy.history } : {}),
    ...(policy.display !== undefined ? { display: policy.display } : {}),
    ...(policy.color !== undefined ? { color: policy.color } : {}),
    ...(policy.hex !== undefined ? { hex: policy.hex } : {}),
    ...(policy.flash !== undefined ? { flash: policy.flash } : {})
  }
}

function matchesBase(match, notification) {
  if (match.state && match.state !== notification.state) return false
  if (match.path && match.path.includes('*')) {
    const pattern = match.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    if (!new RegExp(`^${pattern}$`).test(String(notification.path || ''))) return false
  }
  else if (match.path && match.path !== notification.path) return false
  if (match.pathPrefix && !String(notification.path || '').startsWith(match.pathPrefix)) return false
  if (match.source && match.source !== notification.source?.label) return false
  return Boolean(match.path || match.pathPrefix || match.source || match.state)
}

function conditionsMatch(conditions, readValue) {
  if (!conditions) return true
  if (!Array.isArray(conditions) || conditions.length === 0) return false
  return conditions.every(condition => {
    const actual = readValue(condition.path)
    if (actual === undefined) return false
    switch (condition.operator) {
      case 'eq': return actual === condition.value
      case 'neq': return actual !== condition.value
      case '>': return actual > condition.value
      case '>=': return actual >= condition.value
      case '<': return actual < condition.value
      case '<=': return actual <= condition.value
      default: return false
    }
  })
}

function priorityFromState(state) {
  if (state === 'emergency' || state === 'alarm') return 'critical'
  if (state === 'warn' || state === 'alert') return 'high'
  return 'normal'
}

function policySpecificity(policy) {
  const match = policy?.match || {}
  const conditions = Array.isArray(match.conditions) ? match.conditions.length : 0
  const base = match.path && !match.path.includes('*')
    ? 400
    : match.path
      ? 300
      : 100
  return base + conditions
}

module.exports = { PolicyResolver, validatePolicy }
