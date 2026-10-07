'use strict'

const fs = require('node:fs')
const path = require('node:path')
const { normalizeSoundConfig } = require('./sound-config')

const SOUND_STATES = ['emergency', 'alarm', 'warn', 'alert', 'nominal', 'normal', 'info', 'notification']

/**
 * Normalize presentation settings without applying runtime side effects.
 * Signal K and Node-RED remain authoritative for lifecycle and rule content;
 * this service only converts declarative configuration into local policy data.
 */
class ConfigurationService {
  constructor({ baseDirectory, visualColorPool }) {
    this.baseDirectory = baseDirectory
    this.visualColorPool = visualColorPool
    this.colorPalette = { ...visualColorPool }
  }

  loadColorPalette(fileName) {
    this.colorPalette = this.loadPalette(fileName, this.visualColorPool)
    return { ...this.colorPalette }
  }

  normalizePolicies(configuredPolicies) {
    return Array.isArray(configuredPolicies)
      ? configuredPolicies.map(policy => ({
          ...policy,
          sound: typeof policy.sound === 'string'
            ? { active: true, file: policy.sound, count: 1 }
            : normalizeSoundConfig(policy.sound),
          match: { pathPrefix: policy.pathPrefix || undefined, source: policy.source || undefined }
        }))
      : []
  }

  normalizeStateOrder(order, legacySortOrder, legacyVisibleStates) {
    const allowed = ['warn', 'alert', 'nominal', 'normal']
    const selected = Array.isArray(order)
      ? order.filter(state => allowed.includes(state))
      : Array.isArray(legacySortOrder)
        ? legacySortOrder.filter(state => allowed.includes(state))
        : Array.isArray(legacyVisibleStates)
          ? legacyVisibleStates.filter(state => allowed.includes(state))
          : []
    return [...new Set(selected)]
  }

  normalizeStateColors(colors) {
    const palette = this.colorPalette
    const defaults = { emergency: palette.red, alarm: palette.darkRed, warn: palette.yellow, alert: palette.orange, nominal: palette.green, normal: palette.grey }
    for (const state of Object.keys(defaults)) {
      if (typeof colors?.[state] !== 'string') continue
      if (palette[colors[state]]) defaults[state] = palette[colors[state]]
      else if (/^#[0-9a-f]{6}$/i.test(colors[state])) defaults[state] = colors[state]
    }
    return defaults
  }

  normalizeSoundsByState(sounds, fileName) {
    const fallback = Object.fromEntries(SOUND_STATES.map(state => [state, path.join(this.baseDirectory, 'sounds', `${state}.wav`)]))
    const palette = this.loadPalette(fileName, fallback)
    const defaults = Object.fromEntries(Object.entries(palette).map(([state, sound]) => [state, { active: true, file: sound || null, count: 1 }]))
    for (const state of Object.keys(defaults)) {
      const configured = sounds?.[state]
      if (typeof configured === 'string' && configured.trim()) defaults[state].file = configured.trim()
      if (configured && typeof configured === 'object') {
        if (typeof configured.active === 'boolean') defaults[state].active = configured.active
        if (typeof configured.file === 'string' && configured.file.trim()) defaults[state].file = configured.file.trim()
        defaults[state].count = normalizeSoundConfig(configured).count
      }
    }
    return defaults
  }

  normalizeVisualRules(rules, colors) {
    const defaults = {
      emergency: { display: 'overlay', color: colors.emergency, flash: true, acknowledgeRequired: true },
      alarm: { display: 'overlay', color: colors.alarm, flash: true, acknowledgeRequired: true },
      warn: { display: 'banner', color: colors.warn, flash: false, acknowledgeRequired: false },
      alert: { display: 'banner', color: colors.alert, flash: false, acknowledgeRequired: false },
      nominal: { display: 'table', color: colors.nominal, flash: false, acknowledgeRequired: false },
      normal: { display: 'table', color: colors.normal, flash: false, acknowledgeRequired: false }
    }
    for (const state of Object.keys(defaults)) {
      const candidate = rules?.[state]
      if (!candidate) continue
      if (['table', 'banner', 'overlay'].includes(candidate.display)) defaults[state].display = candidate.display
      if (typeof candidate.color === 'string') {
        if (this.colorPalette[candidate.color]) defaults[state].color = this.colorPalette[candidate.color]
        else if (/^#[0-9a-f]{6}$/i.test(candidate.color)) defaults[state].color = candidate.color
      }
      if (typeof candidate.flash === 'boolean') defaults[state].flash = candidate.flash
      if (typeof candidate.acknowledgeRequired === 'boolean') defaults[state].acknowledgeRequired = candidate.acknowledgeRequired
    }
    return defaults
  }

  loadPalette(fileName, fallback) {
    if (!fileName) return { ...fallback }
    try {
      const value = JSON.parse(fs.readFileSync(path.resolve(fileName), 'utf8'))
      return Object.fromEntries(Object.keys(fallback).map(name => [name, typeof value[name] === 'string' ? value[name] : fallback[name]]))
    } catch {
      return { ...fallback }
    }
  }
}

function normalizeInfoTimeout(value) {
  return Number.isInteger(value) ? Math.max(0, Math.min(3600, value)) : 0
}

/** Normalize the local audible safety-test interval without affecting alarm state. */
function normalizeAlarmTestInterval(value) {
  return Number.isInteger(value) && value >= 0 && value <= 30 ? value : 7
}

function normalizeShortcut(value, fallback) {
  return typeof value === 'string' && value.length <= 1 ? value.toLowerCase() : fallback
}

function normalizeHistoryRules(rules) {
  return Array.isArray(rules)
    ? rules.filter(rule => rule && (rule.pathPrefix || rule.source)).map(rule => ({
      pathPrefix: String(rule.pathPrefix || '').toLowerCase(), source: String(rule.source || ''), history: rule.history !== false
    }))
    : []
}

function normalizeClearPath(value) {
  return String(value || '').trim().toLowerCase().replace(/\*$/, '')
}

module.exports = { ConfigurationService, normalizeAlarmTestInterval, normalizeClearPath, normalizeHistoryRules, normalizeInfoTimeout, normalizeShortcut }
