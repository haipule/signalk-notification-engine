'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

const TERMINAL_STATES = new Set(['technical_failure', 'not_heard', 'passed_heard', 'passed_no_counter_report'])

/** Atomically persist the last completed alarm sound test outside bounded History. */
class AudioSelfTestRepository {
  constructor(directory, { onError = () => {} } = {}) {
    this.directory = directory
    this.filePath = directory ? path.join(directory, 'audio-self-test.json') : null
    this.onError = onError
    this.writeQueue = Promise.resolve()
    this.lastWriteAt = null
    this.lastWriteError = null
  }

  /** Load only a terminal test result; active states cannot survive a restart. */
  async load() {
    if (!this.filePath) return null
    try {
      const parsed = JSON.parse(await fs.readFile(this.filePath, 'utf8'))
      return parsed?.version === 1 && TERMINAL_STATES.has(parsed.test?.state)
        ? structuredClone(parsed.test)
        : null
    } catch (error) {
      if (error.code !== 'ENOENT') this.onError(`Could not load alarm sound test state: ${error.message}`)
      return null
    }
  }

  /** Queue one complete atomic replacement without affecting Signal K state. */
  save(test) {
    if (!this.filePath || !TERMINAL_STATES.has(test?.state)) return
    const value = { version: 1, test: structuredClone(test) }
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
        this.onError(`Could not save alarm sound test state: ${error.message}`)
      })
  }

  flush() { return this.writeQueue }

  status() {
    return { available: Boolean(this.filePath), lastWriteAt: this.lastWriteAt, lastError: this.lastWriteError }
  }
}

module.exports = AudioSelfTestRepository
