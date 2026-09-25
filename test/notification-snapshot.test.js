'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const { fromDataModel, mergeSnapshots } = require('../lib/notification-snapshot')

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

test('preserves a known data-model source when a later snapshot omits it', () => {
  const merged = mergeSnapshots(
    { 'alarm-1': { path: 'notifications.navigation.anchor', source: { label: 'hoekens-anchor-alarm' }, value: { state: 'alarm' } } },
    { 'alarm-1': { path: 'notifications.navigation.anchor', source: null, value: { state: 'alarm', message: 'Dragging' } } }
  )

  assert.deepEqual(merged['alarm-1'].source, { label: 'hoekens-anchor-alarm' })
  assert.equal(merged['alarm-1'].value.message, 'Dragging')
})

test('does not replace a known source with a later view source for the same id', () => {
  const merged = mergeSnapshots(
    { 'alarm-1': { path: 'notifications.environment.bilgeWater.port', source: { label: 'notification-engine' }, value: { state: 'alarm' } } },
    { 'alarm-1': { path: 'notifications.environment.bilgeWater.port', source: { label: 'espWeather.XX' }, value: { state: 'alarm', message: 'Sensor fault' } } }
  )

  assert.equal(merged['alarm-1'].source.label, 'notification-engine')
  assert.equal(merged['alarm-1'].value.message, 'Sensor fault')
})

test('normalizes alternate source shapes from the data model', () => {
  const snapshot = fromDataModel({
    propulsion: {
      stbdEngine: {
        transmission: {
          oilTemperature: {
            value: { id: 'engine-1', state: 'warn', $source: 'self.notificationhandler' }
          }
        }
      }
    }
  })

  assert.deepEqual(snapshot['engine-1'].source, { label: 'self.notificationhandler' })
})

test('prefers the original producer source over the notification handler source', () => {
  const snapshot = fromDataModel({
    propulsion: {
      portEngine: {
        transmission: {
          oilTemperature: {
            $source: 'self.notificationhandler',
            value: {
              id: 'oil-1',
              state: 'normal',
              data: { source: 'engineroomPort.XX' }
            }
          }
        }
      }
    }
  })

  assert.deepEqual(snapshot['oil-1'].source, { label: 'engineroomPort.XX' })
})
