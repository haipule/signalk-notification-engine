'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

/** Atomically persist unresolved audio failures independently of alarm state. */
class AudioSystemRepository {
  constructor(directory, { onError = () => {} } = {}) {
    this.directory = directory
    this.filePath = directory ? path.join(directory, 'audio-system-notification.json') : null
    this.onError = onError
    this.writeQueue = Promise.resolve()
    this.lastWriteAt = null
    this.lastWriteError = null
  }

  async load() {
    if (!this.filePath) return { version: 1, failures: [] }
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'))
      return { version: 1, failures: Array.isArray(parsed.failures) ? parsed.failures : [] }
    } catch (error) {
      if (error.code !== 'ENOENT') this.onError(`Could not load audio system notification state: ${error.message}`)
      return { version: 1, failures: [] }
    }
  }

  save(snapshot) {
    if (!this.filePath) return
    const value = structuredClone(snapshot)
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
        this.onError(`Could not save audio system notification state: ${error.message}`)
      })
  }

  flush() { return this.writeQueue }

  status() {
    return { available: Boolean(this.filePath), lastWriteAt: this.lastWriteAt, lastError: this.lastWriteError }
  }
}

module.exports = AudioSystemRepository
