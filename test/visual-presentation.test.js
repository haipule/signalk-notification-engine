'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { attentionPresentation } = require('../public/visual-presentation')

const visual = overrides => ({
  state: 'emergency', method: ['visual', 'sound'], status: { acknowledged: false }, ...overrides
})

test('renders banner policy as an in-centre banner presentation', () => {
  assert.equal(attentionPresentation(visual({ state: 'warn' }), { display: 'banner' }), 'banner')
})

test('table visibility does not suppress a configured banner', () => {
  assert.equal(attentionPresentation(visual({ state: 'alert' }), { display: 'banner' }, true), 'banner')
})

test('renders an unacknowledged emergency overlay and calms it after acknowledge', () => {
  assert.equal(attentionPresentation(visual(), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ status: { acknowledged: true } }), { display: 'overlay' }), null)
})

test('attention presentation does not alter or inspect audio methods beyond requiring visual', () => {
  assert.equal(attentionPresentation(visual({ method: ['visual', 'sound'] }), { display: 'overlay' }), 'overlay')
  assert.equal(attentionPresentation(visual({ method: ['sound'] }), { display: 'overlay' }), null)
})

test('only overlay is viewport-fixed while the banner container stays in the centre flow', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8')
  assert.match(css, /#visual-alerts\s*\{[^}]*position:\s*relative/)
  assert.match(css, /\.visual-overlay\s*\{[^}]*position:\s*fixed/)
})
