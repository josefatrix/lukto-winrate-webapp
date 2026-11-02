import test from 'node:test'
import assert from 'node:assert/strict'

import {
  scorePlayer,
  rolePenaltyFor,
  buildGreedyTeams,
  evaluateSplit,
  pickBestSplit,
  satisfiesConstraints,
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

// ── Restricciones ──────────────────────────────────────────────────────────

/* Mezcla determinista: Fisher-Yates sobre mulberry32. Deja que los tests
   recorran cientos de órdenes reales sin depender de Math.random. */
const seededShuffle = seed => {
  let state = seed >>> 0
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return ids => {
    const out = [...ids]
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[out[i], out[j]] = [out[j], out[i]]
    }
    return out
  }
}

const sixScores = { a: 100, b: 92, c: 80, d: 24, e: 12, f: 6 }
const sixPool = ['a', 'b', 'c', 'd', 'e', 'f']
const sixScoreOf = id => sixScores[id] ?? 50

const splitWith = constraints =>
  pickBestSplit({
    pool: sixPool,
    teamSize: 3,
    scoreOf: sixScoreOf,
    positionOf: noPositions,
    probabilityOf: () => ({ white: 50, black: 50 }),
    iterations: 200,
    shuffle: seededShuffle(20261102),
    constraints,
  })

test('sin restricciones satisfiesConstraints acepta cualquier reparto', () => {
  assert.equal(satisfiesConstraints({ white: ['a'], black: ['b'], constraints: {} }), true)
  assert.equal(satisfiesConstraints({ white: ['a'], black: ['b'] }), true)
})

test('satisfiesConstraints exige el equipo de los jugadores fijados', () => {
  const white = ['a', 'b']
  const black = ['c', 'd']
  assert.equal(satisfiesConstraints({ white, black, constraints: { fijarBlanco: ['a'] } }), true)
  assert.equal(satisfiesConstraints({ white, black, constraints: { fijarBlanco: ['c'] } }), false)
  assert.equal(satisfiesConstraints({ white, black, constraints: { fijarNegro: ['d'] } }), true)
  assert.equal(satisfiesConstraints({ white, black, constraints: { fijarNegro: ['b'] } }), false)
})

test('satisfiesConstraints exige que los pares de juntar estén en el mismo equipo', () => {
  const juntos = { white: ['a', 'b'], black: ['c', 'd'], constraints: { juntar: [['a', 'b']] } }
  const separados = { white: ['a', 'c'], black: ['b', 'd'], constraints: { juntar: [['a', 'b']] } }
  assert.equal(satisfiesConstraints(juntos), true)
  assert.equal(satisfiesConstraints(separados), false)
})

test('satisfiesConstraints exige que los pares de separar estén en equipos distintos', () => {
  const separados = { white: ['a', 'c'], black: ['b', 'd'], constraints: { separar: [['a', 'b']] } }
  const juntos = { white: ['a', 'b'], black: ['c', 'd'], constraints: { separar: [['a', 'b']] } }
  assert.equal(satisfiesConstraints(separados), true)
  assert.equal(satisfiesConstraints(juntos), false)
})

test('un par que menciona a alguien que no juega se ignora', () => {
  const teams = { white: ['a', 'b'], black: ['c', 'd'] }
  assert.equal(
    satisfiesConstraints({ ...teams, constraints: { juntar: [['a', 'zzz']] } }),
    true,
    'juntar con un ausente no puede cumplirse ni incumplirse'
  )
  assert.equal(satisfiesConstraints({ ...teams, constraints: { separar: [['zzz', 'yyy']] } }), true)
})

test('juntar deja a los dos jugadores en el mismo equipo', () => {
  const { white, black, constraintsMet } = splitWith({ juntar: [['a', 'b']] })
  assert.equal(constraintsMet, true)
  const juntosEnBlanco = white.includes('a') && white.includes('b')
  const juntosEnNegro = black.includes('a') && black.includes('b')
  assert.ok(juntosEnBlanco || juntosEnNegro, `a y b quedaron separados: ${white} / ${black}`)
})

test('separar los deja en equipos distintos', () => {
  const { white, black, constraintsMet } = splitWith({ separar: [['e', 'f']] })
  assert.equal(constraintsMet, true)
  assert.notEqual(white.includes('e'), white.includes('f'))
  assert.notEqual(black.includes('e'), black.includes('f'))
})

test('fijarBlanco respeta el equipo pedido', () => {
  const { white, constraintsMet } = splitWith({ fijarBlanco: ['f'] })
  assert.equal(constraintsMet, true)
  assert.ok(white.includes('f'), 'f tenía que quedar en blanco')
})

test('fijarNegro respeta el equipo pedido', () => {
  const { black, constraintsMet } = splitWith({ fijarNegro: ['a'] })
  assert.equal(constraintsMet, true)
  assert.ok(black.includes('a'), 'a tenía que quedar en negro')
})

test('fijar en los dos equipos a la vez se respeta', () => {
  const { white, black } = splitWith({ fijarBlanco: ['a'], fijarNegro: ['b'] })
  assert.ok(white.includes('a'))
  assert.ok(black.includes('b'))
})

test('juntar y separar del mismo par es imposible y devuelve constraintsMet false', () => {
  const { constraintsMet } = splitWith({ juntar: [['a', 'b']], separar: [['a', 'b']] })
  assert.equal(constraintsMet, false)
})

test('una restricción imposible devuelve un reparto válido, no una excepción', () => {
  const { white, black, score, constraintsMet } = splitWith({
    juntar: [['a', 'b']],
    separar: [['a', 'b']],
  })
  assert.equal(constraintsMet, false)
  assert.equal(white.length, 3)
  assert.equal(black.length, 3)
  assert.deepEqual([...white, ...black].sort(), sixPool)
  assert.equal(typeof score, 'number')
})

test('sin restricciones, el resultado es idéntico al de la tarea 1', () => {
  const base = {
    pool: sixPool,
    teamSize: 3,
    scoreOf: sixScoreOf,
    positionOf: noPositions,
    probabilityOf: () => ({ white: 50, black: 50 }),
    iterations: 200,
  }
  const sinCampo = pickBestSplit({ ...base, shuffle: seededShuffle(7) })
  const conVacio = pickBestSplit({ ...base, shuffle: seededShuffle(7), constraints: {} })
  assert.deepEqual(
    { white: conVacio.white, black: conVacio.black, score: conVacio.score },
    { white: sinCampo.white, black: sinCampo.black, score: sinCampo.score }
  )
  assert.equal(sinCampo.constraintsMet, true)
})
