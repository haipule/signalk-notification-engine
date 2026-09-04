'use strict'

const ACTIVATION_NODE_NAME = 'Activate'

function extractActiveRules(flow) {
  if (!Array.isArray(flow)) throw new Error('Node-RED flow must be an array')
  const nodes = new Map(flow.filter(node => node && node.id).map(node => [node.id, node]))
  const rules = []
  const notifications = flow.filter(node => getState(node))
  for (const source of notifications) {
    const visited = new Set()
    const rule = { actions: {} }
    let reachesActivate = false
    const walk = id => {
      if (visited.has(id)) return
      visited.add(id)
      const node = nodes.get(id)
      if (!node) return
      if (node.id !== source.id && getState(node)) return
      if (node.name === ACTIVATION_NODE_NAME) {
        reachesActivate = true
        return
      }
      collectNode(node, rule)
      for (const output of node.wires || []) {
        for (const target of output || []) walk(target)
      }
    }
    walk(source.id)
    if (!reachesActivate) continue
    const state = getState(source)
    const result = structuredClone(rule)
    result.id = `${state}-${rules.length + 1}`
    result.match = { state }
    if (result.path) {
      result.match.path = result.path
      delete result.path
    }
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
    if (rule.actions.sound?.mode === 'repeat' && (!Number.isInteger(rule.actions.sound.repeatCount) || rule.actions.sound.repeatCount < 1)) throw new Error(`Rule ${rule.id} has an invalid repeat count`)
  }
  return rules
}

function rulesMarkdown(rules, revision) {
  const lines = ['# Deployed notification rules', '', `Revision: ${revision}`, '']
  for (const rule of rules) {
    lines.push(`## ${rule.id}`, '', 'Match:', '', `- State: ${rule.match.state}`)
    if (rule.match.path) lines.push(`- Path: ${rule.match.path}`)
    lines.push('', 'Actions:', '')
    for (const [key, value] of Object.entries(rule.actions)) lines.push(`- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

function getState(node) {
  if (node.type === 'function') {
    const match = String(node.func || '').match(/state\s*:\s*['"]([^'"]+)['"]/) 
    return match?.[1]
  }
}

function collectNode(node, rule) {
  if (node.type === 'function') return
  for (const item of node.rules || []) {
    if (item.t !== 'set' || item.pt !== 'msg') continue
    const value = item.tot === 'bool' ? item.to === true || item.to === 'true' : item.tot === 'num' ? Number(item.to) : item.to
    if (item.p === 'payload.match.path') rule.path = value
    else if (item.p.startsWith('payload.')) setPath(rule.actions, item.p.slice('payload.'.length), value)
  }
}

function setPath(object, dottedPath, value) {
  const parts = dottedPath.split('.')
  let target = object
  for (const part of parts.slice(0, -1)) target = target[part] ||= {}
  target[parts[parts.length - 1]] = value
}

module.exports = { ACTIVATION_NODE_NAME, extractActiveRules, rulesMarkdown, validateRules }
