'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const MAX_RESTART_RECORDS = 5000

/**
 * Persist exact local restart correlation without becoming notification
 * authority. The data can only reuse a local occurrence and a completed finite
 * playback signature; it can never create, clear, acknowledge, or silence a
 * Signal K notification.
 */
class RestartStateRepository {
  constructor(directory, { onError = () => {} } = {}) {
    this.directory = directory
    this.filePath = directory ? path.join(directory, 'restart-state.json') : null
    this.onError = onError
    this.writeQueue = Promise.resolve()
    this.lastWriteAt = null
    this.lastWriteError = null
  }

  async load() {
    if (!this.filePath) return emptyState()
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'))
      if (parsed?.version !== 1) throw new Error('unsupported restart-state version')
      return {
        version: 1,
        notifications: validArray(parsed.notifications),
        completedPlayback: validArray(parsed.completedPlayback)
      }
    } catch (error) {
      if (error.code !== 'ENOENT') this.onError(`Could not load restart state: ${error.message}`)
      return emptyState()
    }
  }

  save(snapshot) {
    if (!this.filePath) return
    const value = {
      version: 1,
      notifications: validArray(snapshot?.notifications),
      completedPlayback: validArray(snapshot?.completedPlayback)
    }
    this.writeQueue = this.writeQueue
      .then(async () => {
        await fs.mkdir(this.directory, { recursive: true })
        const temporaryPath = `${this.filePath}.${process.pid}.tmp`
        await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
        await fs.rename(temporaryPath, this.filePath)
        this.lastWriteAt = new Date().toISOString()
        this.lastWriteError = null
      })
      .catch(error => {
        this.lastWriteError = { message: error.message, at: new Date().toISOString() }
        this.onError(`Could not save restart state: ${error.message}`)
      })
  }

  flush() { return this.writeQueue }

  status() {
    return { available: Boolean(this.filePath), lastWriteAt: this.lastWriteAt, lastError: this.lastWriteError }
  }
}

function validArray(value) {
  return Array.isArray(value) ? structuredClone(value.slice(0, MAX_RESTART_RECORDS)) : []
}

function emptyState() {
  return { version: 1, notifications: [], completedPlayback: [] }
}

module.exports = RestartStateRepository
