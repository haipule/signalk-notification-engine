'use strict'

const { spawn } = require('node:child_process')

class AudioPlayer {
  constructor({ player = 'aplay', device = 'default', onError = () => {} } = {}) {
    this.player = player
    this.device = device
    this.onError = onError
    this.processes = new Map()
  }

  play(fileName, key = '', onClose = null) {
    if (!fileName) return
    const argumentsForPlayer = this.player.endsWith('aplay') && this.device ? ['-D', this.device, fileName] : [fileName]
    const process = spawn(this.player, argumentsForPlayer, { stdio: ['ignore', 'ignore', 'pipe'] })
    const processes = this.processes.get(key) || new Set()
    processes.add(process)
    this.processes.set(key, processes)
    process.once('error', this.onError)
    process.stderr.on('data', data => this.onError(new Error(String(data).trim())))
    process.once('close', () => {
      processes.delete(process)
      if (processes.size === 0) this.processes.delete(key)
      onClose?.()
    })
  }

  stop() {
    for (const processes of this.processes.values()) {
      for (const process of processes) process.kill()
    }
    this.processes.clear()
  }

  stopKey(key) {
    const processes = this.processes.get(key)
    if (!processes) return
    for (const process of processes) process.kill()
    this.processes.delete(key)
  }
}

module.exports = AudioPlayer
