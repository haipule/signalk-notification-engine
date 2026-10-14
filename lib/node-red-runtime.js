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

async function readConfiguration(red, selectedTabId) {
  const current = await readCurrentFlow(red)
  const recovered = await recoverOrBackupFlow(red, current.stored, current.flow, current.loadedPath, selectedTabId)
  const selected = selectRuleBuilderTab(recovered.flow, selectedTabId)
  const rules = validateRules(extractActiveRules(selected.nodes))
  return {
    config: recovered.config,
    rules,
    selectedTab: { id: selected.id, name: selected.name },
    checksum: checksumConfig({ selectedTabId: selected.id, config: recovered.config, rules })
  }
}

/**
 * Read the current embedded Node-RED flow without changing it.
 *
 * @param {object} red Internal Signal K Node-RED runtime.
 * @returns {Promise<{stored: object|Array<object>, flow: Array<object>, loadedPath: string|null}>}
 *   Stored document, normalized flow array, and backing file when one was used.
 */
async function readCurrentFlow(red) {
  if (!red?.runtime?.flows?.getFlows) throw new Error('Internal Node-RED flow API is unavailable')
  // The embedded runtime exposes the HTTP handler with a request argument;
  // only use a parameterless flow provider when the runtime explicitly has one.
  if (red.runtime.flows.getFlows.length === 0) {
    const runtimeFlows = await red.runtime.flows.getFlows()
    const runtimeFlow = Array.isArray(runtimeFlows) ? runtimeFlows : runtimeFlows?.flows
    if (Array.isArray(runtimeFlow)) {
      return { stored: runtimeFlows, flow: runtimeFlow, loadedPath: '/home/pi/.signalk/red/flows_openplotter.json' }
    }
  }
  const configuredFile = red.settings?.flowFile
  const configuredPath = configuredFile
    ? (path.isAbsolute(configuredFile)
        ? configuredFile
        : path.join(red.settings?.userDir || '', configuredFile))
    : null
  const candidates = [configuredPath, '/home/pi/.signalk/red/flows_openplotter.json'].filter(Boolean)
  let stored
  let loadedPath
  let lastError
  for (const file of candidates) {
    try {
      stored = JSON.parse(await fs.readFile(file, 'utf8'))
      loadedPath = file
      break
    } catch (error) {
      lastError = error
    }
  }
  if (!stored) throw new Error(`Unable to read internal Node-RED flow: ${lastError.message}`)
  const flow = Array.isArray(stored) ? stored : Array.isArray(stored?.flows) ? stored.flows : stored?.flows?.flows
  if (!Array.isArray(flow)) throw new Error('Internal Node-RED flow has an invalid shape')
  return { stored, flow, loadedPath }
}

/**
 * Return active Node-RED workspace tabs for the Plugin Config selector.
 * Disabled tabs remain invisible so they cannot be selected accidentally.
 *
 * @param {object} red Internal Signal K Node-RED runtime.
 * @returns {Promise<Array<{id: string, name: string}>>} Active tab identities.
 */
async function listActiveFlowTabs(red) {
  const { flow } = await readCurrentFlow(red)
  return flow
    .filter(node => node?.type === 'tab' && node.disabled !== true && typeof node.id === 'string' && node.id.trim())
    .map(node => ({ id: node.id.trim(), name: typeof node.label === 'string' && node.label.trim() ? node.label.trim() : 'Unnamed flow' }))
}

/**
 * Resolve exactly one configured active workspace tab and its owned nodes.
 * Labels are presentation only; the stable ID is the sole authority.
 *
 * @param {Array<object>} flow Complete embedded Node-RED flow.
 * @param {string} selectedTabId Persisted stable workspace ID.
 * @returns {{id: string, name: string, nodes: Array<object>}} Selected scope.
 */
function selectRuleBuilderTab(flow, selectedTabId) {
  const id = typeof selectedTabId === 'string' ? selectedTabId.trim() : ''
  if (!id) throw new Error('No Rule Builder flow is selected in Signal K Plugin Config')
  const tab = flow.find(node => node?.type === 'tab' && node.id === id)
  if (!tab) throw new Error(`Selected Rule Builder flow does not exist: ${id}`)
  if (tab.disabled === true) throw new Error(`Selected Rule Builder flow is disabled: ${id}`)
  return {
    id,
    name: typeof tab.label === 'string' && tab.label.trim() ? tab.label.trim() : 'Unnamed flow',
    nodes: flow.filter(node => node?.z === id)
  }
}

const BACKUP_DIR_NAME = 'notification-engine-backups'
const BACKUP_FILE_NAME = 'last-valid-flow.json'

function flowPath(red, fallback) {
  const configuredFile = red.settings?.flowFile
  if (configuredFile && path.isAbsolute(configuredFile)) return configuredFile
  if (configuredFile && red.settings?.userDir) return path.join(red.settings.userDir, configuredFile)
  // The fallback is only a real runtime location when Node-RED supplied
  // settings. This keeps unit/test doubles from attempting to create the
  // Raspberry Pi directory while retaining the existing read fallback.
  return red.settings && fallback ? fallback : null
}

function backupPath(red, fallback) {
  const currentPath = flowPath(red, fallback)
  if (!currentPath) return null
  return path.join(path.dirname(currentPath), BACKUP_DIR_NAME, BACKUP_FILE_NAME)
}

async function writeJsonAtomically(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  await fs.rename(temporary, file)
}

async function recoverOrBackupFlow(red, stored, flow, fallbackPath, selectedTabId) {
  if (!Array.isArray(flow)) throw new Error('Internal Node-RED flow has an invalid shape')
  // Selection is a protected Plugin Config boundary. Missing or disabled tabs
  // must fail closed and must never be silently resurrected from a flow backup.
  const selected = selectRuleBuilderTab(flow, selectedTabId)
  const target = backupPath(red, fallbackPath)
  try {
    const config = extractConfig(selected.nodes)
    if (target) await writeJsonAtomically(target, { flows: flow, savedAt: new Date().toISOString() })
    return { config, flow }
  } catch (error) {
    if (!target || !red.runtime?.flows?.setFlows) throw error
    let saved
    try {
      saved = JSON.parse(await fs.readFile(target, 'utf8'))
      const savedFlow = Array.isArray(saved) ? saved : saved.flows
      const config = extractConfig(selectRuleBuilderTab(savedFlow, selectedTabId).nodes)
      // Node-RED's setFlows implementation expects a credentials object even
      // when the deployed flow is stored as a plain array without credentials.
      // Passing undefined makes its internal hasOwnProperty check fail and
      // prevents a valid Notification Engine backup from being restored.
      const credentials = stored && !Array.isArray(stored) && stored.credentials && typeof stored.credentials === 'object'
        ? stored.credentials
        : {}
      // The embedded Node-RED API accepts one options object, while older
      // runtime doubles exposed the lower-level three-argument form.
      if (red.runtime.flows.setFlows.length <= 1) {
        await red.runtime.flows.setFlows({ flows: { flows: savedFlow, credentials }, deploymentType: 'full' })
      } else {
        await red.runtime.flows.setFlows(savedFlow, credentials, 'full')
      }
      // Re-read is deliberately avoided here: the validated backup is the
      // configuration just installed, and Node-RED may update its revision
      // asynchronously after setFlows resolves.
      return { config, flow: savedFlow }
    } catch (restoreError) {
      throw new Error(`${error.message}; backup recovery failed: ${restoreError.message}`)
    }
  }
}

function subscribeToDeploy(red, onDeploy) {
  if (!red?.events?.on || !red?.events?.removeListener) throw new Error('Internal Node-RED event API is unavailable')
  const handler = event => {
    if (event?.id === 'runtime-deploy') void onDeploy(event)
  }
  red.events.on('runtime-event', handler)
  return () => red.events.removeListener('runtime-event', handler)
}

module.exports = { getNodeRed, readConfiguration, readCurrentFlow, listActiveFlowTabs, selectRuleBuilderTab, subscribeToDeploy }
