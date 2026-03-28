/**
 * Stats Tab — Premium Redesign v2
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../contexts'
import { AvatarImage, AppIcon, EmptyState } from '../common'

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
  announcements,
  playerFormMap = {},
}) => {
  const { players, timeFilter, setTimeFilter, getPlayerPhoto } = useApp()

  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem('lukto_stats_sortBy') || 'rankingScore' } catch { return 'rankingScore' }
  })
  const [sortDir, setSortDir] = useState(() => {
    try { return localStorage.getItem('lukto_stats_sortDir') || 'desc' } catch { return 'desc' }
  })
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

  const filteredStats = useMemo(() => {
    let result = [...stats]
    result.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name': aVal = a.name?.toLowerCase() || ''; bVal = b.name?.toLowerCase() || ''; break
        case 'winRate': aVal = a.winRate || 0; bVal = b.winRate || 0; break
        case 'wins': aVal = a.wins || 0; bVal = b.wins || 0; break
        case 'mvps': aVal = a.mvps || 0; bVal = b.mvps || 0; break
        case 'avgRating': aVal = parseFloat(a.avgRating) || 0; bVal = parseFloat(b.avgRating) || 0; break
        case 'xp': aVal = calculateXP(a.id) || 0; bVal = calculateXP(b.id) || 0; break
        default: aVal = parseFloat(a.rankingScore) || 0; bVal = parseFloat(b.rankingScore) || 0
      }
      if (sortBy === 'name') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    return result
  }, [stats, sortBy, sortDir, calculateXP])

  const toggleSort = (col) => {
    const newDir = sortBy === col && sortDir === 'desc' ? 'asc' : 'desc'
    setSortBy(col)
    setSortDir(newDir)
    try { localStorage.setItem('lukto_stats_sortBy', col); localStorage.setItem('lukto_stats_sortDir', newDir) } catch {}
  }

  const SortArrow = ({ col }) => sortBy === col
    ? <span className="sth-arrow">{sortDir === 'desc' ? '↓' : '↑'}</span>
    : null

  return (
    <section className="stats-section">

      {/* Announcement */}
      {announcements?.length > 0 && (
        <div className="user-announcement">
          <div className="user-announcement-icon"><AppIcon name="info" size={16} /></div>
          <p className="user-announcement-text">{announcements[0].message}</p>
        </div>
      )}

      {/* ── Destacados Card (Semana + Mes fusionados) ── */}
      <div
        className="destacados-card"
        style={playerOfWeek ? { '--potm-photo': `url(${getPlayerPhoto(playerOfWeek.id)})` } : {}}
      >
        {playerOfWeek && <div className="potm-bg-blur" />}

        {/* Semana row */}
        <div
          className="destacados-row clickable"
          onClick={() => { lastWeekHistoryOpenAt.current = Date.now(); setShowWeekHistory(true) }}
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
          onClick={() => { lastMonthHistoryOpenAt.current = Date.now(); setShowMonthHistory(true) }}
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

        {/* Filter pills inside ranking section */}
        <div className="rg-filter-bar">
          {['all', 'month', 'week'].map(f => (
            <button
              key={f}
              className={`rg-filter-pill ${timeFilter === f ? 'active' : ''}`}
              onClick={() => setTimeFilter(f)}
            >
              {f === 'all' ? 'Todo' : f === 'month' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>

        {/* Horizontally scrollable table */}
        <div className="rg-scroll-wrap">

        {/* Grid header — aligns 1:1 with each row */}
        <div className="rg-header">
          <span className="rg-h-pos">#</span>
          <span className="rg-h-player">Jugador</span>
          <button className={`rg-h-btn ${sortBy === 'rankingScore' ? 'active' : ''}`} onClick={() => toggleSort('rankingScore')}>
            PTS<SortArrow col="rankingScore" />
          </button>
          <button className={`rg-h-btn ${sortBy === 'winRate' ? 'active' : ''}`} onClick={() => toggleSort('winRate')}>
            WR<SortArrow col="winRate" />
          </button>
          <button className={`rg-h-btn ${sortBy === 'wins' ? 'active' : ''}`} onClick={() => toggleSort('wins')}>
            V<SortArrow col="wins" />
          </button>
          <span className="rg-h-btn">E</span>
          <span className="rg-h-btn">D</span>
          <button className={`rg-h-btn ${sortBy === 'avgRating' ? 'active' : ''}`} onClick={() => toggleSort('avgRating')}>
            ★<SortArrow col="avgRating" />
          </button>
          <button className={`rg-h-btn ${sortBy === 'mvps' ? 'active' : ''}`} onClick={() => toggleSort('mvps')}>
            MVP<SortArrow col="mvps" />
          </button>
          <span className="rg-h-form">Forma</span>
        </div>

        {filteredStats.length > 0 ? (
          <div className="rank-list">
            {filteredStats.map((player, index) => {
              const xp = calculateXP(player.id)
              const rank = getRank(xp)
              const wr = typeof player.winRate === 'number' ? player.winRate : parseFloat(player.winRate) || 0
              const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : ''

              return (
                <article
                  key={player.id}
                  className={`rg-row ${medal}`}
                  onClick={() => onPlayerClick(player.id)}
                >
                  {/* Position bubble */}
                  <span className={`rg-pos ${medal}`}>{index + 1}</span>

                  {/* Avatar + name */}
                  <div className="rg-player">
                    <AvatarImage
                      src={getPlayerPhoto(player.id)}
                      name={player.name}
                      imgClassName="rg-avatar"
                      fallbackClassName="rg-avatar-ph"
                    />
                    <div className="rg-player-info">
                      <span className="rg-name">{player.name}</span>
                      <span className="rg-sub">{getRankIcon(rank.key, 9)} {rank.name}</span>
                    </div>
                  </div>

                  {/* Stat columns — must match header grid exactly */}
                  <span className={`rg-stat pts ${sortBy === 'rankingScore' ? 'sorted' : ''}`}>
                    {player.rankingScore}
                  </span>
                  <span className={`rg-stat wr ${getWinRateClass(wr)} ${sortBy === 'winRate' ? 'sorted' : ''}`}>
                    {wr.toFixed(0)}%
                  </span>
                  <span className={`rg-stat v ${sortBy === 'wins' ? 'sorted' : ''}`}>
                    {player.wins}
                  </span>
                  <span className="rg-stat e">{player.ties || 0}</span>
                  <span className="rg-stat d">{player.losses || 0}</span>
                  <span className={`rg-stat rat ${getRatingClass(player.avgRating ? parseFloat(player.avgRating) : 0)} ${sortBy === 'avgRating' ? 'sorted' : ''}`}>
                    {player.avgRating || '—'}
                  </span>
                  <span className={`rg-stat mvp ${player.mvps > 0 ? 'has' : ''} ${sortBy === 'mvps' ? 'sorted' : ''}`}>
                    {player.mvps > 0 ? player.mvps : '—'}
                  </span>
                  <div className="rg-form">
                    {(playerFormMap[player.id] || []).map((r, i) => (
                      <span key={i} className={`form-badge ${r}`}>{r === 'v' ? 'V' : r === 'e' ? 'E' : 'D'}</span>
                    ))}
                  </div>
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

        </div>{/* /rg-scroll-wrap */}
      </div>
    </section>
  )
}

export default StatsTab
