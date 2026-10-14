'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const { withRuleBuilderFlowSelection } = require('../lib/rule-builder-flow-selection')

test('shows names as choices with the selected stable id in one read-only field', () => {
  const schema = withRuleBuilderFlowSelection({ type: 'object', properties: { audioDevice: { type: 'string' } } }, [
    { id: 'production-id', name: 'Production Rules' },
    { id: 'release-id', name: 'Release Flow' }
  ], 'production-id')

  const field = schema.properties.ruleBuilderFlow
  assert.deepEqual(field.oneOf.map(choice => choice.title), ['Production Rules', 'Release Flow'])
  assert.deepEqual(field.default, { id: 'production-id' })
  assert.equal(field.oneOf[0].properties.id.const, 'production-id')
  assert.equal(field.oneOf[0].properties.id.readOnly, true)
  assert.equal(field.oneOf[1].properties.id.const, 'release-id')
  assert.equal(schema.properties.audioDevice.type, 'string')
})

test('does not invent a selection when active tabs cannot be read', () => {
  const schema = withRuleBuilderFlowSelection({ type: 'object', properties: {} }, [], '', 'runtime unavailable')

  assert.deepEqual(schema.properties.ruleBuilderFlow.oneOf, [])
  assert.equal(schema.properties.ruleBuilderFlow.default, undefined)
  assert.match(schema.properties.ruleBuilderFlow.description, /runtime unavailable/)
})
