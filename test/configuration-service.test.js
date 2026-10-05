'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { ConfigurationService, normalizeClearPath, normalizeHistoryRules, normalizeInfoTimeout, normalizeShortcut } = require('../lib/configuration-service')
const colors = require('../lib/visual-colors')

const service = () => new ConfigurationService({ baseDirectory: '/plugin', visualColorPool: colors })

test('normalizes state order and local presentation without changing rule meaning', () => {
  const configuration = service()
  configuration.loadColorPalette()
  assert.deepEqual(configuration.normalizeStateOrder(['warn', 'warn', 'normal', 'invalid']), ['warn', 'normal'])
  const stateColors = configuration.normalizeStateColors({ alarm: 'red', warn: '#123456' })
  assert.equal(stateColors.alarm, colors.red)
  assert.equal(stateColors.warn, '#123456')
  assert.equal(configuration.normalizeVisualRules({ warn: { display: 'overlay', color: 'blue', flash: true } }, stateColors).warn.display, 'overlay')
})

test('normalizes sounds and policies with explicit inactive audio intact', () => {
  const configuration = service()
  assert.deepEqual(configuration.normalizeSoundsByState({ warn: { active: false, file: 'custom.wav', count: 3 } }).warn, {
    active: false, file: 'custom.wav', count: 3
  })
  assert.deepEqual(configuration.normalizePolicies([{ name: 'warn', pathPrefix: 'notifications.', sound: 'warn.wav' }])[0].sound, {
    active: true, file: 'warn.wav', count: 1
  })
})

test('normalizes operational scalar and history settings', () => {
  assert.equal(normalizeInfoTimeout(9999), 3600)
  assert.equal(normalizeShortcut('I', 'x'), 'i')
  assert.equal(normalizeClearPath(' Notifications.GPS.* '), 'notifications.gps.')
  assert.deepEqual(normalizeHistoryRules([{ pathPrefix: 'Notifications.', history: false }]), [{ pathPrefix: 'notifications.', source: '', history: false }])
})
