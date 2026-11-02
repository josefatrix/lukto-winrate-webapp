import test from 'node:test'
import assert from 'node:assert/strict'

import {
  scorePlayer,
  rolePenaltyFor,
  buildGreedyTeams,
  evaluateSplit,
  pickBestSplit,
} from '../src/utils/teamBalancer.js'

const close = (actual, expected, label) =>
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    `${label}: esperaba ${expected}, recibí ${actual}`
  )

test('un jugador sin estadísticas puntúa 50', () => {
  assert.equal(scorePlayer(undefined), 50)
  assert.equal(scorePlayer(null), 50)
})

test('el puntaje usa calificación, winrate, mvps y partidos', () => {
  // 7*6 + 60*0.5 + 3*1.2 + 10*0.15
  close(scorePlayer({ avgRating: '7.0', winRate: 60, mvps: 3, played: 10 }), 77.1, 'puntaje')
})

test('el puntaje cae a los valores por defecto cuando los campos faltan', () => {
  // 5*6 + 50*0.5 + 0 + 0
  close(scorePlayer({}), 55, 'puntaje por defecto')
})

test('el puntaje topa los mvps en 10 y los partidos en 20', () => {
  const topped = scorePlayer({ avgRating: '5.0', winRate: 50, mvps: 40, played: 99 })
  const atCap = scorePlayer({ avgRating: '5.0', winRate: 50, mvps: 10, played: 20 })
  close(topped, atCap, 'topes')
})

test('un equipo con todas las líneas cubiertas no penaliza', () => {
  close(rolePenaltyFor(['portero', 'cierre', 'medio', 'delantero'], 4), 0, 'equipo completo')
})

test('un equipo sin portero penaliza más que uno completo', () => {
  const sinPortero = rolePenaltyFor(['delantero', 'cierre', 'medio', 'delantero'], 4)
  const completo = rolePenaltyFor(['portero', 'cierre', 'medio', 'delantero'], 4)
  close(sinPortero, 2.2, 'sin portero')
  assert.ok(sinPortero > completo)
})

test('la penalización depende del tamaño de equipo, no solo de las posiciones', () => {
  const positions = ['delantero', 'cierre', 'medio', 'delantero']
  const completo = rolePenaltyFor(positions, 4)
  const incompleto = rolePenaltyFor(positions, 6)
  close(completo, 2.2, 'equipo completo')
  close(incompleto, 2.2 * 0.55, 'equipo incompleto')
})

test('dos porteros en el mismo equipo penalizan el excedente', () => {
  // faltan Defensa 1.1, Medio 0.9, Delantero 0.6 = 2.6, más (2-1)*0.35
  close(rolePenaltyFor(['portero', 'portero'], 2), 2.95, 'dos porteros')
})

test('los jugadores sin posición penalizan', () => {
  const conTodas = rolePenaltyFor(['portero', 'cierre', 'medio', 'delantero'], 4)
  const unoSinPosicion = rolePenaltyFor(['portero', 'cierre', 'medio', ''], 4)
  assert.ok(unoSinPosicion > conTodas)
})

test('un equipo vacío no penaliza', () => {
  assert.equal(rolePenaltyFor([], 5), 0)
  assert.equal(rolePenaltyFor(undefined, 5), 0)
})

const scores = { a: 100, b: 90, c: 20, d: 10 }
const scoreOf = id => scores[id] ?? 50
const noPositions = () => ''

test('buildGreedyTeams reparte a todos y respeta el tamaño de equipo', () => {
  const { white, black } = buildGreedyTeams({
    order: ['a', 'b', 'c', 'd'],
    pinnedWhite: [],
    pinnedBlack: [],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
  })
  assert.equal(white.length, 2)
  assert.equal(black.length, 2)
  assert.deepEqual([...white, ...black].sort(), ['a', 'b', 'c', 'd'])
})

test('buildGreedyTeams respeta los jugadores fijados', () => {
  const { white, black } = buildGreedyTeams({
    order: ['a', 'b', 'c', 'd'],
    pinnedWhite: ['a'],
    pinnedBlack: ['b'],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
  })
  assert.ok(white.includes('a'), 'a debe quedar en blanco')
  assert.ok(black.includes('b'), 'b debe quedar en negro')
  assert.equal(white.filter(id => id === 'a').length, 1, 'a no se duplica')
})

test('buildGreedyTeams es determinista para un orden dado', () => {
  const args = {
    order: ['a', 'b', 'c', 'd'],
    pinnedWhite: [],
    pinnedBlack: [],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
  }
  assert.deepEqual(buildGreedyTeams(args), buildGreedyTeams(args))
})

test('buildGreedyTeams devuelve el puntaje acumulado de cada equipo', () => {
  const { white, black, whiteScore, blackScore } = buildGreedyTeams({
    order: ['a', 'b', 'c', 'd'],
    pinnedWhite: [],
    pinnedBlack: [],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
  })
  close(whiteScore, white.reduce((s, id) => s + scoreOf(id), 0), 'puntaje blanco')
  close(blackScore, black.reduce((s, id) => s + scoreOf(id), 0), 'puntaje negro')
})

test('evaluateSplit da el mismo número para los mismos equipos', () => {
  const args = {
    whiteIds: ['a', 'b'],
    blackIds: ['c', 'd'],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
    probability: { white: 50, black: 50 },
  }
  assert.equal(evaluateSplit(args), evaluateSplit(args))
})

test('evaluateSplit resta la diferencia de probabilidad, de poder y la penalización de roles', () => {
  // poder parejo (gapPct 0), probabilidad pareja (probGap 0),
  // dos porteros por equipo => 2.95 + 2.95 = 5.9 de penalización
  const score = evaluateSplit({
    whiteIds: ['x', 'y'],
    blackIds: ['z', 'w'],
    teamSize: 2,
    scoreOf: () => 10,
    positionOf: () => 'portero',
    probability: { white: 50, black: 50 },
  })
  close(score, 100 - 5.9 * 6, 'evaluateSplit')
})

test('evaluateSplit castiga una probabilidad desbalanceada', () => {
  const base = {
    whiteIds: ['x', 'y'],
    blackIds: ['z', 'w'],
    teamSize: 2,
    scoreOf: () => 10,
    positionOf: () => 'portero',
  }
  const parejo = evaluateSplit({ ...base, probability: { white: 50, black: 50 } })
  const desparejo = evaluateSplit({ ...base, probability: { white: 80, black: 20 } })
  close(parejo - desparejo, 60 * 0.95, 'castigo por probabilidad')
})

test('pickBestSplit con shuffle inyectado no usa Math.random', () => {
  const realRandom = Math.random
  Math.random = () => {
    throw new Error('pickBestSplit no debe usar Math.random cuando se le inyecta shuffle')
  }
  try {
    const result = pickBestSplit({
      pool: ['a', 'b', 'c', 'd'],
      pinnedWhite: [],
      pinnedBlack: [],
      teamSize: 2,
      scoreOf,
      positionOf: noPositions,
      probabilityOf: () => ({ white: 50, black: 50 }),
      iterations: 5,
      shuffle: ids => [...ids],
    })
    assert.equal(result.white.length, 2)
    assert.equal(result.black.length, 2)
    assert.equal(typeof result.score, 'number')
  } finally {
    Math.random = realRandom
  }
})

test('pickBestSplit elige el reparto con mejor evaluateSplit entre los candidatos', () => {
  // Con cuatro jugadores y dos órdenes posibles, el reparto más parejo en poder
  // es {a,d} vs {b,c}: 110 contra 110.
  const orders = [
    ['a', 'b', 'c', 'd'],
    ['a', 'd', 'b', 'c'],
  ]
  let call = 0
  const result = pickBestSplit({
    pool: ['a', 'b', 'c', 'd'],
    pinnedWhite: [],
    pinnedBlack: [],
    teamSize: 2,
    scoreOf,
    positionOf: noPositions,
    probabilityOf: () => ({ white: 50, black: 50 }),
    iterations: orders.length,
    shuffle: () => orders[call++ % orders.length],
  })
  const whitePower = result.white.reduce((s, id) => s + scoreOf(id), 0)
  const blackPower = result.black.reduce((s, id) => s + scoreOf(id), 0)
  assert.equal(whitePower, blackPower, 'debe elegir el reparto parejo')
})
