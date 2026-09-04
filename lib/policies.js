'use strict'

const PRIORITIES = new Set(['low', 'normal', 'high', 'critical'])

/**
 * Resolve local presentation policy without altering Signal K alarm state.
 *
 * Policies are evaluated in list order: the first matching rule wins. This is
 * intentionally small and explainable; a richer rule language must preserve
 * this deterministic behaviour when it is introduced later.
 */
class PolicyResolver {
  constructor(policies = [], soundsByState = {}) {
    this.policies = policies.map(validatePolicy)
    this.soundsByState = Object.fromEntries(Object.entries(soundsByState).map(([state, sound]) => [state, typeof sound === 'string' ? { active: true, file: sound, mode: 'once', repeatCount: 1 } : sound]))
  }

  resolve(notification) {
    const policy = this.policies.find(candidate => matches(candidate.match, notification))
    const stateSound = this.soundsByState[notification.state] || null
    const policySound = policy?.sound?.file ? policy.sound : null
    const sound = policy?.audio === 'off' ? null : policySound?.file || stateSound?.file || stateSound
    return {
      priority: policy?.priority || priorityFromState(notification.state),
      audio: policy?.audio || 'inherit',
      sound,
      soundConfig: sound ? (policySound || stateSound) : null,
      visible: policy?.visible !== false,
      matchedPolicy: policy?.name || null
    }
  }
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object') throw new Error('Each policy must be an object')
  const match = policy.match || {}
  const sound = typeof policy.sound === 'string' ? { active: true, file: policy.sound, mode: 'once', repeatCount: 1 } : policy.sound
  if (!match.pathPrefix && !match.path && !match.source && !policy.state) throw new Error('Policy requires a state, path prefix, or source')
  if (match.category && typeof match.category !== 'string') throw new Error('Policy category must be a string')
  if (match.pathPrefix && typeof match.pathPrefix !== 'string') throw new Error('Policy path prefix must be a string')
  if (match.path && typeof match.path !== 'string') throw new Error('Policy path must be a string')
  if (match.source && typeof match.source !== 'string') throw new Error('Policy source must be a string')
  if (policy.priority && !PRIORITIES.has(policy.priority)) throw new Error('Policy priority is invalid')
  if (policy.audio && !['inherit', 'on', 'off'].includes(policy.audio)) throw new Error('Policy audio value is invalid')
  if (sound !== undefined && sound !== null && typeof sound !== 'object') throw new Error('Policy sound must be an object')
  if (sound?.file !== undefined && typeof sound.file !== 'string') throw new Error('Policy sound file must be a string')
  if (sound?.mode !== undefined && !['once', 'repeat', 'loop'].includes(sound.mode)) throw new Error('Policy sound mode is invalid')
  if (sound?.repeatCount !== undefined && (!Number.isInteger(sound.repeatCount) || sound.repeatCount < 1)) throw new Error('Policy sound repeat count is invalid')
  return { name: String(policy.name || 'Unnamed policy'), match, priority: policy.priority, audio: policy.audio, sound: sound || null, visible: policy.visible }
}

function matches(match, notification) {
  if (match.state && match.state !== notification.state) return false
  if (match.category && match.category !== notification.category) return false
  if (match.path && match.path.includes('*')) {
    const pattern = match.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
    if (!new RegExp(`^${pattern}$`).test(String(notification.path || ''))) return false
  }
  else if (match.path && match.path !== notification.path) return false
  const pathMatches = match.pathPrefix && String(notification.path || '').startsWith(match.pathPrefix)
  const sourceMatches = match.source && match.source === notification.source?.label
  return Boolean(match.path || pathMatches || sourceMatches || (match.category && match.category === notification.category))
}

function priorityFromState(state) {
  if (state === 'emergency' || state === 'alarm') return 'critical'
  if (state === 'warn' || state === 'alert') return 'high'
  return 'normal'
}

module.exports = { PolicyResolver, validatePolicy }
