'use strict'

const { randomUUID } = require('node:crypto')

const DEFAULT_FEEDBACK_MS = 15000
const AUDIO_SELF_TEST_ORIGIN_PATH = 'notifications.system.notificationEngine.audioSelfTest'

/** Coordinate one bounded audible maintenance test and its feedback window. */
class AudioSelfTest {
  constructor({
    play,
    onEvent = () => {},
    onFailure = () => {},
    onPassed = () => {},
    now = () => Date.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    feedbackMs = DEFAULT_FEEDBACK_MS
  } = {}) {
    this.play = play
    this.onEvent = onEvent
    this.onFailure = onFailure
    this.onPassed = onPassed
    this.now = now
    this.setTimer = setTimer
    this.clearTimer = clearTimer
    this.feedbackMs = feedbackMs
    this.timer = null
    this.current = null
  }

  /** Start one fixed single-play test without interrupting notification audio. */
  start({ actor, device, file }) {
    if (['playing', 'awaiting_feedback'].includes(this.current?.state)) throw new Error('An audio test is already in progress')
    if (typeof this.play !== 'function') throw new Error('Audio test player is unavailable')
    const startedAtMs = this.now()
    this.current = {
      id: randomUUID(),
      state: 'playing',
      actor,
      device,
      file,
      startedAt: new Date(startedAtMs).toISOString(),
      feedbackDeadlineAt: null,
      completedAt: null,
      passedAt: null,
      player: null,
      operatorFeedback: null,
      statement: 'Test started; technical playback is in progress.'
    }
    this.emit('audio_test_started')
    this.play(file, result => this.complete(result || {}))
    return this.toJSON()
  }

  /** Record the authoritative backend result and open feedback only on success. */
  complete(result) {
    if (this.current?.state !== 'playing') return
    const completedAtMs = this.now()
    this.current.completedAt = new Date(completedAtMs).toISOString()
    this.current.player = {
      ok: result.ok === true,
      code: result.code ?? null,
      signal: result.signal ?? null,
      error: result.error?.message || result.error || null
    }
    if (result.ok !== true) {
      this.current.state = 'technical_failure'
      this.current.statement = 'Technical playback failed; audibility was not evaluated.'
      this.emit('audio_test_technical_failure')
      this.onFailure(this.toJSON(), result)
      return
    }
    this.current.state = 'awaiting_feedback'
    this.current.feedbackDeadlineAt = new Date(completedAtMs + this.feedbackMs).toISOString()
    this.current.statement = 'Technically played; 15 seconds remain to report that the sound was not heard.'
    this.emit('audio_test_technically_played')
    this.timer = this.setTimer(() => this.passWithoutCounterReport(), this.feedbackMs)
  }

  /** Record explicit human evidence that the technically successful tone was inaudible. */
  reportNotHeard(actor) {
    if (this.current?.state !== 'awaiting_feedback') throw new Error('No audio test is awaiting feedback')
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
    this.current.state = 'not_heard'
    this.current.operatorFeedback = { heard: false, actor, at: new Date(this.now()).toISOString() }
    this.current.statement = 'Sound not heard; the audio system notification remains active.'
    this.emit('audio_test_not_heard')
    this.onFailure(this.toJSON(), { error: new Error('Operator reported that the test tone was not heard') })
    return this.toJSON()
  }

  /** Pass operationally after the agreed window, without claiming human hearing. */
  passWithoutCounterReport() {
    if (this.current?.state !== 'awaiting_feedback') return
    this.timer = null
    this.current.state = 'passed_no_counter_report'
    this.current.passedAt = new Date(this.now()).toISOString()
    this.current.statement = 'Technically played with no counter-report; human audibility was not confirmed.'
    this.emit('audio_test_passed_no_counter_report')
    this.onPassed(this.toJSON())
  }

  stop() {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
  }

  /** Restore the last terminal audit state without replaying callbacks. */
  restore(test) {
    if (!test || typeof test !== 'object') return
    if (!['technical_failure', 'not_heard', 'passed_no_counter_report'].includes(test.state)) return
    this.current = structuredClone(test)
  }

  emit(type) {
    this.onEvent({ type, at: new Date(this.now()).toISOString(), test: this.toJSON() })
  }

  toJSON() {
    return this.current ? structuredClone(this.current) : { state: 'idle', statement: 'No alarm sound test has been run yet.' }
  }
}

module.exports = { AudioSelfTest, DEFAULT_FEEDBACK_MS, AUDIO_SELF_TEST_ORIGIN_PATH }
