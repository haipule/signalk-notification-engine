'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { TranslationCatalog, normalizeLocale } = require('../lib/translation-catalog')

const builtInDirectory = path.join(__dirname, '..', 'public', 'translations')

test('ships complete English and German catalogs', () => {
  const catalog = new TranslationCatalog({ builtInDirectory, customDirectory: '/missing' })
  const english = catalog.get('en')
  const german = catalog.get('de')
  assert.equal(english.locale, 'en')
  assert.equal(german.locale, 'de')
  assert.deepEqual(Object.keys(german.messages).sort(), Object.keys(english.messages).sort())
})

test('defines every translation key referenced by the WebApp', () => {
  const english = JSON.parse(fs.readFileSync(path.join(builtInDirectory, 'en.json'), 'utf8')).messages
  const sources = ['public/index.html', 'public/app.js'].map(file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n')
  const referenced = new Set([...sources.matchAll(/(?:data-i18n(?:-title|-aria-label)?=|\bt\()\s*["'`]([^"'`]+)["'`]/g)].map(match => match[1]).filter(key => !key.includes('${')))
  for (const key of referenced) assert.equal(Object.prototype.hasOwnProperty.call(english, key) || Object.prototype.hasOwnProperty.call(english, `${key}.one`) || Object.prototype.hasOwnProperty.call(english, `${key}.other`), true, `Missing English translation: ${key}`)
})

test('merges a valid persistent user translation over English', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-engine-i18n-'))
  fs.writeFileSync(path.join(directory, 'nl.json'), JSON.stringify({ schemaVersion: 1, locale: 'nl', name: 'Nederlands', messages: { 'app.title': 'Alarmcentrum' } }))
  const catalog = new TranslationCatalog({ builtInDirectory, customDirectory: directory })
  const dutch = catalog.get('nl')
  assert.equal(dutch.messages['app.title'], 'Alarmcentrum')
  assert.equal(dutch.messages['actions.silence'], 'Silence')
  assert.equal(dutch.builtIn, false)
})

test('rejects unsafe custom markup and falls back to the safe built-in locale', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-engine-i18n-'))
  fs.writeFileSync(path.join(directory, 'de.json'), JSON.stringify({ schemaVersion: 1, locale: 'de', name: 'Deutsch', messages: { 'app.title': '<img src=x>' } }))
  const catalog = new TranslationCatalog({ builtInDirectory, customDirectory: directory })
  const german = catalog.get('de')
  assert.equal(german.locale, 'de')
  assert.equal(german.messages['app.title'], 'Benachrichtigungszentrale')
  assert.match(catalog.errors[0].message, /HTML is not permitted/)
})

test('ignores unknown keys and entries with incompatible placeholders', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'notification-engine-i18n-'))
  fs.writeFileSync(path.join(directory, 'nl.json'), JSON.stringify({ schemaVersion: 1, locale: 'nl', name: 'Nederlands', messages: {
    'app.title': 'Alarmcentrum',
    'app.summary': '{alarm} alarmen',
    'unknown.custom': 'ignored'
  } }))
  const catalog = new TranslationCatalog({ builtInDirectory, customDirectory: directory })
  const englishSummary = catalog.get('en').messages['app.summary']
  const dutch = catalog.get('nl')
  assert.equal(dutch.messages['app.title'], 'Alarmcentrum')
  assert.equal(dutch.messages['app.summary'], englishSummary)
  assert.equal(dutch.messages['unknown.custom'], undefined)
  assert.match(catalog.errors[0].message, /placeholders do not match/)
})

test('normalizes supported locale spellings and rejects paths', () => {
  assert.equal(normalizeLocale('de_de'), 'de-DE')
  assert.equal(normalizeLocale('../../etc/passwd'), 'en')
})
