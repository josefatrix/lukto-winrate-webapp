import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createMatchCalendar,
  deriveAttendanceEntries,
  getMatchCapacity,
  getMatchStartDate,
  getRatingDeadline,
  getRatingProgress,
  isPredictionOpen,
  isSafeFirestoreId,
  isVotingOpen,
  shouldWriteAttendanceResponse,
  updateAttendance,
} from './matchday.js'

test('capacity honors explicit capacity, match format, and stored team size', () => {
  assert.equal(getMatchCapacity({ capacity: 14, matchFormat: '5v5', teamSize: 5 }), 14)
  assert.equal(getMatchCapacity({ matchFormat: '5v5' }), 10)
  assert.equal(getMatchCapacity({ teamSize: 7 }), 14)
})

test('kickoff parsing uses Colombia offset by default and honors explicit offsets', () => {
  assert.equal(
    getMatchStartDate({ date: '2026-09-08', time: '18:30' }).toISOString(),
    '2026-09-08T23:30:00.000Z'
  )
  assert.equal(
    getMatchStartDate({ date: '2026-09-08', time: '18:30:15', utcOffset: '-04:00' }).toISOString(),
    '2026-09-08T22:30:15.000Z'
  )
})

test('kickoff parsing rejects invalid dates, times, and offsets', () => {
  assert.equal(getMatchStartDate({ date: '2026-09-08', time: '25:00' }), null)
  assert.equal(getMatchStartDate({ date: '2026-02-31', time: '18:00' }), null)
  assert.equal(getMatchStartDate({ date: '2026-09-08', time: '18:00', utcOffset: '-5' }), null)
})

test('firestore document IDs reject empty and path-like values', () => {
  assert.equal(isSafeFirestoreId('match-123'), true)
  assert.equal(isSafeFirestoreId(' player-a '), true)
  assert.equal(isSafeFirestoreId('matches/match-123'), false)
  assert.equal(isSafeFirestoreId(''), false)
  assert.equal(isSafeFirestoreId(null), false)
})

test('capacity overflow queues in order and a decline promotes the first waiting player', () => {
  let rows = updateAttendance({}, 'a', 'u1', 'confirmed', 1, 100)
  rows = updateAttendance(rows, 'b', 'u2', 'confirmed', 1, 200)
  rows = updateAttendance(rows, 'c', 'u3', 'confirmed', 1, 300)
  assert.equal(rows.b.status, 'waitlisted')
  rows = updateAttendance(rows, 'a', 'u1', 'declined', 1, 400)
  assert.equal(rows.b.status, 'confirmed')
  assert.equal(rows.c.status, 'waitlisted')
  assert.equal(rows.b.uid, 'u2')
})

test('declined player rejoining a full match goes to the end of the queue', () => {
  let rows = updateAttendance({}, 'a', 'u1', 'confirmed', 2, 100)
  rows = updateAttendance(rows, 'b', 'u2', 'confirmed', 2, 200)
  rows = updateAttendance(rows, 'c', 'u3', 'confirmed', 2, 300)
  rows = updateAttendance(rows, 'b', 'u2', 'declined', 2, 400)
  rows = updateAttendance(rows, 'b', 'u2', 'confirmed', 2, 500)

  assert.equal(rows.a.status, 'confirmed')
  assert.equal(rows.c.status, 'confirmed')
  assert.equal(rows.b.status, 'waitlisted')
  assert.equal(rows.b.requestedAt, 500)
})

test('repeat requests preserve queue priority and ownership cannot be replaced', () => {
  const rows = updateAttendance({}, 'a', 'u1', 'confirmed', 1, 100)
  assert.equal(updateAttendance(rows, 'a', 'u1', 'confirmed', 1, 200).a.requestedAt, 100)
  assert.throws(() => updateAttendance(rows, 'a', 'u2', 'declined', 1), /another account/)
})

test('attendance response docs derive confirmed and waitlisted entries by timestamp', () => {
  assert.deepEqual(
    deriveAttendanceEntries(
      [
        { uid: 'u3', playerId: 'c', intent: 'confirmed', updatedAt: { seconds: 300 } },
        { uid: 'u1', playerId: 'a', intent: 'confirmed', updatedAt: { seconds: 100 } },
        { uid: 'u2', playerId: 'b', intent: 'confirmed', updatedAt: { seconds: 200 } },
        { uid: 'u4', playerId: 'd', intent: 'declined', updatedAt: { seconds: 50 } },
      ],
      2
    ),
    {
      a: {
        playerId: 'a',
        uid: 'u1',
        status: 'confirmed',
        requestedAt: 100000,
        updatedAt: 100000,
      },
      b: {
        playerId: 'b',
        uid: 'u2',
        status: 'confirmed',
        requestedAt: 200000,
        updatedAt: 200000,
      },
      c: {
        playerId: 'c',
        uid: 'u3',
        status: 'waitlisted',
        requestedAt: 300000,
        updatedAt: 300000,
      },
      d: {
        playerId: 'd',
        uid: 'u4',
        status: 'declined',
        requestedAt: 50000,
        updatedAt: 50000,
      },
    }
  )
})

test('attendance derivation ignores malformed response docs and breaks ties deterministically', () => {
  assert.deepEqual(
    deriveAttendanceEntries(
      [
        { uid: 'u2', playerId: 'b', intent: 'confirmed', updatedAt: 100 },
        { uid: 'u1', playerId: 'a', intent: 'confirmed', updatedAt: 100 },
        { uid: 'u3', playerId: 'c', intent: 'maybe', updatedAt: 10 },
        { uid: 'u4', playerId: 'bad/id', intent: 'confirmed', updatedAt: 20 },
      ],
      1
    ),
    {
      a: { playerId: 'a', uid: 'u1', status: 'confirmed', requestedAt: 100, updatedAt: 100 },
      b: { playerId: 'b', uid: 'u2', status: 'waitlisted', requestedAt: 100, updatedAt: 100 },
    }
  )
})

test('attendance response writes no-op only for repeated same player and intent', () => {
  assert.equal(
    shouldWriteAttendanceResponse({ playerId: 'a', intent: 'confirmed' }, 'a', 'confirmed'),
    false
  )
  assert.equal(
    shouldWriteAttendanceResponse({ playerId: 'a', intent: 'declined' }, 'a', 'confirmed'),
    true
  )
  assert.equal(
    shouldWriteAttendanceResponse({ playerId: 'old', intent: 'confirmed' }, 'a', 'confirmed'),
    true
  )
})
test('deadlines honor explicit timestamp and preserve legacy open voting', () => {
  const match = { date: '2026-09-08', time: '18:00', winner: 'white', ratingsOpen: true }
  assert.ok(getRatingDeadline(match))
  assert.equal(isVotingOpen(match, Date.now() + 1e12), true)
  assert.equal(
    isVotingOpen({ ...match, ratingDeadline: '2026-09-10T00:00:00Z' }, Date.parse('2026-09-11')),
    false
  )
})
test('rating progress counts distinct eligible targets, not duplicate documents', () => {
  const match = { id: 'm', teamWhite: ['a', 'b'], teamBlack: ['c'] }
  const ratings = {
    b: [
      { matchId: 'm', ratedBy: 'a' },
      { matchId: 'm', ratedBy: 'a' },
    ],
    x: [{ matchId: 'm', ratedBy: 'a' }],
  }
  assert.deepEqual(getRatingProgress(match, ratings, 'a'), { completed: 1, total: 2 })
})
test('calendar escapes text and includes UTC dates and an alarm', () => {
  const ics = createMatchCalendar({
    id: 'm',
    date: '2026-09-08',
    time: '18:00',
    venue: 'Pitch;One, Main\nGate',
  })
  assert.match(ics, /BEGIN:VCALENDAR\r\n/)
  assert.match(ics, /LOCATION:Pitch\\;One\\, Main\\nGate/)
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/)
  assert.match(ics, /TRIGGER:-PT30M/)
})

test('predictions require canonical kickoff, unresolved scores and more than ten minutes', () => {
  const now = 1000000
  const match = { kickoffAt: { seconds: 1601 } }
  assert.equal(isPredictionOpen(match, now), true)
  assert.equal(isPredictionOpen({ kickoffAt: { seconds: 1600 } }, now), false)
  assert.equal(isPredictionOpen({ date: '2099-01-01', time: '18:00' }, now), false)
  assert.equal(isPredictionOpen({ ...match, winner: 'white' }, now), false)
  assert.equal(isPredictionOpen({ ...match, status: 'closed' }, now), false)
  assert.equal(isPredictionOpen({ ...match, scoreWhite: 0 }, now), false)
})
