import { useCallback, useMemo, useState } from 'react'

import { useApp } from '../../contexts'
import { useStats } from '../../hooks/useStats'
import '../../styles/insights.css'
import { getPositionGroup } from '../../utils/matchConstants'
import {
  calculateWinRate,
  compareMatchChronology,
  finiteOr,
  getCurrentStreak,
  hasResult,
} from '../../utils/statistics.js'
import { AvatarImage } from '../common/AvatarImage'

const VIEW_TABS = [
  { id: 'teams', label: 'Equipos' },
  { id: 'roles', label: 'Roles' },
  { id: 'form', label: 'Forma' },
  { id: 'compare', label: 'Comparar' },
]

const RESULT_LABELS = {
  W: 'Victoria',
  D: 'Empate',
  L: 'Derrota',
}

const ROLE_ORDER = ['Portero', 'Defensa', 'Medio', 'Delantero', 'Otro']
const ROLE_LABELS = {
  Portero: 'Portero',
  Defensa: 'Defensa',
  Medio: 'Mediocampo',
  Delantero: 'Ataque',
  Otro: 'Otro',
}
const UNASSIGNED_ROLE = 'Sin posición'

const playerIdsInMatch = match => [...(match.teamWhite || []), ...(match.teamBlack || [])]

const getResultForPlayer = (match, playerId) => {
  if (match.winner === 'tie') return 'D'
  const inWhite = match.teamWhite?.includes(playerId)
  const won = (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black')
  return won ? 'W' : 'L'
}

const average = values => {
  const valid = values.filter(value => typeof value === 'number' && Number.isFinite(value))
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null
}

const formatPercent = value => `${Math.round(finiteOr(value, 0))}%`
const formatRating = value =>
  value === null || value === undefined || value === '' ? 'Sin calificación' : Number(value).toFixed(1)
const formatRecord = entry => `${entry.wins}V ${entry.ties}E ${entry.losses}D`
const resultDisplay = result => (result === 'W' ? 'V' : result === 'D' ? 'E' : 'D')
const playerNameList = (ids, getPlayerName) =>
  ids.map(id => getPlayerName(id)).join(ids.length === 2 ? ' + ' : ', ')

const getPlayerMatchRatings = (ratings, playerId, matchId) =>
  (ratings?.[playerId] || []).filter(
    rating =>
      rating.matchId === matchId &&
      typeof rating.score === 'number' &&
      Number.isFinite(rating.score)
  )

const buildCombos = (matches, getPlayerName) => {
  const buckets = { duos: new Map(), trios: new Map() }
  const addCombo = (ids, won, tied, size) => {
    const sorted = [...ids].sort()
    const key = sorted.join('__')
    const target = size === 2 ? buckets.duos : buckets.trios
    const current = target.get(key) || { key, ids: sorted, wins: 0, ties: 0, losses: 0, games: 0 }
    current.games += 1
    if (tied) current.ties += 1
    else if (won) current.wins += 1
    else current.losses += 1
    target.set(key, current)
  }

  matches.forEach(match => {
    const tied = match.winner === 'tie'
    const sides = [
      { ids: match.teamWhite || [], won: match.winner === 'white' },
      { ids: match.teamBlack || [], won: match.winner === 'black' },
    ]
    sides.forEach(side => {
      for (let i = 0; i < side.ids.length; i += 1) {
        for (let j = i + 1; j < side.ids.length; j += 1) {
          addCombo([side.ids[i], side.ids[j]], side.won, tied, 2)
          for (let k = j + 1; k < side.ids.length; k += 1) {
            addCombo([side.ids[i], side.ids[j], side.ids[k]], side.won, tied, 3)
          }
        }
      }
    })
  })

  const rankCombos = list =>
    [...list.values()]
      .filter(combo => combo.games >= 2)
      .map(combo => ({
        ...combo,
        winRate: calculateWinRate(combo.wins, combo.ties, combo.games),
        name: playerNameList(combo.ids, getPlayerName),
        names: combo.ids.map(id => getPlayerName(id)),
      }))
      .sort(
        (a, b) =>
          b.winRate - a.winRate ||
          b.games - a.games ||
          b.wins - a.wins ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 6)

  return {
    duos: rankCombos(buckets.duos),
    trios: rankCombos(buckets.trios),
  }
}

const buildRoleRows = (matches, ratings, getPlayerName) => {
  const rows = new Map()
  matches.forEach(match => {
    playerIdsInMatch(match).forEach(playerId => {
      const role = getPositionGroup(match.positions?.[playerId] || '')
      if (role === UNASSIGNED_ROLE) return
      const key = `${role}__${playerId}`
      const row = rows.get(key) || {
        key,
        role,
        playerId,
        playerName: getPlayerName(playerId),
        played: 0,
        wins: 0,
        ties: 0,
        losses: 0,
        ratingSum: 0,
        ratingCount: 0,
      }
      const result = getResultForPlayer(match, playerId)
      row.played += 1
      if (result === 'W') row.wins += 1
      if (result === 'D') row.ties += 1
      if (result === 'L') row.losses += 1
      const matchRatings = getPlayerMatchRatings(ratings, playerId, match.id)
      if (matchRatings.length) {
        row.ratingSum +=
          matchRatings.reduce((sum, rating) => sum + rating.score, 0) / matchRatings.length
        row.ratingCount += 1
      }
      rows.set(key, row)
    })
  })

  const grouped = {}
  rows.forEach(row => {
    const avgRating = row.ratingCount ? row.ratingSum / row.ratingCount : null
    const winRate = calculateWinRate(row.wins, row.ties, row.played)
    const score = finiteOr(avgRating, 5) * 9 + winRate * 0.45 + Math.min(row.played, 8) * 1.5
    const next = { ...row, avgRating, winRate, score }
    if (!grouped[row.role]) grouped[row.role] = []
    grouped[row.role].push(next)
  })

  return Object.entries(grouped)
    .sort(([a], [b]) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b))
    .map(([role, entries]) => ({
      role,
      entries: entries
        .sort(
          (a, b) =>
            b.score - a.score || b.played - a.played || a.playerName.localeCompare(b.playerName)
        )
        .slice(0, 5),
    }))
}

const buildFormRows = (matches, ratings, stats, getPlayerName) => {
  const statMap = new Map((stats || []).map(player => [player.id, player]))
  return [...statMap.values()]
    .filter(player => player.played > 0)
    .map(player => {
      const playerMatches = matches
        .filter(match => playerIdsInMatch(match).includes(player.id))
        .sort(compareMatchChronology)
      const lastFiveMatches = playerMatches.slice(-5)
      const lastFive = lastFiveMatches.map(match => getResultForPlayer(match, player.id))
      const lastFivePoints = lastFive.reduce(
        (sum, result) => sum + (result === 'W' ? 1 : result === 'D' ? 0.5 : 0),
        0
      )
      const recentRated = playerMatches
        .map(match => {
          const scores = getPlayerMatchRatings(ratings, player.id, match.id).map(
            rating => rating.score
          )
          return scores.length ? average(scores) : null
        })
        .filter(value => value !== null)
      const recentRating = average(recentRated.slice(-3))
      const previousRating = average(recentRated.slice(-6, -3))
      const ratingDelta =
        recentRating !== null && previousRating !== null ? recentRating - previousRating : null
      const streak = getCurrentStreak(matches, player.id)
      const formScore =
        (lastFivePoints / Math.max(lastFive.length, 1)) * 100 +
        (ratingDelta || 0) * 8 +
        Math.min(player.played, 8)
      return {
        ...player,
        playerName: getPlayerName(player.id),
        lastFive,
        recentRating,
        previousRating,
        ratingDelta,
        streak,
        formScore,
      }
    })
    .sort(
      (a, b) =>
        b.formScore - a.formScore || b.played - a.played || a.playerName.localeCompare(b.playerName)
    )
}

const buildComparison = (matches, ratings, stats, firstId, secondId, getPlayerName) => {
  const statMap = new Map((stats || []).map(player => [player.id, player]))
  const first = statMap.get(firstId)
  const second = secondId ? statMap.get(secondId) : null
  if (!first) return null

  const playerHistory = playerId =>
    matches
      .filter(match => playerIdsInMatch(match).includes(playerId))
      .sort(compareMatchChronology)
      .map(match => {
        const scores = getPlayerMatchRatings(ratings, playerId, match.id).map(
          rating => rating.score
        )
        return {
          id: match.id,
          date: match.date,
          venue: match.venue || 'Sede sin definir',
          result: getResultForPlayer(match, playerId),
          rating: average(scores),
        }
      })

  const shared = second
    ? matches.reduce(
        (acc, match) => {
          const hasFirst = playerIdsInMatch(match).includes(firstId)
          const hasSecond = playerIdsInMatch(match).includes(secondId)
          if (!hasFirst || !hasSecond) return acc
          const firstWhite = match.teamWhite?.includes(firstId)
          const secondWhite = match.teamWhite?.includes(secondId)
          const sameTeam = firstWhite === secondWhite
          const result = getResultForPlayer(match, firstId)
          if (sameTeam) {
            acc.together.games += 1
            if (result === 'W') acc.together.wins += 1
            if (result === 'D') acc.together.ties += 1
            if (result === 'L') acc.together.losses += 1
          } else {
            acc.against.games += 1
            if (result === 'W') acc.against.firstWins += 1
            if (result === 'D') acc.against.ties += 1
            if (result === 'L') acc.against.secondWins += 1
          }
          return acc
        },
        {
          together: { games: 0, wins: 0, ties: 0, losses: 0 },
          against: { games: 0, firstWins: 0, secondWins: 0, ties: 0 },
        }
      )
    : null

  return {
    first,
    second,
    history: playerHistory(firstId).slice(-8).reverse(),
    shared,
    firstName: getPlayerName(firstId),
    secondName: secondId ? getPlayerName(secondId) : '',
  }
}

function StatCard({ label, value, note }) {
  return (
    <div className="ins-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {note ? <small>{note}</small> : null}
    </div>
  )
}

function Meter({ value, label }) {
  const width = Math.max(0, Math.min(100, finiteOr(value, 0)))
  return (
    <div className="ins-meter" aria-label={`${label}: ${Math.round(width)} por ciento`}>
      <span style={{ width: `${width}%` }} />
    </div>
  )
}

function EmptyPanel({ title, children }) {
  return (
    <div className="ins-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  )
}

function TeamComboList({ title, rows, type, getPlayerPhoto }) {
  if (!rows.length) return null
  return (
    <section className="ins-panel">
      <div className="ins-panel-head">
        <div>
          <span className="ins-kicker">{type}</span>
          <h3>{title}</h3>
        </div>
        <small>Mínimo 2 partidos compartidos</small>
      </div>
      <div className="ins-team-list">
        {rows.map((combo, index) => (
          <article className="ins-team-row" key={combo.key}>
            <span className="ins-rank">{index + 1}</span>
            <div className="ins-avatar-stack" aria-hidden="true">
              {combo.ids.map(id => (
                <AvatarImage
                  key={id}
                  src={getPlayerPhoto(id)}
                  name={combo.names[combo.ids.indexOf(id)] || id}
                  imgClassName="ins-mini-avatar"
                  fallbackClassName="ins-mini-avatar"
                />
              ))}
            </div>
            <div className="ins-team-main">
              <strong>{combo.name}</strong>
              <small>
                {formatRecord(combo)} en {combo.games} partidos
              </small>
              <Meter value={combo.winRate} label={`Efectividad de ${combo.name}`} />
            </div>
            <span className="ins-value">{formatPercent(combo.winRate)}</span>
          </article>
        ))}
      </div>
    </section>
  )
}

function TeamsView({ combos, getPlayerPhoto }) {
  if (!combos.duos.length && !combos.trios.length) {
    return (
      <EmptyPanel title="Aún no hay patrones de equipo">
        Las duplas y los tríos aparecen después de al menos dos partidos completados juntos. Los
        empates cuentan como media victoria en estas tasas.
      </EmptyPanel>
    )
  }
  return (
    <div className="ins-grid-two">
      <TeamComboList
        title="Mejores duplas"
        rows={combos.duos}
        type="Química de dos jugadores"
        getPlayerPhoto={getPlayerPhoto}
      />
      <TeamComboList
        title="Mejores tríos"
        rows={combos.trios}
        type="Unidades de tres jugadores"
        getPlayerPhoto={getPlayerPhoto}
      />
    </div>
  )
}

function RolesView({ roleGroups, getPlayerPhoto }) {
  if (!roleGroups.length) {
    return (
      <EmptyPanel title="Aún no hay muestras de posición">
        Asigna posiciones en partidos completados para desbloquear clasificaciones por rol.
      </EmptyPanel>
    )
  }
  return (
    <div className="ins-role-grid">
      {roleGroups.map(group => (
        <section className="ins-panel" key={group.role}>
          <div className="ins-panel-head">
            <div>
              <span className="ins-kicker">Clasificación por rol</span>
              <h3>{ROLE_LABELS[group.role] || group.role}</h3>
            </div>
            <small>Calificación, efectividad, muestra</small>
          </div>
          <div className="ins-role-list">
            {group.entries.map((entry, index) => (
              <article className="ins-role-row" key={entry.key}>
                <span className="ins-rank">{index + 1}</span>
                <AvatarImage
                  src={getPlayerPhoto(entry.playerId)}
                  name={entry.playerName}
                  imgClassName="ins-avatar"
                  fallbackClassName="ins-avatar"
                />
                <div className="ins-role-main">
                  <strong>{entry.playerName}</strong>
                  <small>
                    {formatRecord(entry)} · {entry.played} partidos · {entry.ratingCount} muestras
                    calificadas
                  </small>
                  <Meter
                    value={entry.winRate}
                    label={`Efectividad de ${entry.playerName} como ${ROLE_LABELS[group.role] || group.role}`}
                  />
                </div>
                <div className="ins-role-values">
                  <strong>{formatRating(entry.avgRating)}</strong>
                  <span>{formatPercent(entry.winRate)}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function FormView({ formRows, getPlayerPhoto }) {
  if (!formRows.length) {
    return (
      <EmptyPanel title="Aún no hay forma de jugadores">
        Los partidos completados construirán la forma cronológica, las rachas actuales y el
        movimiento reciente de calificación.
      </EmptyPanel>
    )
  }
  return (
    <section className="ins-panel">
      <div className="ins-panel-head">
        <div>
          <span className="ins-kicker">Últimos cinco partidos completados</span>
          <h3>Forma actual</h3>
        </div>
        <small>V = victoria, E = empate, D = derrota</small>
      </div>
      <div className="ins-form-list">
        {formRows.map(player => (
          <article className="ins-form-row" key={player.id}>
            <AvatarImage
              src={getPlayerPhoto(player.id)}
              name={player.playerName}
              imgClassName="ins-avatar"
              fallbackClassName="ins-avatar"
            />
            <div className="ins-form-main">
              <strong>{player.playerName}</strong>
              <small>
                {player.played} partidos · racha actual {player.streak.count || 0}{' '}
                {RESULT_LABELS[player.streak.type] || 'resultados'}
                {player.ratingDelta !== null
                  ? ` · tendencia de calificación ${player.ratingDelta >= 0 ? '+' : ''}${player.ratingDelta.toFixed(1)}`
                  : ' · la tendencia de calificación necesita más muestras'}
              </small>
            </div>
            <div className="ins-form-badges" aria-label={`Forma reciente de ${player.playerName}`}>
              {player.lastFive.length ? (
                player.lastFive.map((result, index) => (
                  <span
                    key={`${player.id}-${index}`}
                    className={`ins-result ${result.toLowerCase()}`}
                  >
                    {resultDisplay(result)}
                  </span>
                ))
              ) : (
                <span className="ins-muted">Sin partidos recientes</span>
              )}
            </div>
            <div className="ins-form-rating">
              <span>Calificación reciente</span>
              <strong>{formatRating(player.recentRating)}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function CompareMetric({ label, first, second, formatter = value => value }) {
  const max = Math.max(finiteOr(first, 0), finiteOr(second, 0), 1)
  return (
    <div className="ins-compare-metric">
      <span>{label}</span>
      <div>
        <strong>{formatter(first)}</strong>
        <Meter value={(finiteOr(first, 0) / max) * 100} label={`${label} del primer jugador`} />
      </div>
      <div>
        <strong>{formatter(second)}</strong>
        <Meter value={(finiteOr(second, 0) / max) * 100} label={`${label} del segundo jugador`} />
      </div>
    </div>
  )
}

function CompareView({
  stats,
  comparison,
  firstId,
  setFirstId,
  secondId,
  setSecondId,
  getPlayerPhoto,
}) {
  return (
    <div className="ins-compare">
      <div className="ins-selectors">
        <label>
          Jugador
          <select
            aria-label="Jugador"
            value={firstId}
            onChange={event => setFirstId(event.target.value)}
          >
            <option value="">Selecciona un jugador</option>
            {stats.map(player => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Comparar con
          <select
            aria-label="Comparar con"
            value={secondId}
            onChange={event => setSecondId(event.target.value)}
          >
            <option value="">Vista individual</option>
            {stats
              .filter(player => player.id !== firstId)
              .map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {!firstId ? (
        <EmptyPanel title="Elige un jugador">
          Selecciona un jugador para un análisis de perfil o agrega un segundo jugador para una
          comparación directa.
        </EmptyPanel>
      ) : comparison ? (
        <div className="ins-grid-two">
          <section className="ins-panel">
            <div className="ins-profile-head">
              <AvatarImage
                src={getPlayerPhoto(comparison.first.id)}
                name={comparison.firstName}
                imgClassName="ins-profile-avatar"
                fallbackClassName="ins-profile-avatar"
              />
              <div>
                <span className="ins-kicker">Análisis del jugador</span>
                <h3>{comparison.firstName}</h3>
                <p>
                  {comparison.first.played} partidos completados · {formatRecord(comparison.first)}
                </p>
              </div>
            </div>
            <div className="ins-stat-grid">
              <StatCard
                label="Efectividad"
                value={formatPercent(comparison.first.winRate)}
                note="Los empates cuentan medio"
              />
              <StatCard
                label="Calificación"
                value={comparison.first.avgRating || 'Sin calificación'}
                note="Solo muestras calificadas"
              />
              <StatCard label="MVP" value={comparison.first.mvps || 0} note="Premios confirmados" />
            </div>
            <div className="ins-history-list">
              {comparison.history.map(match => (
                <div className="ins-history-row" key={match.id}>
                  <span className={`ins-result ${match.result.toLowerCase()}`}>{resultDisplay(match.result)}</span>
                  <strong>{match.date || 'Sin fecha'}</strong>
                  <small>{match.venue}</small>
                  <span>{formatRating(match.rating)}</span>
                </div>
              ))}
            </div>
          </section>

          {comparison.second ? (
            <section className="ins-panel">
              <div className="ins-panel-head">
                <div>
                  <span className="ins-kicker">Cara a cara</span>
                  <h3>
                    {comparison.firstName} vs {comparison.secondName}
                  </h3>
                </div>
                <small>Temporada seleccionada</small>
              </div>
              <CompareMetric
                label="Efectividad"
                first={comparison.first.winRate}
                second={comparison.second.winRate}
                formatter={formatPercent}
              />
              <CompareMetric
                label="Calificación"
                first={finiteOr(comparison.first.avgRating, 0)}
                second={finiteOr(comparison.second.avgRating, 0)}
                formatter={value => (value ? Number(value).toFixed(1) : 'Sin calificación')}
              />
              <CompareMetric
                label="MVPs"
                first={comparison.first.mvps || 0}
                second={comparison.second.mvps || 0}
              />
              <CompareMetric
                label="Partidos"
                first={comparison.first.played || 0}
                second={comparison.second.played || 0}
              />
              <div className="ins-h2h-cards">
                <StatCard
                  label="Juntos"
                  value={`${formatPercent(calculateWinRate(comparison.shared.together.wins, comparison.shared.together.ties, comparison.shared.together.games))}`}
                  note={`${formatRecord(comparison.shared.together)} · ${comparison.shared.together.games} partidos`}
                />
                <StatCard
                  label="En contra"
                  value={`${comparison.shared.against.firstWins}-${comparison.shared.against.secondWins}`}
                  note={`${comparison.shared.against.games} partidos · ${comparison.shared.against.ties} empates`}
                />
              </div>
            </section>
          ) : (
            <EmptyPanel title="Agrega otro jugador">
              La vista individual está lista. Agrega un segundo jugador para comparar tasas,
              muestras e historial directo.
            </EmptyPanel>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function InsightsTab() {
  const {
    seasonMatches,
    matches,
    players = [],
    ratings = {},
    selectedSeason,
    getPlayerName,
    getPlayerPhoto,
  } = useApp()
  const { stats = [] } = useStats()
  const [activeView, setActiveView] = useState('teams')
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const completedMatches = useMemo(
    () => [...(seasonMatches || matches || [])].filter(hasResult).sort(compareMatchChronology),
    [seasonMatches, matches]
  )
  const playerName = useCallback(
    id =>
      getPlayerName?.(id) || players.find(player => player.id === id)?.name || 'Jugador desconocido',
    [getPlayerName, players]
  )
  const playerPhoto = useCallback(id => getPlayerPhoto?.(id), [getPlayerPhoto])

  const combos = useMemo(
    () => buildCombos(completedMatches, playerName),
    [completedMatches, playerName]
  )
  const roleGroups = useMemo(
    () => buildRoleRows(completedMatches, ratings, playerName),
    [completedMatches, ratings, playerName]
  )
  const formRows = useMemo(
    () => buildFormRows(completedMatches, ratings, stats, playerName),
    [completedMatches, ratings, stats, playerName]
  )
  const comparison = useMemo(
    () => buildComparison(completedMatches, ratings, stats, firstId, secondId, playerName),
    [completedMatches, ratings, stats, firstId, secondId, playerName]
  )

  const activePlayers = stats.filter(player => player.played > 0).length
  const roleSamples = roleGroups.reduce(
    (sum, group) => sum + group.entries.reduce((groupSum, entry) => groupSum + entry.played, 0),
    0
  )

  return (
    <section className="stats-section ins-page">
      <header className="ins-header">
        <div>
          <span className="ins-kicker">Estadísticas del club</span>
          <h2 className="section-title">Patrones detrás de la tabla</h2>
          <p className="section-subtitle">
            {selectedSeason === 'all'
              ? 'Análisis de todos los partidos completados. La efectividad siempre cuenta los empates como media victoria.'
              : `Análisis de la temporada ${selectedSeason}. La efectividad siempre cuenta los empates como media victoria.`}
          </p>
        </div>
        <div className="ins-summary">
          <StatCard
            label="Partidos completados"
            value={completedMatches.length}
            note="Historial seleccionado"
          />
          <StatCard label="Jugadores seguidos" value={activePlayers} note="Con datos de partidos" />
          <StatCard label="Muestras por rol" value={roleSamples} note="Registros de posición" />
        </div>
      </header>

      <nav className="ins-tabs" aria-label="Secciones de estadísticas">
        {VIEW_TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            className={activeView === tab.id ? 'active' : ''}
            aria-current={activeView === tab.id ? 'page' : undefined}
            onClick={() => setActiveView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <details className="ins-rule-note">
        <summary>Cómo leer estas estadísticas</summary>
        <span>
          Solo se cuentan partidos completados. Un empate suma 0.5 victorias a la efectividad. Los
          las clasificaciones muestran tamaños de muestra para que las rachas cortas y los periodos por rol
          mantengan contexto.
        </span>
      </details>

      {activeView === 'teams' ? <TeamsView combos={combos} getPlayerPhoto={playerPhoto} /> : null}
      {activeView === 'roles' ? (
        <RolesView roleGroups={roleGroups} getPlayerPhoto={playerPhoto} />
      ) : null}
      {activeView === 'form' ? <FormView formRows={formRows} getPlayerPhoto={playerPhoto} /> : null}
      {activeView === 'compare' ? (
        <CompareView
          stats={stats}
          comparison={comparison}
          firstId={firstId}
          setFirstId={setFirstId}
          secondId={secondId}
          setSecondId={setSecondId}
          getPlayerPhoto={playerPhoto}
        />
      ) : null}
    </section>
  )
}

export default InsightsTab
