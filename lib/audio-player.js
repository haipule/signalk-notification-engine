'use strict'

const { spawn } = require('node:child_process')

class AudioPlayer {
  constructor({ player = 'aplay', device = 'default', onError = () => {}, onResult = () => {}, spawnProcess = spawn, now = () => Date.now() } = {}) {
    this.player = player
    this.device = device
    this.onError = onError
    this.onResult = onResult
    this.spawnProcess = spawnProcess
    this.now = now
    this.processes = new Map()
    this.processDetails = new Map()
    this.lastResult = null
  }

  /** Start one backend process and report its file, lifecycle key, timing, and exit result. */
  play(fileName, key = '', onClose = null) {
    if (!fileName) return
    const startedAtMs = this.now()
    const argumentsForPlayer = this.player.endsWith('aplay') && this.device ? ['-D', this.device, fileName] : [fileName]
    const process = this.spawnProcess(this.player, argumentsForPlayer, { stdio: ['ignore', 'ignore', 'pipe'] })
    const detail = {
      key,
      file: fileName,
      player: this.player,
      device: this.device,
      pid: process.pid ?? null,
      startedAt: new Date(startedAtMs).toISOString()
    }
    this.processDetails.set(process, detail)
    let stderr = ''
    let spawnError = null
    const processes = this.processes.get(key) || new Set()
    processes.add(process)
    this.processes.set(key, processes)
    process.once('error', error => { spawnError = error })
    process.stderr.on('data', data => { stderr += String(data) })
    process.once('close', (code, signal) => {
      const completedAtMs = this.now()
      processes.delete(process)
      if (processes.size === 0) this.processes.delete(key)
      this.processDetails.delete(process)
      const error = spawnError || (code !== 0 && signal === null
        ? new Error(stderr.trim() || `${this.player} exited with code ${code}`)
        : null)
      if (error) this.onError(error)
      const result = {
        ...detail,
        completedAt: new Date(completedAtMs).toISOString(),
        durationMs: Math.max(0, completedAtMs - startedAtMs),
        ok: !error && code === 0,
        code,
        signal,
        stderr: stderr.trim(),
        error
      }
      this.lastResult = result
      this.onResult(result)
      onClose?.(result)
    })
  }

  stop() {
    for (const processes of this.processes.values()) {
      for (const process of processes) process.kill()
    }
    this.processes.clear()
    this.processDetails.clear()
  }

  stopKey(key) {
    const processes = this.processes.get(key)
    if (!processes) return
    for (const process of processes) process.kill()
    this.processes.delete(key)
    for (const [process, detail] of this.processDetails) {
      if (detail.key === key) this.processDetails.delete(process)
    }
  }

  /** Return the number of currently running backend processes. */
  activeProcessCount() {
    let count = 0
    for (const processes of this.processes.values()) count += processes.size
    return count
  }

  /** Return current process metadata without exposing mutable internal state. */
  activeProcessDetails() {
    return [...this.processDetails.values()].map(detail => structuredClone(detail))
  }
}

module.exports = AudioPlayer
