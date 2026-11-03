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
  assert.deepEqual(result.partidos, [])
  assert.deepEqual(result.parejas, [])
  assert.deepEqual(result.duelos, [])
})

test('los partidos del bloque son los del periodo, no el histórico completo', () => {
  const result = facts({ matches: [matches[0]], allMatches: matches })
  assert.equal(result.partidos.length, 1, 'solo el partido del periodo')
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

test('los partidos van del más nuevo al más viejo', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`,
    date: `2026-${String((i % 12) + 1).padStart(2, '0')}-0${(i % 9) + 1}`,
    teamWhite: ['p1'],
    teamBlack: ['p2'],
    winner: 'white',
  }))
  const dates = facts({ matches: many }).partidos.map(m => m.fecha)
  assert.deepEqual(dates, [...dates].sort().reverse())
})

test('los partidos usan nombres, no ids', () => {
  const [ultimo] = facts().partidos
  assert.ok(ultimo.blanco.every(name => !name.startsWith('p')), `nombres esperados: ${ultimo.blanco}`)
})

test('los partidos sin resultado no entran', () => {
  const result = facts({ matches: [{ id: 'z', date: '2026-10-20', teamWhite: ['p1'], teamBlack: ['p2'] }] })
  assert.deepEqual(result.partidos, [])
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

test('el bloque de un grupo grande entra en el tope del servidor', () => {
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
  assert.ok(bytes < 250 * 1024, `el bloque pesa ${bytes} bytes`)
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

// ── Hallazgos de la revisión de rama ───────────────────────────────────────

/* La forma real que produce useMatchBuilder (swapSuggestions), no una
   inventada: el test anterior validaba el mock y escondía el bug. */
const realSwapSuggestion = { whiteOut: 'p1', blackOut: 'p3', improvement: 6, nextBalance: 84, nextWhiteProb: 52, nextBlackProb: 48 }

test('los swaps sugeridos llegan con los jugadores, no solo con la mejora', () => {
  const result = buildBuilderFacts(facts(), {
    players,
    teamSize: 2,
    requiredPlayers: 4,
    selectedPlayers: ['p1', 'p2', 'p3', 'p4'],
    playerPowerMap: powerMap,
    liveDraftInsights: { swapSuggestions: [realSwapSuggestion] },
    teamWhite: ['p1', 'p3'],
    teamBlack: ['p2', 'p4'],
  })
  const [swap] = result.swapsSugeridos
  assert.equal(swap.blanco, 'p1', 'sin esto el modelo adivina la pareja y cita una mejora real')
  assert.equal(swap.negro, 'p3')
  assert.equal(swap.mejora, 6)
})

test('el armador ve el plantel activo completo, no solo a quien jugó en el periodo', () => {
  // displayStats solo trae jugadores con partidos en el periodo activo; el
  // armador necesita saber a quién puede llamar esta noche.
  const soloUno = buildStatsFacts({
    players,
    displayStats: [stat('p1')],
    matches,
    timeFilter: 'month',
    userPlayerId: 'p1',
  })
  const result = buildBuilderFacts(soloUno, {
    players,
    teamSize: 2,
    requiredPlayers: 4,
    selectedPlayers: ['p1'],
    playerPowerMap: powerMap,
    liveDraftInsights: {},
  })
  const ids = result.jugadores.map(j => j.id)
  assert.ok(ids.includes('p2'), 'un activo sin partidos este mes tiene que estar')
  assert.ok(ids.includes('p4'))
  assert.equal(ids.includes('p5'), false, 'los archivados no se pueden convocar')
  const werz = result.jugadores.find(j => j.id === 'p2')
  assert.equal(werz.nombre, 'Werz', 'con nombre, no con el id crudo')
  assert.equal(werz.pj, 0)
  assert.equal(werz.power, 70)
})

test('los convocados siempre tienen nombre aunque no hayan jugado en el periodo', () => {
  const soloUno = buildStatsFacts({ players, displayStats: [stat('p1')], matches, timeFilter: 'month' })
  const result = buildBuilderFacts(soloUno, {
    players,
    teamSize: 2,
    requiredPlayers: 4,
    selectedPlayers: ['p1', 'p2'],
    playerPowerMap: powerMap,
    liveDraftInsights: {},
  })
  assert.equal(result.convocados.find(c => c.id === 'p2').nombre, 'Werz')
})

test('fijar más jugadores de los que caben en un equipo se rechaza', () => {
  const result = check(
    { tipo: 'rebalancear', fijarBlanco: ['p1', 'p2', 'p3'] },
    { teamSize: 2 }
  )
  assert.equal(result.ok, false)
  assert.match(result.reason, /caben|equipo/i)
})

test('fijar justo los que caben se acepta', () => {
  assert.equal(check({ tipo: 'rebalancear', fijarBlanco: ['p1', 'p2'] }, { teamSize: 2 }).ok, true)
})

test('fijar de más en el equipo negro también se rechaza', () => {
  assert.equal(
    check({ tipo: 'rebalancear', fijarNegro: ['p1', 'p2', 'p3'] }, { teamSize: 2 }).ok,
    false
  )
})

test('los hechos dicen cuántos partidos hay en total', () => {
  // Sin esto el modelo cuenta la lista recortada y da un total inventado.
  const many = Array.from({ length: 40 }, (_, i) => ({
    id: `x${i}`, date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    teamWhite: ['p1'], teamBlack: ['p2'], winner: 'white',
  }))
  const result = facts({ matches: many })
  assert.equal(result.totalPartidos, 40)
  assert.equal(result.partidos.length, 40)
})

test('totalPartidos cuenta solo los partidos con resultado del periodo', () => {
  assert.equal(facts().totalPartidos, 3)
  assert.equal(facts({ matches: [] }).totalPartidos, 0)
})

// ── Estadísticas de todos, no solo de quien pregunta ───────────────────────

test('cada jugador trae su racha, no solo quien pregunta', () => {
  // "¿Quién está en mejor racha?" era imposible de responder: el bloque solo
  // llevaba la racha de quien preguntaba.
  const villa = facts({ timeFilter: 'all' }).jugadores.find(j => j.id === 'p1')
  assert.equal(typeof villa.racha.tipo, 'string')
  assert.equal(typeof villa.racha.cantidad, 'number')
  assert.equal(typeof villa.mejorRachaV, 'number')
})

test('la racha de cada jugador sale de sus propios partidos', () => {
  // p1: m1 ganó (blanco), m2 perdió (estaba en blanco y ganó negro), m3 empate
  const villa = facts({ timeFilter: 'all' }).jugadores.find(j => j.id === 'p1')
  assert.deepEqual(villa.forma, ['W', 'L', 'D'])
  assert.deepEqual(villa.racha, { tipo: 'D', cantidad: 1 })

  // p2: m1 ganó, m2 ganó (estaba en negro), m3 empate
  const werz = facts({ timeFilter: 'all' }).jugadores.find(j => j.id === 'p2')
  assert.deepEqual(werz.forma, ['W', 'W', 'D'])
  assert.equal(werz.mejorRachaV, 2)
})

test('la forma de cada jugador trae como mucho cinco partidos', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({
    id: `f${i}`, date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    teamWhite: ['p1'], teamBlack: ['p2'], winner: 'white',
  }))
  const villa = facts({ matches: many }).jugadores.find(j => j.id === 'p1')
  assert.equal(villa.forma.length, 5)
  assert.deepEqual(villa.forma, ['W', 'W', 'W', 'W', 'W'])
})

test('la racha de los jugadores sigue el periodo, como el resto de jugadores[]', () => {
  const soloUltimo = facts({ matches: [matches[2]], allMatches: matches })
  const villa = soloUltimo.jugadores.find(j => j.id === 'p1')
  assert.deepEqual(villa.forma, ['D'], 'solo el partido del periodo')
})

test('cada jugador trae la posición en la que más juega', () => {
  const conPosiciones = [
    { ...matches[0], positions: { p1: 'portero', p2: 'medio' } },
    { ...matches[1], positions: { p1: 'portero', p2: 'delantero' } },
    { ...matches[2], positions: { p1: 'cierre' } },
  ]
  const result = facts({ matches: conPosiciones })
  assert.equal(result.jugadores.find(j => j.id === 'p1').posicionHabitual, 'portero')
  assert.equal(result.jugadores.find(j => j.id === 'p3').posicionHabitual, '')
})

test('quien pregunta sigue trayendo su racha histórica aparte', () => {
  const { quienPregunta } = facts()
  assert.ok(quienPregunta.historico.racha)
  assert.ok(Array.isArray(quienPregunta.historico.formaReciente))
})

// ── Acceso a todos los datos ───────────────────────────────────────────────

const ratings = [
  { ratedPlayerId: 'p1', ratedBy: 'p2', score: 9, matchId: 'm1' },
  { ratedPlayerId: 'p1', ratedBy: 'p3', score: 6, matchId: 'm1' },
  { ratedPlayerId: 'p2', ratedBy: 'p1', score: 8, matchId: 'm1' },
  { ratedPlayerId: 'p1', ratedBy: 'p2', score: 7, matchId: 'm2' },
]

test('los partidos ya no se recortan a 25', () => {
  const many = Array.from({ length: 60 }, (_, i) => ({
    id: `x${i}`, date: `2026-${String((i % 12) + 1).padStart(2, '0')}-10`,
    teamWhite: ['p1'], teamBlack: ['p2'], winner: 'white',
  }))
  const result = facts({ matches: many })
  assert.equal(result.partidos.length, 60)
  assert.equal(result.totalPartidos, 60)
})

test('cada partido lleva cancha, hora y posiciones por nombre', () => {
  const conTodo = [{
    ...matches[0], venue: 'LUKTO', time: '20:00',
    positions: { p1: 'portero', p2: 'medio' },
  }]
  const [partido] = facts({ matches: conTodo }).partidos
  assert.equal(partido.cancha, 'LUKTO')
  assert.equal(partido.hora, '20:00')
  assert.deepEqual(partido.posiciones, { Villa: 'portero', Werz: 'medio' })
})

test('las calificaciones individuales llegan por nombre, con quién calificó', () => {
  const result = facts({ ratings })
  const villa = result.calificaciones.find(c => c.jugador === 'Villa')
  assert.equal(villa.recibidas.length, 3)
  assert.ok(villa.recibidas.some(r => r.de === 'Werz' && r.nota === 9))
  assert.ok(villa.recibidas.some(r => r.de === 'Bob' && r.nota === 6))
})

test('sin calificaciones el campo viene vacío, no roto', () => {
  assert.deepEqual(facts().calificaciones, [])
  assert.deepEqual(facts({ ratings: null }).calificaciones, [])
})

test('las calificaciones de jugadores que ya no existen se descartan', () => {
  const result = facts({ ratings: [...ratings, { ratedPlayerId: 'zz', ratedBy: 'p1', score: 5, matchId: 'm1' }] })
  assert.equal(result.calificaciones.some(c => c.jugador === 'zz'), false)
})

test('las predicciones llegan si se pasan', () => {
  const result = facts({ predictions: [{ id: 'pr1', matchId: 'm1', userId: 'u1', pick: 'white' }] })
  assert.equal(result.predicciones.length, 1)
})

test('la asistencia del próximo partido llega si se pasa', () => {
  const result = facts({ attendance: { matchId: 'm9', confirmados: ['Villa'], ausentes: ['Bob'] } })
  assert.equal(result.asistenciaProximo.confirmados.length, 1)
})

test('el bloque completo de un grupo grande sigue por debajo del tope', () => {
  const bigPlayers = Array.from({ length: 40 }, (_, i) => ({ id: `b${i}`, name: `Jugador ${i}` }))
  const bigMatches = Array.from({ length: 120 }, (_, i) => ({
    id: `bm${i}`, date: `2026-0${(i % 9) + 1}-1${i % 9}`, venue: 'LUKTO', time: '20:00',
    teamWhite: bigPlayers.slice(0, 6).map(p => p.id), teamBlack: bigPlayers.slice(6, 12).map(p => p.id),
    winner: i % 2 ? 'white' : 'black',
  }))
  const bigRatings = bigMatches.flatMap(m =>
    bigPlayers.slice(0, 12).map(p => ({ ratedPlayerId: p.id, ratedBy: 'b0', score: 7, matchId: m.id }))
  )
  const result = buildStatsFacts({
    players: bigPlayers, displayStats: bigPlayers.map(p => stat(p.id)),
    matches: bigMatches, ratings: bigRatings, timeFilter: 'all', userPlayerId: 'b0',
  })
  const kb = Buffer.byteLength(JSON.stringify(result), 'utf8') / 1024
  assert.ok(kb < 150, `el bloque pesa ${kb.toFixed(1)} KB`)
})
