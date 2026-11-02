/**
 * The facts block the assistant reasons over, and the gate every action it
 * proposes has to pass.
 *
 * The client builds this, not the server: `useStats` and `useMatchBuilder` have
 * already computed every number on screen, and sending those means the
 * assistant can never contradict the table the user is looking at. Recomputing
 * server-side would add a third copy of the ranking formula.
 */
import { computeDraftLinks, duelKey, pairKey } from './matchHistory.js'
import { compareMatchChronology, getStreakSummary, hasResult } from './statistics.js'

export const PERIOD_LABELS = {
  week: 'la última semana',
  month: 'este mes',
  all: 'todo el histórico',
}

const MAX_MATCHES = 25
const MAX_LINKS = 30
const RECENT_FORM = 5

const periodFor = timeFilter => {
  const clave = PERIOD_LABELS[timeFilter] ? timeFilter : 'all'
  return { clave, etiqueta: PERIOD_LABELS[clave] }
}

const resultFor = (match, playerId) => {
  if (match.winner === 'tie') return 'D'
  const inWhite = match.teamWhite?.includes(playerId)
  const won = inWhite ? match.winner === 'white' : match.winner === 'black'
  return won ? 'W' : 'L'
}

const decidedMatches = matches =>
  (matches || []).filter(hasResult).sort(compareMatchChronology)

const playsIn = (match, playerId) =>
  match.teamWhite?.includes(playerId) || match.teamBlack?.includes(playerId)

/**
 * Streak, recent form and usual position for every player, not just the one
 * asking. Without this "¿quién está en mejor racha?" has no answer in the
 * block, and the model correctly refuses instead of guessing.
 *
 * Computed over the period's matches, like everything else in `jugadores`.
 */
const perPlayerForm = (chronological, playerIds) => {
  const form = new Map(playerIds.map(id => [id, []]))
  const positions = new Map(playerIds.map(id => [id, {}]))

  for (const match of chronological) {
    for (const id of playerIds) {
      if (!playsIn(match, id)) continue
      form.get(id).push(resultFor(match, id))
      const position = match.positions?.[id]
      if (position) {
        const seen = positions.get(id)
        seen[position] = (seen[position] || 0) + 1
      }
    }
  }

  const summarize = results => {
    let current = { tipo: '', cantidad: 0 }
    let mejorRachaV = 0
    for (const result of results) {
      current =
        current.tipo === result
          ? { tipo: result, cantidad: current.cantidad + 1 }
          : { tipo: result, cantidad: 1 }
      if (result === 'W') mejorRachaV = Math.max(mejorRachaV, current.cantidad)
    }
    return { racha: current, mejorRachaV, forma: results.slice(-RECENT_FORM) }
  }

  const mostPlayed = seen =>
    Object.entries(seen).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || ''

  return new Map(
    playerIds.map(id => [
      id,
      { ...summarize(form.get(id)), posicionHabitual: mostPlayed(positions.get(id)) },
    ])
  )
}

/**
 * `matches` is the period-filtered list — the same one `displayStats` was
 * computed from. `allMatches` is the whole history and feeds only
 * `quienPregunta.historico`, whose two fields ignore the filter by nature.
 *
 * Mixing them is the trap: with "week" selected on a week nobody played,
 * `jugadores` comes back empty while last month's matches would still be in
 * the block, and the model would answer from those and contradict the empty
 * table on screen.
 */
export const buildStatsFacts = ({
  players = [],
  displayStats = [],
  matches = [],
  allMatches,
  timeFilter = 'all',
  userPlayerId = '',
  draftLinks,
} = {}) => {
  const history = allMatches || matches
  const byId = new Map((players || []).map(player => [player.id, player]))
  const nameOf = id => byId.get(id)?.name || id

  /* A stat row whose player no longer exists is dropped rather than rendered
     with a raw id: the model would read the id as a name. */
  const jugadores = (displayStats || [])
    .filter(entry => byId.has(entry.id))
    .map(entry => ({
      id: entry.id,
      nombre: byId.get(entry.id).name,
      pj: entry.played ?? 0,
      v: entry.wins ?? 0,
      e: entry.ties ?? 0,
      d: entry.losses ?? 0,
      winRate: Math.round((Number(entry.winRate) || 0) * 10) / 10,
      calif: entry.avgRating ?? null,
      mvps: entry.mvps ?? 0,
      puntos: entry.rankingScore ?? null,
      activo: !byId.get(entry.id).archived,
    }))

  const chronological = decidedMatches(matches)
  const formById = perPlayerForm(
    chronological,
    jugadores.map(entry => entry.id)
  )
  for (const entry of jugadores) Object.assign(entry, formById.get(entry.id))

  const ultimosPartidos = chronological
    .slice(-MAX_MATCHES)
    .reverse()
    .map(match => ({
      fecha: match.date || '',
      formato: match.matchFormat || '',
      blanco: (match.teamWhite || []).map(nameOf),
      negro: (match.teamBlack || []).map(nameOf),
      marcador:
        match.scoreWhite !== undefined && match.scoreBlack !== undefined
          ? `${match.scoreWhite}-${match.scoreBlack}`
          : '',
      ganador: match.winner,
    }))

  const links = draftLinks || computeDraftLinks(matches)

  const parejas = Object.entries(links.teammatePairs)
    .map(([key, value]) => ({
      jugadores: key.split('__').map(nameOf),
      pj: value.games,
      v: value.wins,
    }))
    .sort((a, b) => b.pj - a.pj)
    .slice(0, MAX_LINKS)

  const duelos = Object.entries(links.duelStats)
    .map(([key, value]) => {
      const [a, b] = key.split('__')
      return { jugador: nameOf(a), contra: nameOf(b), pj: value.games, v: value.wins }
    })
    .sort((a, b) => b.pj - a.pj)
    .slice(0, MAX_LINKS)

  /* A linked account can point at a player an admin has since deleted. That
     must not take the whole facts block down with it. */
  const asker = userPlayerId ? byId.get(userPlayerId) : undefined
  let quienPregunta = null
  if (asker) {
    const own = jugadores.find(entry => entry.id === asker.id)
    const streak = getStreakSummary(history, asker.id)
    quienPregunta = {
      playerId: asker.id,
      nombre: asker.name,
      pj: own?.pj ?? 0,
      winRate: own?.winRate ?? 0,
      calif: own?.calif ?? null,
      /* Named for what it is: getStreakSummary walks the whole history and
         ignores the period filter. */
      /* Both fields walk the whole history and ignore the period filter. They
         live under `historico` so the prompt can say so once. */
      historico: {
        racha: { tipo: streak.current.type || '', cantidad: streak.current.count || 0 },
        formaReciente: decidedMatches(history)
          .filter(
            match =>
              match.teamWhite?.includes(asker.id) || match.teamBlack?.includes(asker.id)
          )
          .slice(-RECENT_FORM)
          .map(match => resultFor(match, asker.id)),
      },
    }
  }

  return {
    periodo: periodFor(timeFilter),
    jugadores,
    quienPregunta,
    /* El total va aparte porque ultimosPartidos está recortado a 25: sin este
       campo el modelo cuenta la lista y responde un total que no es. */
    totalPartidos: chronological.length,
    ultimosPartidos,
    parejas,
    duelos,
  }
}

/**
 * The builder's view of the roster is not the period's view.
 *
 * `statsFacts.jugadores` only holds players with matches in the active filter,
 * which is right for the stats bot and wrong here: the admin is deciding who
 * plays tonight, and the prompt tells the model to propose substitutes from
 * this list. An active player who missed the month still has to be in it, with
 * a name rather than a raw id.
 */
export const buildBuilderFacts = (
  statsFacts,
  {
    players = [],
    matchFormat = '',
    teamSize = 0,
    requiredPlayers = 0,
    selectedPlayers = [],
    playerPowerMap = {},
    matchPositions = {},
    liveDraftInsights,
    teamWhite = [],
    teamBlack = [],
  } = {}
) => {
  const power = id => playerPowerMap[id]
  const withPower = entry => ({
    ...entry,
    power: power(entry.id)?.score ?? null,
    tier: power(entry.id)?.tier ?? 'unknown',
    puntajeConocido: power(entry.id)?.known ?? false,
  })

  const fromPeriod = statsFacts.jugadores.map(withPower)
  const known = new Set(fromPeriod.map(entry => entry.id))
  const restOfRoster = players
    .filter(player => !player.archived && !known.has(player.id))
    .map(player =>
      withPower({
        id: player.id,
        nombre: player.name,
        pj: 0,
        v: 0,
        e: 0,
        d: 0,
        winRate: 0,
        calif: null,
        mvps: 0,
        puntos: null,
        activo: true,
      })
    )

  const jugadores = [...fromPeriod, ...restOfRoster]
  const nameOf = id => jugadores.find(entry => entry.id === id)?.nombre || id

  return {
    ...statsFacts,
    formato: matchFormat,
    teamSize,
    jugadoresRequeridos: requiredPlayers,
    jugadores,
    convocados: selectedPlayers.map(id => ({
      id,
      nombre: nameOf(id),
      power: power(id)?.score ?? null,
      tier: power(id)?.tier ?? 'unknown',
      posicion: matchPositions[id] || '',
    })),
    repartoActual: {
      blanco: [...teamWhite],
      negro: [...teamBlack],
      balance: liveDraftInsights?.balanceScore ?? null,
      banda: liveDraftInsights?.balanceBand?.label ?? '',
      probabilidad: liveDraftInsights?.probability ?? null,
    },
    /* useMatchBuilder emite whiteOut / blackOut. Leer swap.white dejaba la
       pareja en undefined y el modelo citaba una mejora real sobre jugadores
       que adivinaba. */
    swapsSugeridos: (liveDraftInsights?.swapSuggestions || []).map(swap => ({
      blanco: swap.whiteOut,
      negro: swap.blackOut,
      mejora: swap.improvement,
      balanceDespues: swap.nextBalance,
    })),
  }
}

const EMPTY_ACTION = {
  tipo: 'rebalancear',
  fijarBlanco: [],
  fijarNegro: [],
  excluir: [],
  incluir: [],
  juntar: [],
  separar: [],
  posiciones: {},
  swap: null,
}

const reject = reason => ({ ok: false, reason })

const idList = value => (Array.isArray(value) ? value.filter(id => typeof id === 'string') : [])

const pairList = value =>
  Array.isArray(value) ? value.filter(pair => Array.isArray(pair)).map(pair => [...pair]) : []

/**
 * Every action the model proposes passes through here before it reaches the
 * screen. The model can hallucinate an id or contradict itself; what it must
 * never do is produce a proposal the balancer cannot carry out.
 */
export const validateAssistantAction = (
  accion,
  {
    players = [],
    selectedPlayers = [],
    requiredPlayers = 0,
    teamSize = 0,
    teamWhite = [],
    teamBlack = [],
  } = {}
) => {
  if (accion === null || accion === undefined) return { ok: true, accion: null }
  if (typeof accion !== 'object' || Array.isArray(accion)) {
    return reject('La propuesta llegó mal formada.')
  }

  const byId = new Map(players.map(player => [player.id, player]))
  const pool = new Set(selectedPlayers)
  const nameOf = id => byId.get(id)?.name || id

  const fijarBlanco = idList(accion.fijarBlanco)
  const fijarNegro = idList(accion.fijarNegro)
  const excluir = idList(accion.excluir)
  const incluir = idList(accion.incluir)
  const juntar = pairList(accion.juntar)
  const separar = pairList(accion.separar)
  const posiciones = Array.isArray(accion.posiciones) ? accion.posiciones : []

  const mentioned = [
    ...fijarBlanco,
    ...fijarNegro,
    ...excluir,
    ...incluir,
    ...juntar.flat(),
    ...separar.flat(),
    ...posiciones.map(entry => entry?.playerId),
    accion.swap?.blanco,
    accion.swap?.negro,
  ].filter(Boolean)

  const unknown = mentioned.find(id => !byId.has(id))
  if (unknown) return reject(`No reconozco al jugador "${unknown}".`)

  for (const pair of [...juntar, ...separar]) {
    if (pair.length !== 2 || pair[0] === pair[1]) {
      return reject('Una de las parejas de la propuesta no tiene dos jugadores distintos.')
    }
  }

  const contradiction = juntar.find(([a, b]) =>
    separar.some(([c, d]) => (a === c && b === d) || (a === d && b === c))
  )
  if (contradiction) {
    return reject(
      `La propuesta se contradice: pide juntar y separar a ${nameOf(contradiction[0])} y ${nameOf(contradiction[1])}.`
    )
  }

  const bothTeams = fijarBlanco.find(id => fijarNegro.includes(id))
  if (bothTeams) return reject(`${nameOf(bothTeams)} no puede estar en los dos equipos.`)

  /* Without this the greedy quietly overfills white and dumps the rest on
     black, and a 6v4 split goes out with a success toast. */
  if (teamSize && (fijarBlanco.length > teamSize || fijarNegro.length > teamSize)) {
    return reject(`No caben tantos jugadores fijos en un equipo de ${teamSize}.`)
  }

  const outsideIncluded = incluir.find(id => pool.has(id))
  if (outsideIncluded) return reject(`${nameOf(outsideIncluded)} ya está en la convocatoria.`)

  const notActive = incluir.find(id => byId.get(id)?.archived)
  if (notActive) return reject(`${nameOf(notActive)} está archivado y no se puede convocar.`)

  /* The pool the action would leave behind. Everything else is judged against
     it, not against the pool as it is now. */
  const nextPool = new Set([...selectedPlayers.filter(id => !excluir.includes(id)), ...incluir])

  const notCalledUp = [...excluir, ...fijarBlanco, ...fijarNegro, ...juntar.flat(), ...separar.flat()].find(
    id => !pool.has(id) && !incluir.includes(id)
  )
  if (notCalledUp) {
    return reject(`${nameOf(notCalledUp)} no está en la convocatoria actual.`)
  }

  if (requiredPlayers && nextPool.size !== requiredPlayers) {
    const diff = requiredPlayers - nextPool.size
    return reject(
      diff > 0
        ? `Con esos cambios quedan ${nextPool.size} jugadores y faltan ${diff} para el formato.`
        : `Con esos cambios quedan ${nextPool.size} jugadores, ${-diff} de más para el formato.`
    )
  }

  const positionOutside = posiciones.find(entry => !nextPool.has(entry?.playerId))
  if (positionOutside) {
    return reject(`${nameOf(positionOutside.playerId)} no queda en la convocatoria, no puedo darle posición.`)
  }

  let swap = null
  if (accion.tipo === 'aplicarSwap') {
    const blanco = accion.swap?.blanco
    const negro = accion.swap?.negro
    if (!blanco || !negro) return reject('El intercambio propuesto no dice a quién cambiar por quién.')
    if (!teamWhite.includes(blanco) || !teamBlack.includes(negro)) {
      return reject('El intercambio propuesto no corresponde al reparto actual.')
    }
    swap = { blanco, negro }
  }

  return {
    ok: true,
    accion: {
      ...EMPTY_ACTION,
      tipo: accion.tipo === 'aplicarSwap' ? 'aplicarSwap' : 'rebalancear',
      fijarBlanco,
      fijarNegro,
      excluir,
      incluir,
      juntar,
      separar,
      posiciones: Object.fromEntries(
        posiciones
          .filter(entry => entry?.playerId && typeof entry.posicion === 'string')
          .map(entry => [entry.playerId, entry.posicion])
      ),
      swap,
    },
  }
}

export { duelKey, pairKey }
