'use strict'

const MAX_SOUND_COUNT = 99

/**
 * Convert the current count model or the legacy mode/repeatCount model to one
 * playback count. Zero means an unbounded loop; positive values are the exact
 * number of plays. This is local audio policy only and never changes a Signal
 * K notification lifecycle.
 *
 * @param {object} sound Sound configuration, possibly using legacy fields.
 * @param {object} legacy Legacy flat soundMode/repeatCount fields.
 * @returns {number} Canonical playback count from 0 through 99.
 */
function resolveSoundCount(sound = {}, legacy = {}) {
  const hasCount = Object.prototype.hasOwnProperty.call(sound, 'count')
  if (hasCount && (!Number.isInteger(sound.count) || sound.count < 0 || sound.count > MAX_SOUND_COUNT)) {
    throw new Error(`Sound count must be an integer from 0 to ${MAX_SOUND_COUNT}`)
  }

  const mode = sound.mode ?? legacy.soundMode
  const repeatCount = sound.repeatCount ?? legacy.repeatCount
  let legacyCount
  if (mode !== undefined) {
    if (!['once', 'repeat', 'loop'].includes(mode)) throw new Error('Legacy sound mode is invalid')
    if (mode === 'loop') legacyCount = 0
    else if (mode === 'once') legacyCount = 1
    else {
      if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_SOUND_COUNT) {
        throw new Error(`Legacy repeat count must be an integer from 1 to ${MAX_SOUND_COUNT}`)
      }
      legacyCount = repeatCount
    }
  }

  if (hasCount && legacyCount !== undefined && sound.count !== legacyCount) {
    throw new Error('Sound count conflicts with legacy mode/repeatCount')
  }
  return hasCount ? sound.count : legacyCount ?? 1
}

/** Return one canonical sound object while accepting legacy input fields. */
function normalizeSoundConfig(sound, legacy = {}) {
  if (typeof sound === 'string') return { active: true, file: sound, count: 1 }
  if (!sound || typeof sound !== 'object' || Array.isArray(sound)) return sound
  const { mode, repeatCount, ...current } = sound
  return { ...current, count: resolveSoundCount(sound, legacy) }
}

module.exports = { MAX_SOUND_COUNT, normalizeSoundConfig, resolveSoundCount }
