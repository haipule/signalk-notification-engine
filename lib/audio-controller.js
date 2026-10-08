'use strict'

const path = require('node:path')
const AudioPlaybackRegistry = require('./audio-playback-registry')
const AudioRepeatPlan = require('./audio-repeat-plan')
const { AudioWatchdog } = require('./audio-watchdog')
const { AUDIO_SYSTEM_PATH } = require('./audio-system-notification')
const { createSoundSignature, resolveSoundPauseSeconds } = require('./sound-config')

/**
 * Own local notification playback without changing Signal K lifecycle state.
 * Silence tracking, retries, repetition, and circuit probes are presentation
 * policy only; authoritative notification actions remain outside this class.
 */
class AudioController {
  constructor({ player, circuitBreaker, systemNotification, resolvePolicy, isEnabledState, baseDirectory, logError = () => {}, onPlaybackRegistryChange = () => {}, now = () => Date.now(), setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout, setIntervalFn = setInterval, clearIntervalFn = clearInterval, setImmediateFn = setImmediate }) {
    this.player = player
    this.circuitBreaker = circuitBreaker
    this.systemNotification = systemNotification
    this.resolvePolicy = resolvePolicy
    this.isEnabledState = isEnabledState
    this.baseDirectory = baseDirectory
    this.logError = logError
    this.now = now
    this.setTimeout = setTimeoutFn
    this.clearTimeout = clearTimeoutFn
    this.setInterval = setIntervalFn
    this.clearInterval = clearIntervalFn
    this.setImmediate = setImmediateFn
    this.playbackRegistry = new AudioPlaybackRegistry(onPlaybackRegistryChange)
    this.watchdog = new AudioWatchdog()
    this.timers = new Map()
    this.attempts = new Map()
    this.silenced = new Map()
    this.watchdogTimer = null
    this.ready = false
  }

  /** Apply one store transition to local audio only. */
  apply(event) {
    const notification = event.notification
    if (notification.path === AUDIO_SYSTEM_PATH) return this.stopKey(notification.occurrenceId)
    const policy = this.resolvePolicy(notification)
    const eligible = this.ready && this.isEnabledState(notification.state) && event.type !== 'action_requested'
    const signalKSilenced = notification.status?.silenced === true
    if (event.type === 'cleared' || event.type === 'local_lifecycle_ended' || ['normal', 'nominal'].includes(notification.state)) {
      this.silenced.delete(notification.occurrenceId)
      this.stopKey(notification.occurrenceId)
      this.circuitBreaker.endLifecycle(notification)
    } else if (signalKSilenced) {
      this.silence(notification)
    } else if (this.silenced.get(notification.occurrenceId) === notification.state) {
      this.stopKey(notification.occurrenceId)
    } else if (eligible && policy.audio !== 'off' && policy.soundConfig?.active !== false && policy.soundConfig?.file) {
      this.silenced.delete(notification.occurrenceId)
      this.start(notification, policy.soundConfig)
    } else if (policy.audio === 'off' || policy.visible === false) {
      this.stopKey(notification.occurrenceId)
    }
  }

  /** Mark one occurrence locally silenced and stop its playback. */
  silence(notification) {
    this.silenced.set(notification.occurrenceId, notification.state)
    this.stopKey(notification.occurrenceId)
  }

  /** Undo only the optimistic local silence marker after a rejected action. */
  rollbackSilence(notification) {
    this.silenced.delete(notification.occurrenceId)
  }

  /** Enable playback and apply the current authoritative notification view. */
  enable(notifications, eventType = 'startup') {
    this.ready = true
    for (const notification of notifications) this.apply({ type: eventType, notification })
  }

  /** Fail closed while retaining completed finite playback signatures. */
  suspend() {
    this.ready = false
    this.clearPending()
    this.playbackRegistry.retainCompleted()
    this.player.stop()
  }

  /** Stop all local playback state for plugin shutdown. */
  shutdown() {
    this.ready = false
    this.clearPending()
    this.playbackRegistry.clear()
    this.silenced.clear()
    this.player.stop()
    this.stopWatchdog()
  }

  /** Configure the player and refresh passive backend/device health. */
  configure(player, device) {
    this.player.player = String(player || 'aplay')
    this.player.device = String(device || 'default')
    this.startWatchdog()
  }

  /** Return local playback health and state for read-only diagnostics. */
  diagnostics() {
    return {
      ready: this.ready,
      player: this.player.player,
      device: this.player.device,
      activeProcesses: this.player.activeProcessCount(),
      activeProcessDetails: this.player.activeProcessDetails(),
      pendingRetries: this.timers.size,
      playbackRegistry: this.playbackRegistry.toJSON(),
      lastResult: this.player.lastResult ? { ...this.player.lastResult, error: this.player.lastResult.error?.message || null } : null,
      watchdog: this.watchdog.lastCheck
    }
  }

  /** Restore completed finite playback only; loops and interrupted work resume. */
  restoreCompletedPlayback(entries) {
    this.playbackRegistry.restoreCompleted(entries)
  }

  /** Return only completed signatures safe to reuse after an exact restart match. */
  completedPlayback() {
    return this.playbackRegistry.toJSON().filter(entry => entry.completed)
  }

  /**
   * Report whether one local notification occurrence still has audio work.
   *
   * An incomplete registry entry covers a running player, a pause between
   * repeats, a loop, and a bounded retry. Completed finite playback is not
   * actionable: presenting Silence after the sound ended would promise an
   * acoustic effect that no longer exists.
   *
   * @param {string} occurrenceId Local notification occurrence identity.
   * @returns {boolean} Whether Silence can still affect local audio work.
   */
  isAudioActionable(occurrenceId) {
    if (!occurrenceId) return false
    return this.playbackRegistry.toJSON().some(entry => entry.key === occurrenceId && entry.completed !== true)
  }

  start(notification, soundConfig) {
    const key = notification.occurrenceId
    const file = soundConfig?.file
    if (!file) return
    const count = Number.isInteger(soundConfig.count) && soundConfig.count >= 0 && soundConfig.count <= 99 ? soundConfig.count : 1
    const pauseSeconds = resolveSoundPauseSeconds(soundConfig)
    const resolvedFile = path.resolve(this.baseDirectory, file)
    const signature = createSoundSignature(file, count, pauseSeconds, this.baseDirectory)
    if (this.playbackRegistry.current(key) === signature) return
    this.stopKey(key)
    this.circuitBreaker.adopt(notification)
    this.playbackRegistry.begin(key, signature)
    const repeatPlan = new AudioRepeatPlan(count, pauseSeconds)
    const play = () => {
      if (!this.playbackRegistry.isCurrent(key, signature)) return
      const permission = this.circuitBreaker.beginAttempt(notification)
      if (!permission.allowed) return this.schedule(key, Math.max(0, Number(permission.retryAt || this.now()) - this.now()))
      repeatPlan.startAttempt()
      this.player.play(resolvedFile, key, result => {
        if (!this.playbackRegistry.isCurrent(key, signature)) return
        if (result?.ok) {
          this.systemNotification.recordSuccess(notification)
          this.circuitBreaker.recordSuccess(notification)
          const delay = repeatPlan.nextDelayMs()
          if (delay !== null) delay > 0 ? this.schedule(key, delay) : this.setImmediate(play)
          else {
            this.playbackRegistry.complete(key, signature)
            this.attempts.delete(key)
          }
          return
        }
        this.systemNotification.recordFailure(notification, result)
        const circuit = this.circuitBreaker.recordFailure(notification, result)
        const delay = circuit.state === 'open'
          ? Math.max(0, Number(circuit.nextProbeAt) - this.now())
          : Math.min(60000, 1000 * (2 ** Math.min(circuit.failureCount - 1, 6)))
        this.logError(circuit.state === 'open'
          ? `Notification audio circuit open after ${circuit.failureCount} failures; probe in ${delay}ms for ${key}`
          : `Notification audio retry ${circuit.failureCount} in ${delay}ms for ${key}`)
        this.schedule(key, delay)
      })
    }
    this.attempts.set(key, play)
    play()
  }

  schedule(key, delay) {
    const existing = this.timers.get(key)
    if (existing) this.clearTimeout(existing)
    const attempt = this.attempts.get(key)
    if (!attempt) return
    const timer = this.setTimeout(() => {
      this.timers.delete(key)
      attempt()
    }, Math.max(0, delay))
    this.timers.set(key, timer)
  }

  stopKey(key) {
    const timer = this.timers.get(key)
    if (timer) this.clearTimeout(timer)
    this.timers.delete(key)
    this.attempts.delete(key)
    this.playbackRegistry.end(key)
    this.player.stopKey(key)
  }

  clearPending() {
    for (const timer of this.timers.values()) this.clearTimeout(timer)
    this.timers.clear()
    this.attempts.clear()
  }

  startWatchdog() {
    const check = () => {
      const previous = this.watchdog.lastCheck?.state || null
      const result = this.watchdog.check(this.player.player, this.player.device)
      if (previous === 'error' && result.state === 'ready') {
        const key = this.circuitBreaker.watchdogRecovered()
        if (key) this.schedule(key, 0)
      }
    }
    check()
    if (this.watchdogTimer === null) this.watchdogTimer = this.setInterval(check, 60000)
  }

  stopWatchdog() {
    if (this.watchdogTimer !== null) this.clearInterval(this.watchdogTimer)
    this.watchdogTimer = null
  }
}

module.exports = AudioController
