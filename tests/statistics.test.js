import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateWinRate, finiteOr, getCurrentStreak, getStreakSummary, getMatchMvp, computeStatsFromMatches } from '../src/utils/statistics.js'

const match = (id, winner, date = `2026-08-${String(id).padStart(2, '0')}`, time = '') => ({ id: String(id), date, time, winner, teamWhite: ['a'], teamBlack: ['b'] })
const votes = (id, scores) => scores.map((score, index) => ({ matchId: String(id), score, raterId: `v${index}` }))

test('draws count as half a win in the completed-match denominator', () => {
  assert.equal(calculateWinRate(6, 1, 7), 650 / 7)
  assert.equal(calculateWinRate(0, 1, 1), 50)
  assert.equal(calculateWinRate(0, 0, 0), 0)
})
test('balance defaults preserve numeric and string zero but reject missing and non-finite values', () => {
  for (const value of [0, '0']) assert.equal(finiteOr(value, 50), 0)
  for (const value of [null, undefined, '', NaN, Infinity, 'invalid']) assert.equal(finiteOr(value, 50), 50)
})
test('current streak stops at the first different completed result and ignores scheduled matches', () => {
  const matches = [match(1, 'black'), match(2, 'white'), match(3, 'black'), match(4, 'black'), match(5, '')]
  assert.deepEqual(getCurrentStreak(matches, 'a'), { type: 'L', count: 2 })
  assert.deepEqual(getCurrentStreak(matches, 'absent'), { type: null, count: 0 })
})
test('ties end win streaks while remaining part of unbeaten streaks', () => {
  const matches = [match(1, 'white'), match(2, 'white'), match(3, 'tie'), match(4, 'white')]
  assert.deepEqual(getStreakSummary(matches, 'a'), { current: { type: 'W', count: 1 }, bestWinStreak: 2, bestUnbeatenStreak: 4 })
  assert.deepEqual(getCurrentStreak(matches.slice(0, 3), 'a'), { type: 'D', count: 1 })
})
test('equal dates use match time then ID for deterministic chronology without mutating input', () => {
  const matches = [match(3, 'black', '2026-08-01', '18:00'), match(2, 'white', '2026-08-01', '18:00'), match(1, 'white', '2026-08-01', '09:00')]
  assert.deepEqual(getCurrentStreak(matches, 'a'), { type: 'L', count: 1 })
  assert.deepEqual(matches.map(m => m.id), ['3', '2', '1'])
})
test('MVP needs the configured per-player minimum and a completed match', () => {
  const ratings = { a: votes(1, [10]), b: votes(1, [8, 8, 8, 8]) }
  assert.equal(getMatchMvp(match(1, 'white'), ratings).playerId, 'b')
  assert.equal(getMatchMvp(match(1, 'white'), ratings, 1).playerId, 'a')
  assert.equal(getMatchMvp(match(1, ''), ratings), null)
  assert.equal(getMatchMvp(match(1, 'white'), ratings, 5), null)
})
test('MVP shares tied awards deterministically and ignores invalid scores', () => {
  const ratings = { a: votes(1, [8, 8, 8, 8, NaN]), b: votes(1, [8, 8, 8, 8]) }
  assert.deepEqual(getMatchMvp(match(1, 'tie'), ratings), { playerId: 'a', avgRating: 8, votes: 4, tiedPlayerIds: ['a', 'b'] })
})
test('rankings exclude scheduled matches and share eligible MVP awards', () => {
  const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
  const ratings = { a: votes(1, [8, 8]), b: votes(1, [8, 8]) }
  const stats = computeStatsFromMatches(players, [match(1, 'tie'), match(2, '')], ratings, { mvpMinVotes: 2 })
  for (const player of stats) {
    assert.equal(player.played, 1)
    assert.equal(player.winRate, 50)
    assert.equal(player.mvps, 1)
  }
  assert.equal(computeStatsFromMatches(players, [match(2, '')], ratings).length, 0)
})
test('scoped rankings exclude ratings outside the selected season', () => {
  const ratings = { a: [...votes(1, [0]), ...votes(2, [10])] }
  const [player] = computeStatsFromMatches([{ id: 'a', name: 'A' }], [match(1, 'black')], ratings, { scopeRatingsToMatches: true })
  assert.equal(player.avgRating, '0.0')
  assert.equal(player.winRate, 0)
})
