'use strict'

const crypto = require('node:crypto')

const CONFIG_NODE_NAME = 'Notification Engine config'
const SUPPORTED_SCHEMA_VERSION = 1
const ALLOWED_STATES = new Set(['emergency', 'alarm', 'warn', 'normal'])

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]))
  }
  return value
}

function normalizeConfig(config) {
  return stableValue(config)
}

function checksumConfig(config) {
  const normalized = normalizeConfig(config)
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

function validateConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Node-RED configuration must be an object')
  if (config.schemaVersion !== SUPPORTED_SCHEMA_VERSION) throw new Error(`Unsupported Node-RED configuration schema: ${config.schemaVersion}`)
  const engine = config.notificationEngine
  if (!engine || typeof engine !== 'object' || Array.isArray(engine)) throw new Error('Missing notificationEngine configuration')
  for (const field of ['stateOrder', 'visibleStates']) {
    if (!Array.isArray(engine[field]) || engine[field].length === 0 || engine[field].some(state => typeof state !== 'string' || !ALLOWED_STATES.has(state))) {
      throw new Error(`Invalid notificationEngine.${field}`)
    }
  }
  return normalizeConfig(config)
}

function extractConfig(flow) {
  if (!Array.isArray(flow)) throw new Error('Node-RED flow must be an array')
  const nodes = flow.filter(node => node && node.type === 'inject' && node.name === CONFIG_NODE_NAME && node.payloadType === 'json')
  if (nodes.length !== 1) throw new Error(`Expected exactly one '${CONFIG_NODE_NAME}' node`)
  return validateConfig(typeof nodes[0].payload === 'string' ? JSON.parse(nodes[0].payload) : nodes[0].payload)
}

module.exports = { CONFIG_NODE_NAME, checksumConfig, extractConfig, normalizeConfig, validateConfig }
