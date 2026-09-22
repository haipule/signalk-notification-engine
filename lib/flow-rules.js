'use strict'

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
  const notifications = flow.filter(node => getState(node))
  for (const source of notifications) {
    const visited = new Set()
    const rule = { actions: {} }
    let foundActivate = false
    const walk = id => {
      if (visited.has(id)) return
      visited.add(id)
      const node = nodes.get(id)
      if (!node) return
      if (!reachesActivate(id)) return
      if (node.id !== source.id && getState(node)) return
      if (node.name === ACTIVATION_NODE_NAME) {
        foundActivate = true
        return
      }
      collectNode(node, rule)
      for (const output of node.wires || []) {
        for (const target of output || []) walk(target)
      }
    }
    walk(source.id)
    if (!foundActivate) continue
    const state = getState(source)
    const result = structuredClone(rule)
    delete result._pathSoundFields
    result.id = `${state}-${rules.length + 1}`
    result.match = { state }
    if (result.path) {
      result.match.path = result.path
      delete result.path
    }
    if (result.conditions) result.match.conditions = result.conditions
    delete result.conditions
    if (state === 'alarm' || state === 'emergency') result.actions.history = true
    rules.push(result)
  }
  return rules
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
    if (rule.actions.sound?.mode === 'repeat' && (!Number.isInteger(rule.actions.sound.repeatCount) || rule.actions.sound.repeatCount < 1)) throw new Error(`Rule ${rule.id} has an invalid repeat count`)
  }
  return rules
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
  if (node.type === 'function') {
    const match = String(node.func || '').match(/state\s*:\s*['"]([^'"]+)['"]/) 
    return match?.[1]
  }
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
  if (soundFile !== undefined) assignPayloadAction(rule, 'soundFile', soundFile)
  if (soundMode !== undefined) assignPayloadAction(rule, 'soundMode', soundMode)
  if (repeatCountMatch) assignPayloadAction(rule, 'repeatCount', Number(repeatCountMatch[1]))
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

module.exports = { ACTIVATION_NODE_NAME, extractActiveRules, rulesMarkdown, validateRules }
