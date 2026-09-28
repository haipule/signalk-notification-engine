'use strict'

const fs = require('node:fs')
const path = require('node:path')

/** Passively inspect the audio backend and ALSA inventory without playing sound. */
class AudioWatchdog {
  constructor({ readFile = fs.readFileSync, access = fs.accessSync, pathValue = process.env.PATH || '', now = () => new Date().toISOString() } = {}) {
    this.readFile = readFile
    this.access = access
    this.pathValue = pathValue
    this.now = now
    this.lastCheck = null
  }

  check(player, device) {
    const backendPath = this.findExecutable(String(player || ''))
    const deviceCheck = inspectDevice(String(device || 'default'), this.readPcmInventory())
    const errors = []
    if (!backendPath) errors.push(`Audio backend not found: ${player}`)
    if (!deviceCheck.available) errors.push(deviceCheck.message)
    this.lastCheck = {
      state: errors.length === 0 ? 'ready' : 'error',
      checkedAt: this.now(),
      backend: { command: player, available: Boolean(backendPath), path: backendPath },
      device: { name: device, ...deviceCheck },
      message: errors.join('; ') || 'Backend and ALSA playback device are available',
      limitation: 'Passive check only; amplifier, speaker, volume, and audible sound are not verified.'
    }
    return this.lastCheck
  }

  findExecutable(command) {
    if (!command) return null
    const candidates = command.includes('/') ? [command] : this.pathValue.split(path.delimiter).filter(Boolean).map(directory => path.join(directory, command))
    for (const candidate of candidates) {
      try { this.access(candidate, fs.constants.X_OK); return candidate } catch {}
    }
    return null
  }

  readPcmInventory() {
    try { return String(this.readFile('/proc/asound/pcm', 'utf8')) } catch { return '' }
  }
}

function inspectDevice(device, inventory) {
  if (!inventory) return { available: false, message: 'ALSA PCM inventory is unavailable' }
  if (device === 'default') return inventory.includes('playback')
    ? { available: true, message: 'ALSA playback inventory is available' }
    : { available: false, message: 'No ALSA playback device is listed' }
  const match = /^(?:plug)?hw:(\d+),(\d+)$/.exec(device)
  if (!match) return { available: false, message: `Passive validation is unsupported for ALSA device ${device}` }
  const pcmId = `${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}:`
  const line = inventory.split('\n').find(entry => entry.startsWith(pcmId))
  return line?.includes('playback')
    ? { available: true, message: `ALSA PCM ${pcmId.slice(0, -1)} supports playback` }
    : { available: false, message: `ALSA playback PCM ${pcmId.slice(0, -1)} is unavailable` }
}

module.exports = { AudioWatchdog, inspectDevice }
