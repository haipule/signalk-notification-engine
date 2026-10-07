'use strict'
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_RULES = []

function loadLifecycleRules(directory, onError = () => {}) {
  const filePath = directory && path.join(directory, 'lifecycle-rules.json')
  if (!filePath || !fs.existsSync(filePath)) return DEFAULT_RULES
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return Array.isArray(parsed.rules) ? parsed.rules : DEFAULT_RULES
  } catch (error) {
    onError(`Could not load lifecycle rules: ${error.message}`)
    return DEFAULT_RULES
  }
}

function endsLifecycle(rules, notification) {
  return rules.some(rule => (!rule.source || rule.source === notification.source?.label) && (!rule.path || rule.path === notification.path) && (!rule.endWhen?.state || rule.endWhen.state === notification.state) && (!rule.endWhen?.message || rule.endWhen.message === notification.message))
}

module.exports = { loadLifecycleRules, endsLifecycle }
