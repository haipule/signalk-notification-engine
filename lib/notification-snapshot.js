'use strict'

/**
 * Convert the `notifications` subtree of Signal K's data model to the same
 * record shape returned by `app.notifications.list()`.
 *
 * This is a read-only fallback for server/plugin startup ordering. It never
 * manufactures IDs or status flags: values are copied exactly as supplied by
 * the data model.
 */
function fromDataModel(tree, prefix = 'notifications') {
  const snapshot = {}
  visit(tree, prefix, snapshot)
  return snapshot
}

function visit(node, path, snapshot) {
  if (!node || typeof node !== 'object') return
  const value = node.value && typeof node.value === 'object' && node.value.state
    ? node.value
    : node.state
      ? node
      : null
  if (value) {
    const id = value.id || path
    snapshot[id] = {
      path,
      source: node.$source ? { label: node.$source } : null,
      value
    }
    return
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    visit(child, `${path}.${key}`, snapshot)
  }
}

module.exports = { fromDataModel }
