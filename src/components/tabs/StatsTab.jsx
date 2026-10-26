/**
 * Stats Tab — Ranking
 *
 * One metric at a time on phones (chosen with the chips, which also sort), the
 * full set from 768px up. No horizontal scrolling at any width: the extra
 * numbers live in the row expansion instead of in columns nobody can reach.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../contexts'
import { AvatarImage, AppIcon, EmptyState } from '../common'
import { isPredictionCorrect } from '../../hooks/useStats'

const PREDICTION_BONUS = 0.2

const METRICS = [
  { id: 'rankingScore', short: 'PTS', label: 'PTS', hint: 'Puntos de clasificación · calificación 45% · MVP 25% · efectividad 20% · participación 10%' },
  { id: 'played', short: 'PJ', label: 'PJ', hint: 'Partidos jugados en el período seleccionado' },
  { id: 'wins', short: 'V', label: 'V', hint: 'Partidos ganados en el período seleccionado' },
  { id: 'winRate', short: 'WR', label: 'WR%', hint: 'Porcentaje de efectividad (los empates suman medio partido)' },
  { id: 'avgRating', short: '★', label: '★ Calif.', hint: 'Promedio de las calificaciones recibidas de sus compañeros' },
  { id: 'mvps', short: 'MVP', label: 'MVP', hint: 'Veces elegido como jugador más valioso (MVP) del partido' },
]

const TABLE_COLUMNS = [
  { id: 'rankingScore', label: 'PTS', title: 'Puntos de Ranking' },
  { id: 'played', label: 'PJ', title: 'Partidos Jugados' },
  { id: 'wins', label: 'V', title: 'Victorias' },
  { id: 'ties', label: 'E', title: 'Empates' },
  { id: 'losses', label: 'D', title: 'Derrotas' },
  { id: 'winRate', label: 'WR%', title: 'Porcentaje de Efectividad' },
  { id: 'avgRating', label: '★ Calif.', title: 'Calificación Promedio' },
  { id: 'mvps', label: 'MVP', title: 'Premios MVP' },
]

const readStored = (key, fallback) => {
  try {
    return localStorage.getItem(key) || fallback
  } catch {
    return fallback
  }
}

const writeStored = (key, value) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Ignore */
  }
}

function HistoryModal({ open, title, onClose, children }) {
  const listRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: 'auto' })
    })

    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="weekly-history-overlay" onClick={onClose}>
      <div className="weekly-history-sheet" onClick={e => e.stopPropagation()}>
        <div className="weekly-history-sheet-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="weekly-history-list" ref={listRef}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

export const StatsTab = ({
  stats,
  playerOfWeek,
  playerOfMonth,
  weeklyHistory = [],
  monthlyHistory = [],
  onPlayerClick,
  calculateXP,
  getRank,
  getRankIcon,
  getWinRateClass,
  getRatingClass,
  playerFormMap = {},
}) => {
  const {
    players,
    matches,
    ratings,
    predictions,
    userLinks,
    userPlayer,
    timeFilter,
    setTimeFilter,
    getPlayerPhoto,
  } = useApp()

  const [metric, setMetric] = useState(() => {
    const saved = readStored('lukto_stats_metric', 'rankingScore')
    return METRICS.some(m => m.id === saved) ? saved : 'rankingScore'
  })
  const [expandedId, setExpandedId] = useState(null)
  const [showWeekHistory, setShowWeekHistory] = useState(false)
  const lastWeekHistoryOpenAt = useRef(0)
  const [showMonthHistory, setShowMonthHistory] = useState(false)
  const lastMonthHistoryOpenAt = useRef(0)

  const potwPlayer = playerOfWeek ? players.find(p => p.id === playerOfWeek.id) : null
  const potmPlayer = playerOfMonth ? players.find(p => p.id === playerOfMonth.id) : null

  const normalizedWeeklyHistory = useMemo(() => {
    if (!weeklyHistory?.length) return []
    return weeklyHistory.map(entry => ({
      ...entry,
      weekStart: new Date(entry.weekStart),
      weekEnd: new Date(entry.weekEnd),
    }))
  }, [weeklyHistory])

  const currentWeekKey = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    d.setHours(0, 0, 0, 0)
    return d.toISOString().split('T')[0]
  }, [])

  const sortedStats = useMemo(() => {
    const value = (player) => {
      switch (metric) {
        case 'played': return player.played || 0
        case 'wins': return player.wins || 0
        case 'ties': return player.ties || 0
        case 'losses': return player.losses || 0
        case 'winRate': return typeof player.winRate === 'number' ? player.winRate : parseFloat(player.winRate) || 0
        case 'avgRating': return parseFloat(player.avgRating) || 0
        case 'mvps': return player.mvps || 0
        default: return parseFloat(player.rankingScore) || 0
      }
    }
    return [...stats].sort((a, b) => value(b) - value(a) || parseFloat(b.rankingScore) - parseFloat(a.rankingScore))
  }, [stats, metric])

  const selectMetric = (id) => {
    setMetric(id)
    writeStored('lukto_stats_metric', id)
  }

  const toggleRow = (id) => {
    setExpandedId(current => (current === id ? null : id))
  }

  const activeMetric = METRICS.find(m => m.id === metric) || TABLE_COLUMNS.find(c => c.id === metric) || METRICS[0]

  // Per-match rating breakdown for the expanded row. This is what the old
  // "Rating" tab showed; it now lives where the player already is.
  const getMatchRatings = (playerId) => {
    const playerRatings = ratings?.[playerId] || []
    if (playerRatings.length === 0) return []

    const linkedUserId = Object.entries(userLinks || {}).find(
      ([, link]) => link?.playerId === playerId
    )?.[0]

    const byMatch = new Map()
    playerRatings.forEach(r => {
      if (!r.matchId) return
      if (!byMatch.has(r.matchId)) byMatch.set(r.matchId, [])
      byMatch.get(r.matchId).push(r)
    })

    return Array.from(byMatch.entries())
      .map(([matchId, list]) => {
        const match = matches.find(m => m.id === matchId)
        const sum = list.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
        const base = sum / list.length
        const bonus =
          linkedUserId && match?.winner && isPredictionCorrect(linkedUserId, matchId, match.winner, predictions)
            ? PREDICTION_BONUS
            : 0
        return {
          matchId,
          match,
          votes: list.length,
          average: (base + bonus).toFixed(1),
          hasBonus: bonus > 0,
        }
      })
      .sort((a, b) => new Date(b.match?.date || 0) - new Date(a.match?.date || 0))
      .slice(0, 5)
  }

  const formatMatchDate = (dateStr) => {
    if (!dateStr) return 'Partido eliminado'
    const date = new Date(`${dateStr}T12:00:00`)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <section className="stats-section" aria-label="Ranking de jugadores">

      {/* ── Destacados Card (Semana + Mes fusionados) ── */}
      <div
        className="destacados-card"
        style={playerOfWeek ? { '--potm-photo': `url(${getPlayerPhoto(playerOfWeek.id)})` } : {}}
      >
        {playerOfWeek && <div className="potm-bg-blur" />}

        {/* Semana row */}
        <div
          className="destacados-row clickable"
          role="button"
          tabIndex={0}
          onClick={() => { lastWeekHistoryOpenAt.current = Date.now(); setShowWeekHistory(true) }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              lastWeekHistoryOpenAt.current = Date.now()
              setShowWeekHistory(true)
            }
          }}
        >
          <span className="destacados-badge week">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Semana
          </span>
          {playerOfWeek && potwPlayer ? (
            <>
              <AvatarImage
                src={getPlayerPhoto(playerOfWeek.id)}
                name={potwPlayer.name}
                imgClassName="destacados-avatar"
                fallbackClassName="destacados-avatar-ph"
              />
              <div className="destacados-info">
                <span className="destacados-name">{potwPlayer.name}</span>
                <span className="destacados-rec">{playerOfWeek.wins}V · {playerOfWeek.ties || 0}E · {playerOfWeek.losses || 0}D</span>
              </div>
              <span className="destacados-rating">{playerOfWeek.avgRating || '—'} ★</span>
            </>
          ) : <span className="destacados-empty">Sin datos esta semana</span>}
        </div>

        {/* Divider */}
        <div className="destacados-divider" />

        {/* Mes row */}
        <div
          className="destacados-row clickable"
          role="button"
          tabIndex={0}
          onClick={() => { lastMonthHistoryOpenAt.current = Date.now(); setShowMonthHistory(true) }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              lastMonthHistoryOpenAt.current = Date.now()
              setShowMonthHistory(true)
            }
          }}
        >
          <span className="destacados-badge month">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="9" height="9">
              <path d="M7 4h10v4a5 5 0 01-10 0V4zM4 6H2a2 2 0 002 2h1M20 6h2a2 2 0 01-2 2h-1M12 13v7M8 20h8" />
            </svg>
            Mes
          </span>
          {playerOfMonth && potmPlayer ? (
            <>
              <AvatarImage
                src={getPlayerPhoto(playerOfMonth.id)}
                name={potmPlayer.name}
                imgClassName="destacados-avatar"
                fallbackClassName="destacados-avatar-ph"
              />
              <div className="destacados-info">
                <span className="destacados-name">{potmPlayer.name}</span>
                <span className="destacados-rec">{playerOfMonth.wins}V · {playerOfMonth.ties || 0}E · {playerOfMonth.losses || 0}D</span>
              </div>
              <span className="destacados-rating">{playerOfMonth.avgRating || '—'} ★</span>
            </>
          ) : <span className="destacados-empty">Sin datos este mes</span>}
        </div>
      </div>

      {/* ── Modals ── */}
      <HistoryModal
        open={showWeekHistory}
        title="Jugadores de la Semana"
        onClose={() => {
          if (Date.now() - lastWeekHistoryOpenAt.current < 350) return
          setShowWeekHistory(false)
        }}
      >
        {normalizedWeeklyHistory.length === 0 ? (
          <p className="weekly-history-empty">Aún no hay semanas con datos.</p>
        ) : normalizedWeeklyHistory.map(entry => {
          const winner = entry.winner ? players.find(p => p.id === entry.winner.id) : null
          const dateLabel = `${entry.weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${entry.weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
          const isCurrent = entry.weekStart.toISOString().split('T')[0] === currentWeekKey

          return (
            <div key={entry.weekStart.toISOString()} className="weekly-history-item">
              <div className="weekly-history-dates">{dateLabel}{isCurrent ? ' · Actual' : ''}</div>
              {winner ? (
                <div className="weekly-history-winner">
                  <AvatarImage src={getPlayerPhoto(entry.winner.id)} name={winner.name} imgClassName="weekly-history-avatar" fallbackClassName="weekly-history-avatar-placeholder" />
                  <div className="weekly-history-info">
                    <span className="weekly-history-name">{winner.name}</span>
                    <span className="weekly-history-stats">{entry.winner.wins}V {entry.winner.ties || 0}E {entry.winner.losses || 0}D · {entry.winner.winRate}%</span>
                  </div>
                </div>
              ) : <div className="weekly-history-none">Sin datos suficientes</div>}
            </div>
          )
        })}
      </HistoryModal>

      <HistoryModal
        open={showMonthHistory}
        title="Jugadores del Mes"
        onClose={() => {
          if (Date.now() - lastMonthHistoryOpenAt.current < 350) return
          setShowMonthHistory(false)
        }}
      >
        {monthlyHistory.length === 0 ? (
          <p className="weekly-history-empty">Aún no hay meses con datos.</p>
        ) : monthlyHistory.map(entry => {
          const winner = entry.winner ? players.find(p => p.id === entry.winner.id) : null

          return (
            <div key={entry.key} className="weekly-history-item">
              <div className="weekly-history-dates">{entry.monthLabel}</div>
              {winner ? (
                <div className="weekly-history-winner">
                  <AvatarImage src={getPlayerPhoto(entry.winner.id)} name={winner.name} imgClassName="weekly-history-avatar" fallbackClassName="weekly-history-avatar-placeholder" />
                  <div className="weekly-history-info">
                    <span className="weekly-history-name">{winner.name}</span>
                    <span className="weekly-history-stats">{entry.winner.wins}V {entry.winner.ties || 0}E {entry.winner.losses || 0}D · {entry.winner.winRate}%</span>
                  </div>
                </div>
              ) : <div className="weekly-history-none">Sin datos suficientes</div>}
            </div>
          )
        })}
      </HistoryModal>

      {/* ── Ranking ── */}
      <div className="ranking-section">

        {/* Period segmented control */}
        <div className="rk-period" role="tablist" aria-label="Período">
          {[
            { id: 'all', label: 'Todo' },
            { id: 'month', label: 'Mes' },
            { id: 'week', label: 'Semana' },
          ].map(option => (
            <button
              key={option.id}
              role="tab"
              aria-selected={timeFilter === option.id}
              className={`rk-period-btn ${timeFilter === option.id ? 'active' : ''}`}
              onClick={() => setTimeFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Metric chips */}
        <div className="rk-metrics-wrap">
          <span className="rk-metrics-label">Ordenar por</span>
          <div className="rk-metrics">
            {METRICS.map(item => (
              <button
                key={item.id}
                className={`rk-chip ${metric === item.id ? 'active' : ''}`}
                onClick={() => selectMetric(item.id)}
                aria-pressed={metric === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className="rk-metric-hint">{activeMetric.hint || `Ordenado por ${activeMetric.title || activeMetric.label}`}</p>

        {sortedStats.length > 0 ? (
          <div className="rk-list">
            <div className="rk-table-head">
              <span className="rk-head-spacer">#</span>
              <span className="rk-head-player">Jugador</span>
              {TABLE_COLUMNS.map(col => (
                <button
                  key={col.id}
                  type="button"
                  className={`rk-th-btn ${metric === col.id ? 'active' : ''}`}
                  onClick={() => selectMetric(col.id)}
                  title={`Ordenar por ${col.title}`}
                >
                  {col.label}
                </button>
              ))}
              <span className="rk-head-form" title="Últimos 5 partidos">Forma</span>
              <span />
            </div>
            {sortedStats.map((player, index) => {
              const xp = calculateXP(player.id)
              const rank = getRank(xp)
              const wr = typeof player.winRate === 'number' ? player.winRate : parseFloat(player.winRate) || 0
              const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''
              const isMe = userPlayer && player.id === userPlayer
              const isOpen = expandedId === player.id
              const form = playerFormMap[player.id] || []

              return (
                <article key={player.id} className={`rk-row ${medal} ${isMe ? 'is-me' : ''} ${isOpen ? 'is-open' : ''}`}>
                  <button
                    className="rk-row-main"
                    onClick={() => toggleRow(player.id)}
                    aria-expanded={isOpen}
                    aria-label={`${player.name}, posición ${index + 1}, ${player.rankingScore} puntos, ${player.played || 0} partidos jugados, ${player.wins || 0} victorias, ${player.ties || 0} empates, ${player.losses || 0} derrotas, ${wr.toFixed(0)} por ciento de efectividad y ${player.mvps || 0} MVPs; ${isOpen ? 'contraer' : 'expandir'} detalles`}
                  >
                    <span className="rk-mark" aria-hidden="true" />
                    <span className={`rk-pos ${medal}`}>{index + 1}</span>

                    <AvatarImage
                      src={getPlayerPhoto(player.id)}
                      name={player.name}
                      imgClassName="rk-avatar"
                      fallbackClassName="rk-avatar-ph"
                    />

                    <span className="rk-identity">
                      <span className="rk-name">{player.name}</span>
                      <span className="rk-sub">
                        {getRankIcon(rank.key, 9)} {rank.name}
                        <span className="rk-xp">· {xp} XP</span>
                        {isMe && <span className="rk-you">Tú</span>}
                      </span>
                    </span>

                    <span className="rk-mobile-right">
                      {form.length > 0 && (
                        <span className="rk-mobile-form" aria-label="Forma en los últimos partidos">
                          {form.map((r, i) => (
                            <span key={i} className={`form-badge ${r}`}>{r === 'v' ? 'V' : r === 'e' ? 'E' : 'D'}</span>
                          ))}
                        </span>
                      )}
                      <span className={`rk-mobile-pts ${metric === 'rankingScore' ? 'active' : ''}`}>
                        <span className="rk-mobile-pts-val">{player.rankingScore}</span>
                        <span className="rk-mobile-pts-lbl">PTS</span>
                      </span>
                      <span className={`rk-chevron rk-mobile-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">
                        <AppIcon name="arrowDown" size={14} />
                      </span>
                    </span>

                    <span className="rk-mobile-grid" aria-label={`Estadísticas: ${player.played || 0} jugados, ${player.wins || 0} victorias, ${player.ties || 0} empates, ${player.losses || 0} derrotas, ${wr.toFixed(0)}% efectividad, calificación ${player.avgRating || 'sin datos'}, ${player.mvps || 0} MVPs`}>
                      <span className={`rk-mcell ${metric === 'played' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">PJ</span>
                        <span className="rk-mcell-val">{player.played || 0}</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'wins' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">V</span>
                        <span className="rk-mcell-val win">{player.wins || 0}</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'ties' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">E</span>
                        <span className="rk-mcell-val tie">{player.ties || 0}</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'losses' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">D</span>
                        <span className="rk-mcell-val loss">{player.losses || 0}</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'winRate' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">WR%</span>
                        <span className={`rk-mcell-val ${getWinRateClass(wr)}`}>{wr.toFixed(0)}%</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'avgRating' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">★ Cal.</span>
                        <span className={`rk-mcell-val ${getRatingClass(player.avgRating ? parseFloat(player.avgRating) : 0)}`}>{player.avgRating || '—'}</span>
                      </span>
                      <span className={`rk-mcell ${metric === 'mvps' ? 'active' : ''}`}>
                        <span className="rk-mcell-key">MVP</span>
                        <span className={`rk-mcell-val ${player.mvps > 0 ? 'mvp' : ''}`}>{player.mvps || 0}</span>
                      </span>
                    </span>

                    <span className={`rk-cell pts ${metric === 'rankingScore' ? 'active' : ''}`}>
                      <span className="rk-cell-key">PTS</span>
                      <span className="rk-cell-value">{player.rankingScore}</span>
                    </span>
                    <span className={`rk-cell ${metric === 'played' ? 'active' : ''}`}>
                      <span className="rk-cell-key">PJ</span>
                      <span className="rk-cell-value">{player.played || 0}</span>
                    </span>
                    <span className={`rk-cell ${metric === 'wins' ? 'active' : ''}`}>
                      <span className="rk-cell-key">V</span>
                      <span className="rk-cell-value win">{player.wins || 0}</span>
                    </span>
                    <span className={`rk-cell ${metric === 'ties' ? 'active' : ''}`}>
                      <span className="rk-cell-key">E</span>
                      <span className="rk-cell-value tie">{player.ties || 0}</span>
                    </span>
                    <span className={`rk-cell ${metric === 'losses' ? 'active' : ''}`}>
                      <span className="rk-cell-key">D</span>
                      <span className="rk-cell-value loss">{player.losses || 0}</span>
                    </span>
                    <span className={`rk-cell ${metric === 'winRate' ? 'active' : ''}`}>
                      <span className="rk-cell-key">WR%</span>
                      <span className={`rk-cell-value ${getWinRateClass(wr)}`}>{wr.toFixed(0)}%</span>
                    </span>
                    <span className={`rk-cell ${metric === 'avgRating' ? 'active' : ''}`}>
                      <span className="rk-cell-key">★</span>
                      <span className={`rk-cell-value ${getRatingClass(player.avgRating ? parseFloat(player.avgRating) : 0)}`}>
                        {player.avgRating || '—'}
                      </span>
                    </span>
                    <span className={`rk-cell ${metric === 'mvps' ? 'active' : ''}`}>
                      <span className="rk-cell-key">MVP</span>
                      <span className={`rk-cell-value ${player.mvps > 0 ? 'mvp' : ''}`}>{player.mvps || 0}</span>
                    </span>

                    <span className="rk-form" aria-label="Forma en los últimos partidos">
                      {form.length > 0 ? form.map((r, i) => (
                        <span key={i} className={`form-badge ${r}`}>{r === 'v' ? 'V' : r === 'e' ? 'E' : 'D'}</span>
                      )) : <span className="rk-form-empty">—</span>}
                    </span>

                    <span className={`rk-chevron rk-desktop-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">
                      <AppIcon name="arrowDown" size={14} />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="rk-detail">
                      <div className="rk-detail-grid">
                        <div className="rk-stat"><span className="rk-stat-value pts">{player.rankingScore}</span><span className="rk-stat-key">PTS</span></div>
                        <div className="rk-stat"><span className="rk-stat-value">{player.played || 0}</span><span className="rk-stat-key">Partidos</span></div>
                        <div className="rk-stat"><span className="rk-stat-value win">{player.wins || 0}</span><span className="rk-stat-key">Victorias</span></div>
                        <div className="rk-stat"><span className="rk-stat-value tie">{player.ties || 0}</span><span className="rk-stat-key">Empates</span></div>
                        <div className="rk-stat"><span className="rk-stat-value loss">{player.losses || 0}</span><span className="rk-stat-key">Derrotas</span></div>
                        <div className="rk-stat"><span className={`rk-stat-value ${getWinRateClass(wr)}`}>{wr.toFixed(0)}%</span><span className="rk-stat-key">Win rate</span></div>
                        <div className="rk-stat"><span className={`rk-stat-value ${getRatingClass(player.avgRating ? parseFloat(player.avgRating) : 0)}`}>{player.avgRating || '—'}</span><span className="rk-stat-key">★ Calif.</span></div>
                        <div className="rk-stat"><span className={`rk-stat-value ${player.mvps > 0 ? 'mvp' : ''}`}>{player.mvps || 0}</span><span className="rk-stat-key">MVP</span></div>
                      </div>

                      {(() => {
                        const matchRatings = getMatchRatings(player.id)
                        if (matchRatings.length === 0) {
                          return <p className="rk-detail-empty">Todavía no tiene calificaciones por partido.</p>
                        }
                        return (
                          <div className="rk-ratings">
                            <span className="rk-detail-title">Últimas calificaciones</span>
                            {matchRatings.map(row => (
                              <div key={row.matchId} className="rk-rating-row">
                                <span className="rk-rating-date">{formatMatchDate(row.match?.date)}</span>
                                <span className="rk-rating-votes">{row.votes} {row.votes === 1 ? 'voto' : 'votos'}</span>
                                <span className={`rk-rating-avg ${getRatingClass(parseFloat(row.average))}`}>
                                  {row.average}
                                  {row.hasBonus && <span className="rk-rating-bonus" title={`+${PREDICTION_BONUS} por predicción correcta`}>+</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      })()}

                      <button className="rk-profile-btn" onClick={() => onPlayerClick(player.id)}>
                        Ver perfil completo
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            type="noStats"
            title="Sin estadísticas"
            description={timeFilter !== 'all' ? 'No hay partidos en este período' : 'Agrega partidos para ver las estadísticas'}
          />
        )}
      </div>
    </section>
  )
}

export default StatsTab
