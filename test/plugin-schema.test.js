'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const createPlugin = require('../index')

async function schemaFor(plugin) {
  return typeof plugin.schema === 'function' ? plugin.schema() : plugin.schema
}

test('exposes a dynamic Rule Builder flow selector without inventing a default', async () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const field = (await schemaFor(plugin)).properties.ruleBuilderFlow

  assert.equal(field.title, 'Rule Builder Flow')
  assert.deepEqual(field.oneOf, [])
  assert.equal(field.default, undefined)
})

test('exposes per-file external task grants without a global enable switch', async () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const schema = (await schemaFor(plugin)).properties.externalTasks

  assert.equal(schema.type, 'object')
  assert.equal(schema.properties.enabled, undefined)
  assert.equal(schema.properties.maxConcurrent.minimum, 1)
  assert.equal(schema.properties.maxConcurrent.maximum, 4)
  assert.equal(schema.properties.allowedExecutables.items.properties.enabled.default, false)
  assert.equal(schema.properties.allowedExecutables.items.properties.path.pattern, '^/.*$')
  assert.equal(schema.properties.allowedExecutables.items.properties.timeoutSeconds.maximum, 60)
  assert.equal(schema.properties.allowedExecutables.items.properties.allowNormal.default, false)
})

test('keeps both sound tests beside the audio configuration', async () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const fields = Object.keys((await schemaFor(plugin)).properties)

  assert.ok(fields.indexOf('testTonePath') > fields.indexOf('audioDevice'))
  assert.ok(fields.indexOf('playTestTone') > fields.indexOf('testTonePath'))
  assert.ok(fields.indexOf('alarmSoundTest') > fields.indexOf('playTestTone'))
  assert.ok(fields.indexOf('alarmSoundTest') < fields.indexOf('externalTasks'))
})

test('does not expose superseded configuration-driven history deletion', async () => {
  const plugin = createPlugin({ getDataDirPath: () => null })
  const fields = (await schemaFor(plugin)).properties

  for (const name of ['clearHistoryOnStart', 'clearHistoryPath', 'clearHistoryPathOnSave', 'clearHistoryOccurrenceId']) {
    assert.equal(fields[name], undefined)
  }
})
