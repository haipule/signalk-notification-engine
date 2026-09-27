'use strict'

const { normalizeSource } = require('./notification-source')

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

/**
 * Merge snapshots from the data model and the managed notification API.
 * Some Signal K versions return the same notification from the managed API
 * without its data-model `$source`; never let that erase a known source.
 */
function mergeSnapshots(...snapshots) {
  const merged = {}
  for (const snapshot of snapshots) {
    for (const [id, notification] of Object.entries(snapshot || {})) {
      const previous = merged[id]
      merged[id] = {
        ...previous,
        ...notification,
        path: notification.path || previous?.path || '',
        // Keep the first authoritative source. Later API/managed views may
        // describe the same id without the producer source, or with a
        // registry/source value belonging to a different view.
        source: previous?.source || normalizeSource(notification.source),
        value: notification.value || previous?.value || {}
      }
    }
  }
  return merged
}

function visit(node, path, snapshot) {
  if (!node || typeof node !== 'object') return
  const value = node.value && typeof node.value === 'object' && typeof node.value.state === 'string'
    ? node.value
    : typeof node.state === 'string'
      ? node
      : null
  if (value) {
    const id = value.id || path
    snapshot[id] = {
      path,
      // The notification handler may stamp the outer node with its own
      // source (for example `self.notificationhandler`). Prefer the source
      // carried by the notification payload, which identifies the producer
      // that raised the original condition.
      source: normalizeSource(value.data?.source || value.source || value.$source || node.source || node.$source),
      value
    }
    return
  }
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue
    visit(child, `${path}.${key}`, snapshot)
  }
}

module.exports = { fromDataModel, mergeSnapshots }
