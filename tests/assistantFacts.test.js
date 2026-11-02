import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PERIOD_LABELS,
  buildStatsFacts,
  buildBuilderFacts,
  validateAssistantAction,
} from '../src/utils/assistantFacts.js'

const players = [
  { id: 'p1', name: 'Villa' },
  { id: 'p2', name: 'Werz' },
  { id: 'p3', name: 'Bob' },
  { id: 'p4', name: 'Luigi' },
  { id: 'p5', name: 'Yoc', archived: true },
]

const stat = (id, over = {}) => ({
  id,
  played: 4,
  wins: 2,
  losses: 1,
  ties: 1,
  winRate: 62.5,
  avgRating: '7.2',
  mvps: 1,
  rankingScore: '70.5',
  ...over,
})

const displayStats = [stat('p1'), stat('p2'), stat('p3'), stat('p4')]

const matches = [
  { id: 'm1', date: '2026-10-01', matchFormat: '2v2', teamWhite: ['p1', 'p2'], teamBlack: ['p3', 'p4'], winner: 'white', scoreWhite: 3, scoreBlack: 1 },
  { id: 'm2', date: '2026-10-08', matchFormat: '2v2', teamWhite: ['p1', 'p3'], teamBlack: ['p2', 'p4'], winner: 'black', scoreWhite: 0, scoreBlack: 2 },
  { id: 'm3', date: '2026-10-15', matchFormat: '2v2', teamWhite: ['p1', 'p4'], teamBlack: ['p2', 'p3'], winner: 'tie' },
]

const facts = (over = {}) =>
  buildStatsFacts({ players, displayStats, matches, timeFilter: 'month', userPlayerId: 'p1', ...over })

// ── periodo ────────────────────────────────────────────────────────────────

test('el periodo refleja el timeFilter activo y trae su etiqueta', () => {
  assert.deepEqual(facts().periodo, { clave: 'month', etiqueta: PERIOD_LABELS.month })
  assert.deepEqual(facts({ timeFilter: 'week' }).periodo, { clave: 'week', etiqueta: PERIOD_LABELS.week })
  assert.deepEqual(facts({ timeFilter: 'all' }).periodo, { clave: 'all', etiqueta: PERIOD_LABELS.all })
})

test('un timeFilter desconocido cae a todo el histórico', () => {
  assert.equal(facts({ timeFilter: 'raro' }).periodo.clave, 'all')
})

// ── jugadores ──────────────────────────────────────────────────────────────

test('los jugadores salen de displayStats, no del histórico completo', () => {
  const result = facts({ displayStats: [stat('p1'), stat('p2')] })
  assert.deepEqual(
    result.jugadores.map(j => j.id).sort(),
    ['p1', 'p2'],
    'solo los que el periodo trae'
  )
})

test('cada jugador trae nombre, sus números y si está activo', () => {
  const villa = facts().jugadores.find(j => j.id === 'p1')
  assert.equal(villa.nombre, 'Villa')
  assert.equal(villa.pj, 4)
  assert.equal(villa.v, 2)
  assert.equal(villa.calif, '7.2')
  assert.equal(villa.activo, true)
})

test('un jugador archivado se marca como no activo', () => {
  const result = facts({ displayStats: [...displayStats, stat('p5')] })
  assert.equal(result.jugadores.find(j => j.id === 'p5').activo, false)
})

test('un periodo sin partidos devuelve jugadores y partidos vacíos sin lanzar', () => {
  const result = facts({ displayStats: [], matches: [] })
  assert.deepEqual(result.jugadores, [])
  assert.deepEqual(result.ultimosPartidos, [])
  assert.deepEqual(result.parejas, [])
  assert.deepEqual(result.duelos, [])
})

test('los partidos del bloque son los del periodo, no el histórico completo', () => {
  const result = facts({ matches: [matches[0]], allMatches: matches })
  assert.equal(result.ultimosPartidos.length, 1, 'solo el partido del periodo')
  assert.equal(result.quienPregunta.historico.formaReciente.length, 3, 'la forma sí es histórica')
})

test('una estadística de un jugador que ya no existe no aparece', () => {
  const result = facts({ displayStats: [...displayStats, stat('borrado')] })
  assert.equal(result.jugadores.some(j => j.id === 'borrado'), false)
})

// ── quienPregunta ──────────────────────────────────────────────────────────

test('quienPregunta trae al jugador vinculado con su racha histórica', () => {
  const { quienPregunta } = facts()
  assert.equal(quienPregunta.playerId, 'p1')
  assert.equal(quienPregunta.nombre, 'Villa')
  assert.equal(typeof quienPregunta.historico.racha.tipo, 'string')
  assert.equal(typeof quienPregunta.historico.racha.cantidad, 'number')
  assert.ok(Array.isArray(quienPregunta.historico.formaReciente))
})

test('la forma reciente va del partido más viejo al más nuevo', () => {
  const { quienPregunta } = facts()
  assert.deepEqual(quienPregunta.historico.formaReciente, ['W', 'L', 'D'])
})

test('un playerId vinculado a un jugador borrado deja quienPregunta en null sin lanzar', () => {
  assert.equal(facts({ userPlayerId: 'fantasma' }).quienPregunta, null)
})

test('sin usuario vinculado quienPregunta es null', () => {
  assert.equal(facts({ userPlayerId: '' }).quienPregunta, null)
  assert.equal(facts({ userPlayerId: undefined }).quienPregunta, null)
})

// ── partidos, parejas y duelos ─────────────────────────────────────────────

test('ultimosPartidos trae 25 como máximo y en orden cronológico inverso', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-0${(i % 9) + 1}`,
    teamWhite: ['p1'],
    teamBlack: ['p2'],
    winner: 'white',
  }))
  const result = facts({ matches: many })
  assert.equal(result.ultimosPartidos.length, 25)
  const dates = result.ultimosPartidos.map(m => m.fecha)
  assert.deepEqual(dates, [...dates].sort().reverse(), 'del más nuevo al más viejo')
})

test('ultimosPartidos usa nombres, no ids', () => {
  const [ultimo] = facts().ultimosPartidos
  assert.ok(ultimo.blanco.every(name => !name.startsWith('p')), `nombres esperados: ${ultimo.blanco}`)
})

test('los partidos sin resultado no entran', () => {
  const result = facts({ matches: [{ id: 'z', date: '2026-10-20', teamWhite: ['p1'], teamBlack: ['p2'] }] })
  assert.deepEqual(result.ultimosPartidos, [])
})

test('parejas y duelos salen del histórico y están acotados', () => {
  const result = facts()
  assert.ok(Array.isArray(result.parejas))
  assert.ok(Array.isArray(result.duelos))
  assert.ok(result.parejas.length <= 30)
  assert.ok(result.duelos.length <= 30)
  const pareja = result.parejas.find(p => p.jugadores.includes('Villa') && p.jugadores.includes('Werz'))
  assert.equal(pareja.pj, 1)
  assert.equal(pareja.v, 1)
})

test('el bloque serializado de un grupo grande pesa menos de 60 KB', () => {
  const bigPlayers = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, name: `Jugador ${i}` }))
  const bigStats = bigPlayers.map(p => stat(p.id))
  const bigMatches = Array.from({ length: 300 }, (_, i) => ({
    id: `bm${i}`,
    date: `2026-0${(i % 9) + 1}-1${i % 9}`,
    teamWhite: bigPlayers.slice(0, 6).map(p => p.id),
    teamBlack: bigPlayers.slice(6, 12).map(p => p.id),
    winner: i % 2 ? 'white' : 'black',
  }))
  const result = buildStatsFacts({
    players: bigPlayers,
    displayStats: bigStats,
    matches: bigMatches,
    timeFilter: 'all',
    userPlayerId: 'b0',
  })
  const bytes = Buffer.byteLength(JSON.stringify(result), 'utf8')
  assert.ok(bytes < 60 * 1024, `el bloque pesa ${bytes} bytes`)
})

// ── hechos del armador ─────────────────────────────────────────────────────

const powerMap = {
  p1: { score: 90, tier: 'high', known: true },
  p2: { score: 70, tier: 'mid', known: true },
  p3: { score: 40, tier: 'low', known: true },
  p4: { score: 50, tier: 'mid', known: false },
}

const builderFacts = (over = {}) =>
  buildBuilderFacts(facts(), {
    matchFormat: '2v2',
    teamSize: 2,
    requiredPlayers: 4,
    selectedPlayers: ['p1', 'p2', 'p3', 'p4'],
    playerPowerMap: powerMap,
    matchPositions: { p1: 'portero', p2: 'medio' },
    liveDraftInsights: {
      balanceScore: 78,
      balanceBand: { label: 'Parejo', tone: 'good' },
      probability: { white: 54, black: 46 },
      swapSuggestions: [{ white: 'p1', black: 'p3', improvement: 6, nextBalance: 84 }],
    },
    teamWhite: ['p1', 'p3'],
    teamBlack: ['p2', 'p4'],
    ...over,
  })

test('los hechos del armador añaden power y tier a cada jugador', () => {
  const villa = builderFacts().jugadores.find(j => j.id === 'p1')
  assert.equal(villa.power, 90)
  assert.equal(villa.tier, 'high')
})

test('un jugador sin puntaje conocido lo dice', () => {
  const luigi = builderFacts().jugadores.find(j => j.id === 'p4')
  assert.equal(luigi.puntajeConocido, false)
})

test('los convocados traen su posición asignada', () => {
  const { convocados } = builderFacts()
  assert.equal(convocados.length, 4)
  assert.equal(convocados.find(c => c.id === 'p1').posicion, 'portero')
  assert.equal(convocados.find(c => c.id === 'p3').posicion, '')
})

test('el reparto actual trae balance, probabilidad y equipos por nombre', () => {
  const { repartoActual } = builderFacts()
  assert.equal(repartoActual.balance, 78)
  assert.deepEqual(repartoActual.probabilidad, { white: 54, black: 46 })
  assert.deepEqual(repartoActual.blanco, ['p1', 'p3'])
})

test('los swaps sugeridos viajan con su mejora', () => {
  const { swapsSugeridos } = builderFacts()
  assert.equal(swapsSugeridos.length, 1)
  assert.equal(swapsSugeridos[0].mejora, 6)
})

test('el formato y los jugadores requeridos viajan', () => {
  const result = builderFacts()
  assert.equal(result.formato, '2v2')
  assert.equal(result.jugadoresRequeridos, 4)
  assert.equal(result.teamSize, 2)
})

// ── validación de acciones ─────────────────────────────────────────────────

const context = {
  players,
  selectedPlayers: ['p1', 'p2', 'p3', 'p4'],
  requiredPlayers: 4,
  teamWhite: ['p1', 'p3'],
  teamBlack: ['p2', 'p4'],
}

const check = (accion, over = {}) => validateAssistantAction(accion, { ...context, ...over })

test('una acción nula se acepta como "sin cambios"', () => {
  assert.deepEqual(check(null), { ok: true, accion: null })
  assert.deepEqual(check(undefined), { ok: true, accion: null })
})

test('una acción con un playerId inexistente se rechaza', () => {
  const result = check({ tipo: 'rebalancear', fijarBlanco: ['nadie'] })
  assert.equal(result.ok, false)
  assert.match(result.reason, /no reconozco|no existe/i)
})

test('una acción que menciona a alguien que ya no está convocado se rechaza con aviso', () => {
  const result = check({ tipo: 'rebalancear', fijarBlanco: ['p5'] })
  assert.equal(result.ok, false)
  assert.match(result.reason, /convocat/i)
})

test('excluir a alguien que no está convocado se rechaza', () => {
  const result = check({ tipo: 'rebalancear', excluir: ['p5'] })
  assert.equal(result.ok, false)
})

test('una acción que deja la convocatoria corta sin incluir se rechaza', () => {
  const result = check({ tipo: 'rebalancear', excluir: ['p1'] })
  assert.equal(result.ok, false)
  assert.match(result.reason, /falta|quedan/i)
})

test('excluir mas incluir que mantiene el tamaño se acepta', () => {
  const result = check({ tipo: 'rebalancear', excluir: ['p1'], incluir: ['p5'] })
  assert.equal(result.ok, false, 'p5 está archivado, no se puede llamar')

  const conActivo = check(
    { tipo: 'rebalancear', excluir: ['p1'], incluir: ['p6'] },
    { players: [...players, { id: 'p6', name: 'Nuevo' }] }
  )
  assert.equal(conActivo.ok, true)
})

test('incluir a alguien que ya está convocado se rechaza', () => {
  const result = check({ tipo: 'rebalancear', incluir: ['p1'] })
  assert.equal(result.ok, false)
})

test('juntar y separar del mismo par se rechaza', () => {
  const result = check({ tipo: 'rebalancear', juntar: [['p1', 'p2']], separar: [['p2', 'p1']] })
  assert.equal(result.ok, false)
  assert.match(result.reason, /contradic/i)
})

test('fijar al mismo jugador en los dos equipos se rechaza', () => {
  const result = check({ tipo: 'rebalancear', fijarBlanco: ['p1'], fijarNegro: ['p1'] })
  assert.equal(result.ok, false)
})

test('un par con un solo jugador se rechaza', () => {
  assert.equal(check({ tipo: 'rebalancear', juntar: [['p1']] }).ok, false)
})

test('un swap con un jugador que no está en su equipo se rechaza', () => {
  assert.equal(check({ tipo: 'aplicarSwap', swap: { blanco: 'p2', negro: 'p3' } }).ok, false)
  assert.equal(check({ tipo: 'aplicarSwap', swap: { blanco: 'p1', negro: 'p2' } }).ok, true)
})

test('un swap sin los dos lados se rechaza', () => {
  assert.equal(check({ tipo: 'aplicarSwap', swap: { blanco: 'p1' } }).ok, false)
  assert.equal(check({ tipo: 'aplicarSwap' }).ok, false)
})

test('las posiciones llegan como lista y salen como mapa', () => {
  const result = check({
    tipo: 'rebalancear',
    posiciones: [{ playerId: 'p1', posicion: 'portero' }],
  })
  assert.equal(result.ok, true)
  assert.deepEqual(result.accion.posiciones, { p1: 'portero' })
})

test('una posición para alguien fuera de la convocatoria se rechaza', () => {
  const result = check({ tipo: 'rebalancear', posiciones: [{ playerId: 'p5', posicion: 'medio' }] })
  assert.equal(result.ok, false)
})

test('una acción válida vuelve normalizada con listas siempre presentes', () => {
  const result = check({ tipo: 'rebalancear', juntar: [['p1', 'p2']] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.accion.juntar, [['p1', 'p2']])
  assert.deepEqual(result.accion.separar, [])
  assert.deepEqual(result.accion.excluir, [])
  assert.deepEqual(result.accion.incluir, [])
})

test('una acción que no es objeto se rechaza', () => {
  for (const accion of ['rebalancear', 42, []]) {
    assert.equal(check(accion).ok, false, `accion ${JSON.stringify(accion)}`)
  }
})
