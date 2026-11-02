import assert from 'node:assert/strict'
import test from 'node:test'

import { getGooglePhoto, getLinkedPlayerPhoto } from '../src/utils/profilePhoto.js'

test('Google provider photo takes priority over generic account photo', () => {
  assert.equal(
    getGooglePhoto({
      photoURL: 'old',
      providerData: [{ providerId: 'google.com', photoURL: 'google' }],
    }),
    'google'
  )
  assert.equal(getGooglePhoto({ photoURL: 'fallback' }), 'fallback')
  assert.equal(getGooglePhoto(null), null)
})
test('player photos prefer current Google account, then newest photographed link', () => {
  const links = {
    old: { playerId: 'p', userPhoto: 'old', updatedAt: '2025-01-01' },
    empty: { playerId: 'p', updatedAt: '2027-01-01' },
    newer: { playerId: 'p', userPhoto: 'new', updatedAt: '2026-01-01' },
  }
  assert.equal(getLinkedPlayerPhoto('p', links), 'new')
  assert.equal(getLinkedPlayerPhoto('p', links, { uid: 'old', photoURL: 'live' }), 'live')
  assert.equal(getLinkedPlayerPhoto('unlinked', links), null)
  assert.equal(links.old.userPhoto, 'old')
})
