import assert from 'node:assert/strict'
import test from 'node:test'
import { respondToAttendance } from './index.js'

test('attendance requires an authenticated account before accessing Firestore', async () => {
  await assert.rejects(respondToAttendance.run({ data: { matchId: 'match-1', intent: 'confirmed' } }), { code: 'unauthenticated' })
})
test('attendance rejects unsupported transitions before accessing Firestore', async () => {
  await assert.rejects(respondToAttendance.run({ auth: { uid: 'player-account' }, data: { matchId: 'match-1', intent: 'promote' } }), { code: 'invalid-argument' })
})
test('attendance rejects document paths before accessing Firestore', async () => {
  await assert.rejects(respondToAttendance.run({ auth: { uid: 'player-account' }, data: { matchId: 'matches/other', intent: 'confirmed' } }), { code: 'invalid-argument' })
})
