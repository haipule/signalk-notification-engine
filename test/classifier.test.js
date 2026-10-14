'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const classify = require('../lib/classifier')

test('classifies NOAA hurricane notifications as weather', () => {
  assert.equal(classify({ path: 'notifications.noaaHurricane.nearest' }), 'WEATHER')
})

test('classifies environment notifications from their structured path', () => {
  assert.equal(classify({ path: 'notifications.environment.bilgeWater.stbd' }), 'ENVIRONMENT')
  assert.equal(classify({ path: 'notifications.environment.bilgeWater.port' }), 'ENVIRONMENT')
})

test('keeps unknown notification paths as other', () => {
  assert.equal(classify({ path: 'notifications.custom.example' }), 'OTHER')
})

test('allows a configured path rule to override automatic classification', () => {
  const configured = classify.withOverrides([
    { pathPrefix: 'notifications.noaaHurricane.', category: 'OTHER' }
  ])
  assert.equal(configured({ path: 'notifications.noaaHurricane.nearest' }), 'OTHER')
})
