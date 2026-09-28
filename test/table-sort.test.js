'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { compareNotificationPaths } = require('../public/table-sort')

test('groups notification paths by their dot-delimited hierarchy', () => {
  const paths = [
    'notifications.propulsion.stbdEngine.temperature',
    'notifications.navigation.anchor',
    'notifications.propulsion.portEngine.temperature',
    'notifications.propulsion.stbdEngine.oilPressure',
    'notifications.propulsion.portEngine.oilPressure'
  ]

  assert.deepEqual(paths.sort(compareNotificationPaths), [
    'notifications.navigation.anchor',
    'notifications.propulsion.portEngine.oilPressure',
    'notifications.propulsion.portEngine.temperature',
    'notifications.propulsion.stbdEngine.oilPressure',
    'notifications.propulsion.stbdEngine.temperature'
  ])
})

test('puts a parent path before its children and compares numbers naturally', () => {
  const paths = [
    'notifications.tanks.fuel.10.level',
    'notifications.tanks.fuel',
    'notifications.tanks.fuel.2.level'
  ]

  assert.deepEqual(paths.sort(compareNotificationPaths), [
    'notifications.tanks.fuel',
    'notifications.tanks.fuel.2.level',
    'notifications.tanks.fuel.10.level'
  ])
})

test('accepts missing paths without throwing', () => {
  assert.equal(compareNotificationPaths(null, 'notifications.navigation.anchor') < 0, true)
  assert.equal(compareNotificationPaths(undefined, null), 0)
})
