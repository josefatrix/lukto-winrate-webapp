import test from 'node:test'
import assert from 'node:assert/strict'

import { computeDraftLinks, duelKey, pairKey } from '../src/utils/matchHistory.js'

const match = (teamWhite, teamBlack, winner, id = 'm1') => ({ id, teamWhite, teamBlack, winner })

test('pairKey no depende del orden y duelKey sí', () => {
  assert.equal(pairKey('b', 'a'), pairKey('a', 'b'))
  assert.notEqual(duelKey('a', 'b'), duelKey('b', 'a'))
})

test('los compañeros acumulan partidos y victorias juntos', () => {
  const { teammatePairs } = computeDraftLinks([
    match(['a', 'b'], ['c', 'd'], 'white'),
    match(['a', 'b'], ['c', 'd'], 'black', 'm2'),
  ])
  assert.deepEqual(teammatePairs[pairKey('a', 'b')], { games: 2, wins: 1 })
  assert.deepEqual(teammatePairs[pairKey('c', 'd')], { games: 2, wins: 1 })
})

test('los duelos cuentan desde los dos lados', () => {
  const { duelStats } = computeDraftLinks([match(['a'], ['b'], 'white')])
  assert.deepEqual(duelStats[duelKey('a', 'b')], { games: 1, wins: 1 })
  assert.deepEqual(duelStats[duelKey('b', 'a')], { games: 1, wins: 0 })
})

test('los empates y los partidos sin resultado no cuentan', () => {
  const { teammatePairs, duelStats } = computeDraftLinks([
    match(['a', 'b'], ['c'], 'tie'),
    match(['a', 'b'], ['c'], undefined, 'm2'),
    match(['a', 'b'], ['c'], '', 'm3'),
  ])
  assert.deepEqual(teammatePairs, {})
  assert.deepEqual(duelStats, {})
})

test('un partido sin equipos no rompe nada', () => {
  const { teammatePairs } = computeDraftLinks([
    { id: 'm1', winner: 'white' },
    { id: 'm2', teamWhite: ['a'], winner: 'black' },
  ])
  assert.deepEqual(teammatePairs, {})
})

test('una lista vacía devuelve mapas vacíos', () => {
  assert.deepEqual(computeDraftLinks([]), { teammatePairs: {}, duelStats: {} })
  assert.deepEqual(computeDraftLinks(), { teammatePairs: {}, duelStats: {} })
})
