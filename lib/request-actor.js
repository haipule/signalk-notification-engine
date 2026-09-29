'use strict'

/** Return the first non-empty identity exposed directly by Signal K. */
function directActor(request) {
  const user = request?.user
  if (typeof user === 'string' && user) return user
  for (const value of [request?.userId, user?.username, user?.name, user?.id, request?.auth?.user, request?.auth?.username]) {
    if (typeof value === 'string' && value) return value
  }
  return null
}

/**
 * Read the identity claim from Signal K's already-authorized session cookie.
 *
 * This function does not authenticate or verify the token. It may only be used
 * after Signal K's readwrite router middleware has accepted the request; that
 * middleware remains the authority for the signed session credential.
 */
function actorFromAuthorizedCookie(request) {
  const cookieHeader = request?.headers?.cookie
  if (typeof cookieHeader !== 'string') return null
  const encoded = cookieHeader.split(';').map(value => value.trim()).find(value => value.startsWith('JAUTHENTICATION='))?.slice('JAUTHENTICATION='.length)
  if (!encoded) return null
  try {
    const token = decodeURIComponent(encoded)
    const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8'))
    for (const value of [payload.id, payload.sub, payload.username]) {
      if (typeof value === 'string' && value) return value
    }
  } catch (_) {
    return null
  }
  return null
}

/** Extract the authenticated Signal K identity without inventing a user. */
function requestActor(request) {
  return directActor(request) || actorFromAuthorizedCookie(request) || 'authenticated-user-unavailable'
}

module.exports = requestActor
