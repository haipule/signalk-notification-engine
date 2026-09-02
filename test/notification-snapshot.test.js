'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { fromDataModel } = require('../lib/notification-snapshot')

test('converts nested data-model notifications to a snapshot', () => {
  const snapshot = fromDataModel({
    navigation: {
      gnss: {
        headingUnavailable: {
          value: { id: 'heading-1', state: 'warn', message: 'Heading unavailable' },
          $source: 'gnssOffsetCorrector'
        }
      }
    }
  })

  assert.deepEqual(snapshot, {
    'heading-1': {
      path: 'notifications.navigation.gnss.headingUnavailable',
      source: { label: 'gnssOffsetCorrector' },
      value: { id: 'heading-1', state: 'warn', message: 'Heading unavailable' }
    }
  })
})

test('also accepts direct notification values from the in-process data model', () => {
  const snapshot = fromDataModel({
    server: { newVersion: { id: 'version-1', state: 'normal', message: 'Update available' } }
  })

  assert.equal(snapshot['version-1'].path, 'notifications.server.newVersion')
  assert.equal(snapshot['version-1'].value.state, 'normal')
})
