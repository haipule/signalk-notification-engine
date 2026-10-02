'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')

const AudioRepeatPlan = require('../lib/audio-repeat-plan')

test('permits exactly the configured number of finite starts with their delay', () => {
  const plan = new AudioRepeatPlan(3, 2)

  assert.equal(plan.startAttempt(), 1)
  assert.equal(plan.hasNext(), true)
  assert.equal(plan.nextDelayMs(), 2000)
  assert.equal(plan.startAttempt(), 2)
  assert.equal(plan.hasNext(), true)
  assert.equal(plan.nextDelayMs(), 2000)
  assert.equal(plan.startAttempt(), 3)
  assert.equal(plan.hasNext(), false)
  assert.equal(plan.nextDelayMs(), null)
})

test('keeps a zero-count loop open and validates its boundary', () => {
  const plan = new AudioRepeatPlan(0)

  for (let index = 0; index < 100; index += 1) {
    plan.startAttempt()
    assert.equal(plan.hasNext(), true)
  }

  assert.throws(() => new AudioRepeatPlan(-1), /integer from 0 to 99/)
  assert.throws(() => new AudioRepeatPlan(100), /integer from 0 to 99/)
  assert.throws(() => new AudioRepeatPlan(3, 6), /integer from 0 to 5/)
})
