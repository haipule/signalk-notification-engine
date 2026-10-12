'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { migratePluginOptions } = require('../lib/plugin-options-migration')

test('removes only known superseded legacy plugin settings', () => {
  const original = {
    audioPlayer: 'aplay',
    audioDevice: 'plughw:2,0',
    alarmSoundTest: { intervalDays: 1 },
    historyLimit: 500,
    classificationRules: [{ category: 'OTHER' }],
    historyStates: ['alarm'],
    stateOrder: ['warn', 'normal'],
    soundsByState: { alarm: { mode: 'loop', repeatCount: 1 } },
    historyRules: [{ pathPrefix: 'notifications.' }],
    clearHistoryOnStart: false,
    clearHistoryPath: 'notifications.engine',
    clearHistoryPathOnSave: false,
    clearHistoryOccurrenceId: 'old-occurrence'
  }

  const result = migratePluginOptions(original)

  assert.deepEqual(result.options, {
    audioPlayer: 'aplay',
    audioDevice: 'plughw:2,0',
    alarmSoundTest: { intervalDays: 1 },
    historyLimit: 500
  })
  assert.deepEqual(result.removedFields.sort(), [
    'classificationRules',
    'clearHistoryOccurrenceId',
    'clearHistoryOnStart',
    'clearHistoryPath',
    'clearHistoryPathOnSave',
    'historyRules',
    'historyStates',
    'soundsByState',
    'stateOrder'
  ])
  assert.equal(result.changed, true)
  assert.ok(original.soundsByState)
})

test('leaves current operational and unknown options untouched', () => {
  const options = { audioDevice: 'default', criticalInputs: [], futureUnknown: true }
  const result = migratePluginOptions(options)
  assert.deepEqual(result.options, options)
  assert.equal(result.changed, false)
  assert.deepEqual(result.removedFields, [])
})
