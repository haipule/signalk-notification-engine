'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')
const { extractConfig, checksumConfig } = require('./node-red-config')
const { extractActiveRules, validateRules } = require('./flow-rules')

function getNodeRed() {
  try {
    return require('node-red')
  } catch (error) {
    throw new Error(`Internal Node-RED runtime is unavailable: ${error.message}`)
  }
}

async function readConfiguration(red) {
  if (!red?.runtime?.flows?.getFlows) throw new Error('Internal Node-RED flow API is unavailable')
  // The embedded runtime exposes the HTTP handler with a request argument;
  // only use a parameterless flow provider when the runtime explicitly has one.
  if (red.runtime.flows.getFlows.length === 0) {
    const runtimeFlows = await red.runtime.flows.getFlows()
    const runtimeFlow = Array.isArray(runtimeFlows) ? runtimeFlows : runtimeFlows?.flows
    if (Array.isArray(runtimeFlow)) {
      const config = extractConfig(runtimeFlow)
      const rules = validateRules(extractActiveRules(runtimeFlow))
      return { config, rules, checksum: checksumConfig({ config, rules }) }
    }
  }
  const configuredFile = red.settings?.flowFile
  const configuredPath = configuredFile && path.isAbsolute(configuredFile)
    ? configuredFile
    : path.join(red.settings?.userDir || '', configuredFile || '')
  const candidates = [configuredPath, '/home/pi/.signalk/red/flows_openplotter.json'].filter(Boolean)
  let stored
  let lastError
  for (const file of candidates) {
    try {
      stored = JSON.parse(await fs.readFile(file, 'utf8'))
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!stored) throw new Error(`Unable to read internal Node-RED flow: ${lastError.message}`)
  const flow = Array.isArray(stored) ? stored : Array.isArray(stored?.flows) ? stored.flows : stored?.flows?.flows
  const config = extractConfig(flow)
  const rules = validateRules(extractActiveRules(flow))
  return { config, rules, checksum: checksumConfig({ config, rules }) }
}

function subscribeToDeploy(red, onDeploy) {
  if (!red?.events?.on || !red?.events?.removeListener) throw new Error('Internal Node-RED event API is unavailable')
  const handler = event => {
    if (event?.id === 'runtime-deploy') void onDeploy(event)
  }
  red.events.on('runtime-event', handler)
  return () => red.events.removeListener('runtime-event', handler)
}

module.exports = { getNodeRed, readConfiguration, subscribeToDeploy }
