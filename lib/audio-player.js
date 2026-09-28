'use strict'

const { spawn } = require('node:child_process')

class AudioPlayer {
  constructor({ player = 'aplay', device = 'default', onError = () => {}, onResult = () => {}, spawnProcess = spawn } = {}) {
    this.player = player
    this.device = device
    this.onError = onError
    this.onResult = onResult
    this.spawnProcess = spawnProcess
    this.processes = new Map()
  }

  play(fileName, key = '', onClose = null) {
    if (!fileName) return
    const argumentsForPlayer = this.player.endsWith('aplay') && this.device ? ['-D', this.device, fileName] : [fileName]
    const process = this.spawnProcess(this.player, argumentsForPlayer, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let spawnError = null
    const processes = this.processes.get(key) || new Set()
    processes.add(process)
    this.processes.set(key, processes)
    process.once('error', error => { spawnError = error })
    process.stderr.on('data', data => { stderr += String(data) })
    process.once('close', (code, signal) => {
      processes.delete(process)
      if (processes.size === 0) this.processes.delete(key)
      const error = spawnError || (code !== 0 && signal === null
        ? new Error(stderr.trim() || `${this.player} exited with code ${code}`)
        : null)
      if (error) this.onError(error)
      const result = { ok: !error && code === 0, code, signal, stderr: stderr.trim(), error }
      this.onResult(result)
      onClose?.(result)
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

  /** Return the number of currently running backend processes. */
  activeProcessCount() {
    let count = 0
    for (const processes of this.processes.values()) count += processes.size
    return count
  }
}

module.exports = AudioPlayer
