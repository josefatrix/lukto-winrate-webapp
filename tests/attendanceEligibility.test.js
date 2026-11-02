import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getAttendanceUnavailableReason,
  shouldSubscribeToAttendance,
} from '../src/utils/attendanceEligibility.js'

const futureMatch = {
  id: 'match-1',
  kickoffAt: { seconds: 2_000 },
}

test('attendance listener eligibility requires a linked user and an open future match', () => {
  const now = 1_000_000

  assert.equal(
    shouldSubscribeToAttendance({
      match: futureMatch,
      uid: 'user-1',
      playerId: 'player-1',
      now,
    }),
    true
  )
  assert.equal(
    shouldSubscribeToAttendance({
      match: futureMatch,
      uid: '',
      playerId: 'player-1',
      now,
    }),
    false
  )
  assert.equal(
    shouldSubscribeToAttendance({
      match: futureMatch,
      uid: 'user-1',
      playerId: '',
      now,
    }),
    false
  )
})

test('attendance listener eligibility rejects completed, closed, expired, and unsafe matches', () => {
  const now = 1_000_000
  const linked = { uid: 'user-1', playerId: 'player-1', now }

  assert.equal(
    shouldSubscribeToAttendance({
      match: { ...futureMatch, winner: 'white' },
      ...linked,
    }),
    false
  )
  assert.equal(
    shouldSubscribeToAttendance({
      match: { ...futureMatch, scoreWhite: 2, scoreBlack: 1 },
      ...linked,
    }),
    false
  )
  assert.equal(
    shouldSubscribeToAttendance({
      match: { ...futureMatch, kickoffAt: { seconds: 900 } },
      ...linked,
    }),
    false
  )
  assert.equal(
    shouldSubscribeToAttendance({
      match: { ...futureMatch, id: 'bad/match' },
      ...linked,
    }),
    false
  )
})

test('attendance unavailable reason stays user-facing for disabled states', () => {
  assert.equal(
    getAttendanceUnavailableReason({ id: 'match-1', winner: 'black' }, 1_000_000),
    'La confirmación de asistencia está cerrada para este partido.'
  )
  assert.equal(
    getAttendanceUnavailableReason({ id: 'match-1' }, 1_000_000),
    'Pide a un administrador que guarde la hora de inicio para habilitar las respuestas.'
  )
})
