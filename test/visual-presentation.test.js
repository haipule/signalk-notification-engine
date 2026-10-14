'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { attentionPresentation, tablePresentationVisible } = require('../public/visual-presentation')

const visual = overrides => ({
  state: 'emergency', method: ['visual', 'sound'], status: { acknowledged: false }, ...overrides
})

test('renders banner policy as an in-centre banner presentation', () => {
  assert.equal(attentionPresentation(visual({ state: 'warn' }), { display: 'banner' }), 'banner')
})

test('keeps unknown states visible unless an explicit local policy hides them', () => {
  assert.equal(tablePresentationVisible({ state: 'foreign-state', policy: {} }), true)
  assert.equal(tablePresentationVisible({ state: 'foreign-state', policy: { visible: false } }), false)
})

test('permits configured visual treatment for lower and foreign states', () => {
  assert.equal(attentionPresentation(visual({ state: 'normal' }), { display: 'banner' }), 'banner')
  assert.equal(attentionPresentation(visual({ state: 'foreign-state' }), { display: 'overlay' }), 'overlay')
})

test('table visibility does not suppress a configured banner', () => {
  assert.equal(attentionPresentation(visual({ state: 'alert' }), { display: 'banner' }, true), 'banner')
})

test('renders an unacknowledged emergency overlay and calms it after acknowledge', () => {
  assert.equal(attentionPresentation(visual(), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ status: { acknowledged: true } }), { display: 'overlay' }), null)
})

test('explicit local attention presentation is independent of producer methods', () => {
  assert.equal(attentionPresentation(visual({ method: ['visual', 'sound'] }), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ method: ['sound'] }), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ method: [] }), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ method: undefined }), { display: 'overlay' }), 'overlay')
})

test('only overlay is viewport-fixed while the banner container stays in the centre flow', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8')
  assert.match(css, /#visual-alerts\s*\{[^}]*position:\s*relative/)
  assert.match(css, /\.visual-overlay\s*\{[^}]*position:\s*fixed/)
})
