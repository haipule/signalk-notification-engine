'use strict'

const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const test = require('node:test')

const runtimeTextFiles = [
  'lib/audio-self-test.js',
  'public/index.html',
  'public/app.js',
  'node-red/prototype/flows-rule-editor.json'
]

const nonEnglishFragments = [
  'Alarmtontest',
  'Alarmton testen',
  'Ton nicht gehört',
  'Noch kein',
  'Technisch abgespielt',
  'Gegenmeldung',
  'Bediener',
  'Gerät',
  'Datei',
  'Abgeschlossen',
  'Rule prüfen',
  'state fehlt',
  'Farbe fehlt'
]

test('built-in runtime and UI text keeps the English baseline', () => {
  for (const relativePath of runtimeTextFiles) {
    const contents = readFileSync(join(__dirname, '..', relativePath), 'utf8')
    for (const fragment of nonEnglishFragments) {
      assert.equal(contents.includes(fragment), false, `${relativePath} contains non-English built-in text: ${fragment}`)
    }
  }
})
