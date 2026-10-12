'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const createPlugin = require('../index')

test('exposes per-file external task grants without a global enable switch', () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const schema = plugin.schema.properties.externalTasks

  assert.equal(schema.type, 'object')
  assert.equal(schema.properties.enabled, undefined)
  assert.equal(schema.properties.maxConcurrent.minimum, 1)
  assert.equal(schema.properties.maxConcurrent.maximum, 4)
  assert.equal(schema.properties.allowedExecutables.items.properties.enabled.default, false)
  assert.equal(schema.properties.allowedExecutables.items.properties.path.pattern, '^/.*$')
  assert.equal(schema.properties.allowedExecutables.items.properties.timeoutSeconds.maximum, 60)
  assert.equal(schema.properties.allowedExecutables.items.properties.allowNormal.default, false)
})

test('keeps both sound tests beside the audio configuration', () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const fields = Object.keys(plugin.schema.properties)

  assert.ok(fields.indexOf('testTonePath') > fields.indexOf('audioDevice'))
  assert.ok(fields.indexOf('playTestTone') > fields.indexOf('testTonePath'))
  assert.ok(fields.indexOf('alarmSoundTest') > fields.indexOf('playTestTone'))
  assert.ok(fields.indexOf('alarmSoundTest') < fields.indexOf('externalTasks'))
})

test('does not expose superseded configuration-driven history deletion', () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const fields = plugin.schema.properties

  for (const name of ['clearHistoryOnStart', 'clearHistoryPath', 'clearHistoryPathOnSave', 'clearHistoryOccurrenceId']) {
    assert.equal(fields[name], undefined)
  }
})
