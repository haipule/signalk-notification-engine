'use strict'

const DEFAULT_STALE_AFTER_SECONDS = 15

/**
 * Build a read-only freshness view for configured Signal K input paths.
 * This observes producer timestamps only; it never creates a notification or
 * changes policy, permissions, or a Signal K value.
 *
 * @param {Array<object>} definitions Configured input path/source pairs.
 * @param {(path: string) => unknown} readPath Read one local Signal K leaf.
 * @param {object} options Testable clock dependency.
 * @returns {Array<object>} Stable diagnostic records for JSON serialization.
 */
function inspectInputSources(definitions, readPath, { now = () => Date.now() } = {}) {
  const checkedAtMs = now()
  return normalizeInputSources(definitions).map(definition => {
    const leaf = readPath(definition.path)
    const observedSource = normalizeSourceLabel(leaf?.$source || leaf?.source || leaf?.value?.$source || leaf?.value?.source)
    const timestamp = normalizeTimestamp(leaf?.timestamp || leaf?.value?.timestamp)
    const ageMs = timestamp ? Math.max(0, checkedAtMs - Date.parse(timestamp)) : null
    const sourceMatches = observedSource === definition.source
    const value = readValue(leaf)
    const valuePresent = value !== undefined && value !== null
    let state = 'missing'
    if (leaf !== undefined && !sourceMatches) state = 'source_mismatch'
    else if (sourceMatches && !timestamp) state = 'timestamp_missing'
    else if (sourceMatches) state = ageMs <= definition.staleAfterSeconds * 1000 ? 'fresh' : 'stale'
    return {
      name: definition.name,
      path: definition.path,
      expectedSource: definition.source,
      observedSource,
      state,
      timestamp,
      ageMs,
      staleAfterSeconds: definition.staleAfterSeconds,
      valuePresent
    }
  })
}

/** Validate and normalize configured critical input definitions. */
function normalizeInputSources(definitions) {
  if (!Array.isArray(definitions)) return []
  return definitions.map((definition, index) => {
    const name = String(definition?.name || '').trim()
    const path = String(definition?.path || '').trim()
    const source = String(definition?.source || '').trim()
    const staleAfterSeconds = definition?.staleAfterSeconds ?? DEFAULT_STALE_AFTER_SECONDS
    if (!name || !path || !source) throw new Error(`Critical input ${index + 1} requires name, path, and source`)
    if (!Number.isInteger(staleAfterSeconds) || staleAfterSeconds < 1 || staleAfterSeconds > 3600) {
      throw new Error(`Critical input ${index + 1} staleAfterSeconds must be an integer from 1 to 3600`)
    }
    return { name, path, source, staleAfterSeconds }
  })
}

function normalizeTimestamp(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null
  return new Date(value).toISOString()
}

function normalizeSourceLabel(source) {
  if (typeof source === 'string') return source.trim() || null
  if (!source || typeof source !== 'object') return null
  const label = source.label || source.$source || source.src || source.name
  return typeof label === 'string' && label.trim() ? label.trim() : null
}

function readValue(leaf) {
  return leaf && typeof leaf === 'object' && Object.prototype.hasOwnProperty.call(leaf, 'value') ? leaf.value : leaf
}

module.exports = { DEFAULT_STALE_AFTER_SECONDS, inspectInputSources, normalizeInputSources }
