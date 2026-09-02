'use strict'

const fs = require('node:fs/promises')
const path = require('node:path')

/**
 * Durable append-style history for local audit events.
 *
 * The file is intentionally separate from Signal K's notification lifecycle.
 * Losing or editing this file cannot clear, acknowledge, or otherwise change
 * a Signal K alarm. Writes are serialised and use rename for atomic replacement.
 */
class HistoryRepository {
  constructor(directory, { limit = 500, onError = () => {} } = {}) {
    this.directory = directory
    this.limit = limit
    this.onError = onError
    this.filePath = directory ? path.join(directory, 'notification-history.json') : null
    this.events = []
    this.writeQueue = Promise.resolve()
  }

  async load() {
    if (!this.filePath) return []
    try {
      const text = await fs.readFile(this.filePath, 'utf8')
      const parsed = JSON.parse(text)
      this.events = Array.isArray(parsed.events) ? parsed.events.slice(0, this.limit) : []
    } catch (error) {
      this.events = []
      if (error.code !== 'ENOENT') this.onError(`Could not load notification history: ${error.message}`)
    }
    return structuredClone(this.events)
  }

  append(event) {
    if (!this.filePath) return
    this.events.unshift(structuredClone(event))
    this.events.length = Math.min(this.events.length, this.limit)
    this.enqueue(() => this.persist())
  }

  enqueue(operation) {
    this.writeQueue = this.writeQueue
      .then(operation)
      .catch(error => this.onError(`Could not save notification history: ${error.message}`))
  }

  flush() {
    return this.writeQueue
  }

  async clear() {
    if (!this.filePath) return
    this.events = []
    this.enqueue(async () => {
      try {
        await fs.unlink(this.filePath)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
    })
    await this.writeQueue
  }

  async prune(predicate) {
    const before = this.events.length
    this.events = this.events.filter(event => !predicate(event))
    if (this.events.length !== before) {
      this.enqueue(() => this.persist())
      await this.writeQueue
    }
  }

  async pruneBefore(timestamp) {
    await this.prune(event => new Date(event.at).valueOf() < timestamp)
  }

  async persist() {
    await fs.mkdir(this.directory, { recursive: true })
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`
    await fs.writeFile(temporaryPath, `${JSON.stringify({ version: 1, events: this.events }, null, 2)}\n`, { mode: 0o600 })
    await fs.rename(temporaryPath, this.filePath)
  }
}

module.exports = HistoryRepository
