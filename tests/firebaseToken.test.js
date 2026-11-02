import test from 'node:test'
import assert from 'node:assert/strict'

import { AUDIENCE, ISSUER, JWKS_URL, claimsFrom } from '../api/_lib/firebaseToken.js'

test('el emisor y la audiencia corresponden al proyecto', () => {
  assert.equal(AUDIENCE, 'lukto-tracker')
  assert.equal(ISSUER, 'https://securetoken.google.com/lukto-tracker')
  assert.match(JWKS_URL, /securetoken@system\.gserviceaccount\.com$/)
})

test('claimsFrom saca uid, email y si está verificado', () => {
  assert.deepEqual(
    claimsFrom({ sub: 'uid-1', email: 'A@Example.com', email_verified: true }),
    { uid: 'uid-1', email: 'A@Example.com', email_verified: true }
  )
})

test('claimsFrom marca como no verificado cualquier cosa que no sea true', () => {
  for (const value of ['true', 1, undefined, null]) {
    assert.equal(claimsFrom({ sub: 'uid-1', email_verified: value }).email_verified, false)
  }
})

test('un token sin sub no sirve', () => {
  for (const payload of [{}, { sub: '' }, { sub: '   ' }, null]) {
    assert.throws(() => claimsFrom(payload), /sub/i)
  }
})
