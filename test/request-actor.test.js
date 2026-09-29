'use strict'

const test = require('node:test')
const assert = require('node:assert/strict')
const requestActor = require('../lib/request-actor')

function sessionCookie(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `other=value; JAUTHENTICATION=header.${body}.signature`
}

test('uses an identity attached directly by Signal K', () => {
  assert.equal(requestActor({ userId: 'operator' }), 'operator')
  assert.equal(requestActor({ user: { username: 'captain' } }), 'captain')
})

test('reads the identity from an already-authorized Signal K session cookie', () => {
  assert.equal(requestActor({ headers: { cookie: sessionCookie({ id: 'pi', iat: 123 }) } }), 'pi')
})

test('does not invent an identity from malformed credentials', () => {
  assert.equal(requestActor({ headers: { cookie: 'JAUTHENTICATION=broken' } }), 'authenticated-user-unavailable')
})
