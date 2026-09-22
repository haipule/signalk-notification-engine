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
      const recovered = await recoverOrBackupFlow(red, runtimeFlows, runtimeFlow, '/home/pi/.signalk/red/flows_openplotter.json')
      const rules = validateRules(extractActiveRules(recovered.flow))
      return { config: recovered.config, rules, checksum: checksumConfig({ config: recovered.config, rules }) }
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
  // Back up the file we actually loaded. The configured path may be absent or
  // stale while Node-RED is using its hostname-derived flow file.
  const recovered = await recoverOrBackupFlow(red, stored, flow, loadedPath)
  const rules = validateRules(extractActiveRules(recovered.flow))
  return { config: recovered.config, rules, checksum: checksumConfig({ config: recovered.config, rules }) }
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

async function recoverOrBackupFlow(red, stored, flow, fallbackPath) {
  if (!Array.isArray(flow)) throw new Error('Internal Node-RED flow has an invalid shape')
  const target = backupPath(red, fallbackPath)
  try {
    const config = extractConfig(flow)
    if (target) await writeJsonAtomically(target, { flows: flow, savedAt: new Date().toISOString() })
    return { config, flow }
  } catch (error) {
    if (!target || !red.runtime?.flows?.setFlows) throw error
    let saved
    try {
      saved = JSON.parse(await fs.readFile(target, 'utf8'))
      const savedFlow = Array.isArray(saved) ? saved : saved.flows
      const config = extractConfig(savedFlow)
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

module.exports = { getNodeRed, readConfiguration, subscribeToDeploy }
