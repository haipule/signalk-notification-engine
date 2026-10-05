'use strict'

const fs = require('node:fs')
const path = require('node:path')

const MAX_TRANSLATION_FILE_BYTES = 64 * 1024
const MAX_TRANSLATION_VALUE_LENGTH = 500
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Z]{2})?$/

/** Load built-in catalogs and safe user overrides without affecting runtime readiness. */
class TranslationCatalog {
  constructor({ builtInDirectory, customDirectory, readFile = fs.readFileSync, listDirectory = fs.readdirSync } = {}) {
    this.builtInDirectory = builtInDirectory
    this.customDirectory = customDirectory
    this.readFile = readFile
    this.listDirectory = listDirectory
    this.errors = []
  }

  /** Return all valid built-in and custom locales with English first. */
  list() {
    this.errors = []
    const locales = new Map()
    for (const entry of this.readDirectory(this.builtInDirectory, true)) locales.set(entry.locale, entry)
    for (const entry of this.readDirectory(this.customDirectory, false)) {
      if (entry.locale !== 'en') locales.set(entry.locale, entry)
    }
    return [...locales.values()]
      .sort((left, right) => left.locale === 'en' ? -1 : right.locale === 'en' ? 1 : left.name.localeCompare(right.name))
      .map(({ locale, name, builtIn }) => ({ locale, name, builtIn }))
  }

  /** Merge a locale over the complete English catalog; invalid input falls back safely. */
  get(requestedLocale) {
    this.errors = []
    const english = this.readLocaleFile(path.join(this.builtInDirectory, 'en.json'), true)
    if (!english) throw new Error('The built-in English translation catalog is unavailable')
    const locale = normalizeLocale(requestedLocale)
    if (locale === 'en') return { ...english, fallbackLocale: 'en', messages: { ...english.messages } }
    const custom = this.readLocaleFile(path.join(this.customDirectory, `${locale}.json`), false)
    const builtIn = this.readLocaleFile(path.join(this.builtInDirectory, `${locale}.json`), true)
    const selected = custom || builtIn
    if (!selected) return { ...english, requestedLocale: locale, fallbackLocale: 'en', messages: { ...english.messages } }
    const overrides = filterOverrides(english.messages, selected.messages, error => {
      this.errors.push({ file: `${selected.locale}.json`, message: error })
    })
    return {
      schemaVersion: 1,
      locale: selected.locale,
      name: selected.name,
      builtIn: selected.builtIn,
      fallbackLocale: 'en',
      messages: { ...english.messages, ...overrides }
    }
  }

  readDirectory(directory, builtIn) {
    if (!directory) return []
    let names
    try {
      names = this.listDirectory(directory).filter(name => name.endsWith('.json')).sort()
    } catch (error) {
      if (error.code !== 'ENOENT') this.errors.push({ file: directory, message: error.message })
      return []
    }
    return names.map(name => this.readLocaleFile(path.join(directory, name), builtIn)).filter(Boolean)
  }

  readLocaleFile(file, builtIn) {
    try {
      const raw = this.readFile(file)
      if (raw.length > MAX_TRANSLATION_FILE_BYTES) throw new Error(`Translation file exceeds ${MAX_TRANSLATION_FILE_BYTES} bytes`)
      const value = JSON.parse(raw.toString('utf8'))
      validateCatalog(value, path.basename(file, '.json'))
      return { ...value, builtIn }
    } catch (error) {
      if (error.code !== 'ENOENT') this.errors.push({ file, message: error.message })
      return null
    }
  }
}

function normalizeLocale(value) {
  const source = String(value || 'en').replace('_', '-')
  const [language, region] = source.split('-')
  const normalized = region ? `${language.toLowerCase()}-${region.toUpperCase()}` : language.toLowerCase()
  return LOCALE_PATTERN.test(normalized) ? normalized : 'en'
}

function validateCatalog(value, fileLocale) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Translation catalog must be an object')
  if (value.schemaVersion !== 1) throw new Error('Translation schemaVersion must be 1')
  if (normalizeLocale(value.locale) !== fileLocale) throw new Error('Translation locale must match its filename')
  if (typeof value.name !== 'string' || !value.name.trim() || value.name.length > 80) throw new Error('Translation name must be a non-empty string of at most 80 characters')
  if (!value.messages || typeof value.messages !== 'object' || Array.isArray(value.messages)) throw new Error('Translation messages must be an object')
  for (const [key, text] of Object.entries(value.messages)) {
    if (!/^[a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9]+)+$/.test(key)) throw new Error(`Invalid translation key: ${key}`)
    if (typeof text !== 'string') throw new Error(`Translation value must be a string: ${key}`)
    if (text.length > MAX_TRANSLATION_VALUE_LENGTH) throw new Error(`Translation value is too long: ${key}`)
    if (/<[^>]+>/.test(text)) throw new Error(`HTML is not permitted in translations: ${key}`)
  }
}

function filterOverrides(english, candidate, onError = () => {}) {
  const accepted = {}
  for (const [key, text] of Object.entries(candidate)) {
    if (!Object.prototype.hasOwnProperty.call(english, key)) continue
    const expected = placeholders(english[key])
    const received = placeholders(text)
    if (expected.join('|') !== received.join('|')) {
      onError(`Translation placeholders do not match English for key: ${key}`)
      continue
    }
    accepted[key] = text
  }
  return accepted
}

function placeholders(text) {
  return [...String(text).matchAll(/\{([a-zA-Z0-9]+)\}/g)].map(match => match[1]).sort()
}

module.exports = { TranslationCatalog, normalizeLocale, validateCatalog, filterOverrides, MAX_TRANSLATION_FILE_BYTES }
