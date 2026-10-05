'use strict'

const { NOTIFICATION_STATES, normalizeNotificationState } = require('./notification-states')
const { normalizeSoundConfig, resolveSoundCount, resolveSoundPauseSeconds } = require('./sound-config')

const ACTIVATION_NODE_NAME = 'Activate'

function extractActiveRules(flow) {
  if (!Array.isArray(flow)) throw new Error('Node-RED flow must be an array')
  const nodes = new Map(flow.filter(node => node && node.id).map(node => [node.id, node]))
  const canReachActivate = new Map()
  const reachesActivate = id => {
    if (canReachActivate.has(id)) return canReachActivate.get(id)
    const node = nodes.get(id)
    if (!node) return false
    if (node.name === ACTIVATION_NODE_NAME) {
      canReachActivate.set(id, true)
      return true
    }
    // Mark cycles while walking so malformed flows cannot recurse forever.
    canReachActivate.set(id, false)
    const result = (node.wires || []).some(output => (output || []).some(reachesActivate))
    canReachActivate.set(id, result)
    return result
  }
  const rules = []
  const notifications = flow.filter(node => getPayload(node)?.state)
  for (const source of notifications) {
    const candidates = []
    const walk = (id, rule, visited) => {
      if (visited.has(id)) return
      visited.add(id)
      const node = nodes.get(id)
      if (!node) return
      if (!reachesActivate(id)) return
      if (node.id !== source.id && getPayload(node)?.state) return
      if (node.name === ACTIVATION_NODE_NAME) {
        candidates.push(rule)
        return
      }
      const nextRule = structuredClone(rule)
      collectNode(node, nextRule)
      for (const output of node.wires || []) {
        for (const target of output || []) walk(target, nextRule, new Set(visited))
      }
    }
    walk(source.id, { actions: {} }, new Set())
    for (const result of mergeCandidates(candidates)) {
      const configuredState = getPayload(source).state
      const state = normalizeNotificationState(configuredState)
      if (!state) throw new Error(`Invalid notification state '${configuredState}'; allowed states: ${NOTIFICATION_STATES.join(', ')}`)
      result.id = `${getPayload(source).ruleId || state}-${rules.length + 1}`
      result.match = { state }
      if (result.path) {
        result.match.path = result.path
        delete result.path
      }
      if (result.conditions) result.match.conditions = result.conditions
      delete result.conditions
      delete result._pathSoundFields
      rules.push(result)
    }
  }
  return rules
}

/**
 * Merge only branches that have the same match scope. A path or condition
 * branch is therefore never allowed to leak its actions into a state-only
 * policy; branches with the same scope are the explicit message-flow pieces
 * of one policy.
 */
function mergeCandidates(candidates) {
  const merged = new Map()
  for (const candidate of candidates) {
    const key = JSON.stringify({ path: candidate.path || '', conditions: candidate.conditions || [] })
    const current = merged.get(key)
    if (!current) {
      merged.set(key, candidate)
      continue
    }
    current.actions = { ...current.actions, ...candidate.actions }
    if (candidate.conditions) current.conditions = candidate.conditions
    if (candidate.path) current.path = candidate.path
  }
  return [...merged.values()]
}

function validateRules(rules) {
  if (!Array.isArray(rules) || rules.length === 0) throw new Error('No active notification rule ends at Activate')
  const ids = new Set()
  for (const rule of rules) {
    if (!rule.id || ids.has(rule.id)) throw new Error('Active notification rules must have unique ids')
    ids.add(rule.id)
    if (!rule.match?.state) throw new Error(`Rule ${rule.id} has no notification state`)
    if (rule.match.path && typeof rule.match.path !== 'string') throw new Error(`Rule ${rule.id} has an invalid path`)
    if (rule.match.conditions !== undefined) {
      if (!Array.isArray(rule.match.conditions) || rule.match.conditions.length === 0) throw new Error(`Rule ${rule.id} has invalid conditions`)
      for (const condition of rule.match.conditions) {
        if (!condition || typeof condition.path !== 'string' || !condition.path || !['eq', 'neq', '>', '>=', '<', '<='].includes(condition.operator) || !Object.prototype.hasOwnProperty.call(condition, 'value')) {
          throw new Error(`Rule ${rule.id} has an invalid condition`)
        }
      }
    }
    if (rule.actions.sound?.active !== undefined && typeof rule.actions.sound.active !== 'boolean') throw new Error(`Rule ${rule.id} has an invalid sound active flag`)
    const hasNestedSoundFile = Object.prototype.hasOwnProperty.call(rule.actions.sound || {}, 'file')
    const hasLegacySoundFile = Object.prototype.hasOwnProperty.call(rule.actions, 'soundFile')
    const configuredSoundFile = hasNestedSoundFile ? rule.actions.sound.file : rule.actions.soundFile
    // An explicit blank path is almost certainly an authoring mistake. Reject
    // it while still allowing sound.active:false as the deliberate, visible
    // way to suppress inherited audio without changing Signal K state.
    if ((hasNestedSoundFile || hasLegacySoundFile) && rule.actions.sound?.active !== false &&
        (typeof configuredSoundFile !== 'string' || configuredSoundFile.trim() === '')) {
      throw new Error(`Rule ${rule.id} has an empty active sound file; use sound.active false to disable audio`)
    }
    try {
      if (rule.actions.sound !== undefined || rule.actions.soundMode !== undefined || rule.actions.repeatCount !== undefined) {
        resolveSoundCount(rule.actions.sound || {}, rule.actions)
        resolveSoundPauseSeconds(rule.actions.sound || {})
      }
    } catch (error) {
      throw new Error(`Rule ${rule.id}: ${error.message}`)
    }
  }
  return rules
}

/**
 * Convert extracted Node-RED actions into presentation policies.
 *
 * Sound activation is an explicit branch property. Preserving `false` here is
 * essential: replacing it with a truthy default would silently re-enable an
 * inherited state sound that the graphical rule deliberately disabled.
 *
 * @param {Array<object>} rules Extracted, validated Node-RED rules.
 * @returns {Array<object>} Policies ordered from most to least specific.
 */
function normalizeFlowRules(rules) {
  const ordered = Array.isArray(rules) ? [...rules].sort((left, right) => ruleSpecificity(right) - ruleSpecificity(left)) : []
  return ordered.map(rule => {
    const soundAction = rule.actions?.sound
    const hasSound = soundAction !== undefined || rule.actions?.soundFile !== undefined
    const ignored = rule.actions?.ignore === true
    const hasExplicitVisibility = typeof rule.actions?.visibleInTable === 'boolean'
    const history = typeof rule.actions?.history === 'boolean'
      ? rule.actions.history
      : rule.actions?.visibleInTable === true ? true : undefined
    const file = soundAction?.file || rule.actions?.soundFile
    const normalizedSound = hasSound && !ignored ? normalizeSoundConfig(soundAction || {}, rule.actions) : null
    return {
      name: rule.id,
      state: rule.match?.state,
      match: { state: rule.match?.state, path: rule.match?.path, ...(rule.match?.conditions ? { conditions: rule.match.conditions } : {}) },
      ...(ignored || hasSound ? { audio: ignored ? 'off' : 'on' } : {}),
      ...(hasSound && !ignored ? {
        sound: {
          active: typeof soundAction?.active === 'boolean' ? soundAction.active : true,
          ...(file ? { file } : {}),
          count: normalizedSound.count,
          ...(normalizedSound.pauseSeconds !== undefined ? { pauseSeconds: normalizedSound.pauseSeconds } : {})
        }
      } : {}),
      ...(ignored || hasExplicitVisibility ? { visible: !ignored && rule.actions?.visibleInTable !== false } : {}),
      ...(typeof history === 'boolean' ? { history } : {})
    }
  })
}

function ruleSpecificity(rule) {
  const match = rule?.match || {}
  const conditionCount = Array.isArray(match.conditions) ? match.conditions.length : 0
  const base = match.path && !match.path.includes('*')
    ? 400
    : match.path
      ? 300
      : 100
  return base + conditionCount
}

function rulesMarkdown(rules, revision) {
  const lines = ['# Deployed notification rules', '', `Revision: ${revision}`, '']
  for (const rule of rules) {
    lines.push(`## ${rule.id}`, '', 'Match:', '', `- State: ${rule.match.state}`)
    if (rule.match.path) lines.push(`- Path: ${rule.match.path}`)
    for (const condition of rule.match.conditions || []) lines.push(`- Condition: ${condition.path} ${condition.operator} ${JSON.stringify(condition.value)}`)
    lines.push('', 'Actions:', '')
    for (const [key, value] of Object.entries(rule.actions)) lines.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    lines.push('')
  }
  return `${lines.join("\n")}\n`
}

function getState(node) {
  return getPayload(node)?.state
}

/**
 * Recover the declarative payload shape without depending on the Node-RED
 * node type. Node types are an authoring detail; `msg.payload` is the DSL.
 */
function getPayload(node) {
  if (!node) return null
  if (node.payloadType === 'json') {
    try {
      const payload = typeof node.payload === 'string' ? JSON.parse(node.payload) : node.payload
      if (payload && typeof payload === 'object') return payload
    } catch {
      return null
    }
  }
  if (node.type === 'function') {
    const code = String(node.func || '')
    const state = code.match(/(?:msg\.payload\.state|state)\s*[:=]\s*["']([^"']+)["']/)?.[1]
    if (state) return { state }
  }
  const stateRule = (node.rules || []).find(item => item.t === 'set' && item.pt === 'msg' && item.p === 'payload.state')
  if (stateRule) return { state: stateRule.to }
  return null
}

function collectNode(node, rule) {
  if (node.type === 'function') {
    collectFunctionAssignments(node.func, rule)
    return
  }
  for (const item of node.rules || []) {
    if (item.t !== 'set' || item.pt !== 'msg') continue
    const value = item.tot === 'bool' ? item.to === true || item.to === 'true' : item.tot === 'num' ? Number(item.to) : item.to
    if (item.p === 'payload.match.path') rule.path = value
    else if (item.p === 'payload.match.conditions') collectConditions(rule, value)
    else if (item.p.startsWith('payload.')) assignPayloadAction(rule, item.p.slice('payload.'.length), value)
  }
}


function collectFunctionAssignments(source, rule) {
  const code = String(source || '')
  const stringValue = name => {
    const match = code.match(new RegExp(`msg\\.payload\\.${name}\\s*=\\s*([\\"'])(.*?)\\1`))
    return match?.[2]
  }
  const soundFile = stringValue('soundFile')
  const soundMode = stringValue('soundMode')
  const repeatCountMatch = code.match(/msg\.payload\.repeatCount\s*=\s*(\d+)/)
  const literalValue = name => {
    const escaped = name.replaceAll('.', '\\.')
    const match = code.match(new RegExp(`msg\\.payload\\.${escaped}\\s*=\\s*(?:(['\"])(.*?)\\1|(-?\\d+(?:\\.\\d+)?))`))
    if (!match) return undefined
    return match[2] !== undefined ? match[2] : Number(match[3])
  }
  const soundCount = literalValue('sound.count')
  const soundPauseSeconds = literalValue('sound.pauseSeconds')
  if (soundFile !== undefined) assignPayloadAction(rule, 'soundFile', soundFile)
  if (soundMode !== undefined) assignPayloadAction(rule, 'soundMode', soundMode)
  if (repeatCountMatch) assignPayloadAction(rule, 'repeatCount', Number(repeatCountMatch[1]))
  if (soundCount !== undefined) assignPayloadAction(rule, 'sound.count', soundCount)
  if (soundPauseSeconds !== undefined) assignPayloadAction(rule, 'sound.pauseSeconds', soundPauseSeconds)
}


function assignPayloadAction(rule, dottedPath, value) {
  const isSoundAction = dottedPath === 'soundFile' || dottedPath === 'soundMode' || dottedPath.startsWith('sound.') || dottedPath === 'repeatCount'
  if (isSoundAction && rule.path) {
    rule._pathSoundFields ||= new Set()
    if (rule._pathSoundFields.has(dottedPath)) return
    rule._pathSoundFields.add(dottedPath)
  }
  setPath(rule.actions, dottedPath, value)
}

function collectConditions(rule, value) {
  const values = Array.isArray(value) ? value : [value]
  for (const candidate of values) {
    const condition = typeof candidate === 'string' ? parseConditionExpression(candidate) : normalizeCondition(candidate)
    if (condition) {
      rule.conditions ||= []
      rule.conditions.push(condition)
    }
  }
}

function parseConditionExpression(expression) {
  let text = String(expression || '').trim()
  if ((text.startsWith(String.fromCharCode(34)) && text.endsWith(String.fromCharCode(34))) || (text.startsWith(String.fromCharCode(39)) && text.endsWith(String.fromCharCode(39)))) text = text.slice(1, -1).replaceAll(String.fromCharCode(92,34), String.fromCharCode(34))
  const match = text.match(/^([A-Za-z0-9_$.-]+)\s*(===|!==|==|!=|>=|<=|>|<)\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|(-?\d+(?:\.\d+)?)|(true|false|null))$/)
  if (!match) return null
  const [, path, operator, doubleQuoted, singleQuoted, numberValue, literal] = match
  let value
  if (doubleQuoted !== undefined) value = JSON.parse(`"${doubleQuoted}"`)
  else if (singleQuoted !== undefined) value = singleQuoted.replace(/\\(['\\])/g, '$1')
  else if (numberValue !== undefined) value = Number(numberValue)
  else if (literal === 'true') value = true
  else if (literal === 'false') value = false
  else value = null
  return { path, operator: operator === '===' ? 'eq' : operator === '!==' ? 'neq' : operator, value }
}

function normalizeCondition(condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return null
  const path = typeof condition.path === 'string' ? condition.path.trim() : ''
  const operator = condition.operator || condition.op || 'eq'
  if (!path || !['eq', 'neq', '>', '>=', '<', '<='].includes(operator)) return null
  if (!Object.prototype.hasOwnProperty.call(condition, 'value')) return null
  return { path, operator, value: condition.value }
}

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split('.')
  let target = object
  for (const part of parts.slice(0, -1)) target = target[part] ||= {}
  target[parts[parts.length - 1]] = value
}

module.exports = { ACTIVATION_NODE_NAME, extractActiveRules, normalizeFlowRules, rulesMarkdown, validateRules }
