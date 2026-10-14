'use strict'

const crypto = require('node:crypto')
const CONFIG_NODE_NAME = 'Notification Engine config'
const SUPPORTED_SCHEMA_VERSION = 1
const OBSOLETE_ENGINE_FIELDS = [
  'classificationRules',
  'historyStates',
  'stateOrder',
  'visibleStates',
  'testNotif',
  'shortcutInfo',
  'shortcutHistory'
]

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
  const sourceEngine = config.notificationEngine
  if (!sourceEngine || typeof sourceEngine !== 'object' || Array.isArray(sourceEngine)) throw new Error('Missing notificationEngine configuration')
  const engine = { ...sourceEngine }
  // These known copies have no authority at the Rule Builder boundary. Keep
  // validation tolerant until the legacy node is removed, but exclude them
  // from the effective configuration and checksum.
  for (const field of OBSOLETE_ENGINE_FIELDS) delete engine[field]
  return normalizeConfig({ ...config, notificationEngine: engine })
}

function extractConfig(flow) {
  if (!Array.isArray(flow)) throw new Error('Node-RED flow must be an array')
  const nodes = flow.filter(node => node && node.type === 'inject' && node.name === CONFIG_NODE_NAME && node.payloadType === 'json')
  if (nodes.length > 1) throw new Error(`Expected at most one legacy '${CONFIG_NODE_NAME}' node`)
  if (nodes.length === 0) return validateConfig({ schemaVersion: SUPPORTED_SCHEMA_VERSION, notificationEngine: {} })
  return validateConfig(typeof nodes[0].payload === 'string' ? JSON.parse(nodes[0].payload) : nodes[0].payload)
}

module.exports = { CONFIG_NODE_NAME, OBSOLETE_ENGINE_FIELDS, checksumConfig, extractConfig, normalizeConfig, validateConfig }
