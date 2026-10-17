'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { compareNotificationPaths, compareNotificationRows } = require('../public/table-sort')

const stateOrder = ['emergency', 'alarm', 'warn', 'alert', 'normal', 'nominal']

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

test('keeps Signal K severity primary when a newer lower-severity notification exists', () => {
  const notifications = [
    { id: 'normal-new', state: 'normal', updatedAt: '2026-10-16T12:00:00Z' },
    { id: 'warn-old', state: 'warn', updatedAt: '2026-10-16T11:00:00Z' },
    { id: 'alarm-oldest', state: 'alarm', updatedAt: '2026-10-16T10:00:00Z' }
  ]

  notifications.sort((left, right) => compareNotificationRows(left, right, {
    stateOrder,
    column: 'updated',
    direction: 'desc'
  }))

  assert.deepEqual(notifications.map(notification => notification.id), ['alarm-oldest', 'warn-old', 'normal-new'])
})

test('applies the selected column only within a state and keeps unknown states visible last', () => {
  const notifications = [
    { id: 'unknown', state: 'vendor-state', path: 'notifications.a' },
    { id: 'warn-z', state: 'warn', path: 'notifications.z' },
    { id: 'warn-a', state: 'warn', path: 'notifications.a' },
    { id: 'alert-a', state: 'alert', path: 'notifications.a' }
  ]

  notifications.sort((left, right) => compareNotificationRows(left, right, {
    stateOrder,
    column: 'notification',
    direction: 'asc'
  }))

  assert.deepEqual(notifications.map(notification => notification.id), ['warn-a', 'warn-z', 'alert-a', 'unknown'])
})
