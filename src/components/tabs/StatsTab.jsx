/**
 * Stats Tab Component
 * Shows ranking table and featured players
 */

import { useState, useMemo, useRef } from 'react'
import { useApp } from '../../contexts'
import { AvatarImage, EmptyState } from '../common'

export const StatsTab = ({
  stats,
  playerOfWeek,
  playerOfMonth,
  weeklyHistory = [],
  onPlayerClick,
  calculateXP,
  getRank,
  getRankIcon,
  getWinRateClass,
  getRatingClass,
  announcements,
}) => {
  const { players, timeFilter, getPlayerPhoto } = useApp()
  
  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('rankingScore')
  const [sortDir, setSortDir] = useState('desc')
  const [showWeekHistory, setShowWeekHistory] = useState(false)
  const lastWeekHistoryOpenAt = useRef(0)

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

  // Filter and sort stats
  const filteredStats = useMemo(() => {
    let result = [...stats]
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(p => p.name?.toLowerCase().includes(query))
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal, bVal
      switch (sortBy) {
        case 'name':
          aVal = a.name?.toLowerCase() || ''
          bVal = b.name?.toLowerCase() || ''
          break
        case 'winRate':
          aVal = a.winRate || 0
          bVal = b.winRate || 0
          break
        case 'wins':
          aVal = a.wins || 0
          bVal = b.wins || 0
          break
        case 'mvps':
          aVal = a.mvps || 0
          bVal = b.mvps || 0
          break
        case 'avgRating':
          aVal = parseFloat(a.avgRating) || 0
          bVal = parseFloat(b.avgRating) || 0
          break
        case 'xp':
          aVal = calculateXP(a.id) || 0
          bVal = calculateXP(b.id) || 0
          break
        default:
          aVal = parseFloat(a.rankingScore) || 0
          bVal = parseFloat(b.rankingScore) || 0
      }
      
      if (sortBy === 'name') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
    
    return result
  }, [stats, searchQuery, sortBy, sortDir, calculateXP])

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">⇅</span>
    return <span className="sort-icon active">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // Custom SVG icons for sort chips
  const SortIcons = {
    score: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
      </svg>
    ),
    winRate: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
      </svg>
    ),
    rating: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
      </svg>
    ),
    mvp: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z"/>
      </svg>
    ),
    wins: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
      </svg>
    ),
    xp: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
        <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
      </svg>
    ),
  }

  // Sort options for chips
  const sortOptions = [
    { key: 'rankingScore', label: 'Score', icon: SortIcons.score },
    { key: 'winRate', label: 'Win Rate', icon: SortIcons.winRate },
    { key: 'avgRating', label: 'Rating', icon: SortIcons.rating },
    { key: 'mvps', label: 'MVPs', icon: SortIcons.mvp },
    { key: 'wins', label: 'Victorias', icon: SortIcons.wins },
    { key: 'xp', label: 'XP', icon: SortIcons.xp },
  ]

  return (
    <section className="stats-section">
      {/* Show latest announcement to all users */}
      {announcements?.length > 0 && (
        <div className="user-announcement">
          <div className="user-announcement-icon">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
            </svg>
          </div>
          <p className="user-announcement-text">{announcements[0].message}</p>
        </div>
      )}

      {/* Player of Week / Month Cards */}
      <div className="featured-players">
        {/* Player of the Week */}
        <div
          className="featured-card week clickable"
          role="button"
          tabIndex={0}
          onClick={() => {
            lastWeekHistoryOpenAt.current = Date.now()
            setShowWeekHistory(true)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              lastWeekHistoryOpenAt.current = Date.now()
              setShowWeekHistory(true)
            }
          }}
        >
          <div className="featured-badge">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M7 2v11h3v9l7-12h-4l4-8z" />
            </svg>
            Jugador de la Semana
          </div>
          <div className="featured-content">
            {playerOfWeek && potwPlayer ? (
              <>
                <AvatarImage
                  src={getPlayerPhoto(playerOfWeek.id)}
                  name={potwPlayer?.name || ''}
                  imgClassName="featured-avatar"
                  fallbackClassName="featured-avatar-placeholder"
                />
                <div className="featured-info">
                  <h3>{potwPlayer?.name}</h3>
                  <div className="featured-stats">
                    <span className="stat-item">
                      {playerOfWeek.wins}V {playerOfWeek.played - playerOfWeek.wins}D
                    </span>
                    <span className="stat-item highlight">{playerOfWeek.winRate}%</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="featured-info">
                <h3>Sin datos esta semana</h3>
                <div className="featured-stats">
                  <span className="stat-item">Toca para ver semanas pasadas</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Player of the Month */}
        {playerOfMonth && potmPlayer && (
          <div className="featured-card month">
            <div className="featured-badge">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
              </svg>
              Jugador del Mes
            </div>
            <div className="featured-content">
              <AvatarImage
                src={getPlayerPhoto(playerOfMonth.id)}
                name={potmPlayer?.name || ''}
                imgClassName="featured-avatar"
                fallbackClassName="featured-avatar-placeholder"
              />
              <div className="featured-info">
                <h3>{potmPlayer?.name}</h3>
                <div className="featured-stats">
                  <span className="stat-item">
                    {playerOfMonth.wins}V {playerOfMonth.played - playerOfMonth.wins}D
                  </span>
                  <span className="stat-item highlight">{playerOfMonth.winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showWeekHistory && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (Date.now() - lastWeekHistoryOpenAt.current < 350) return
            setShowWeekHistory(false)
          }}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Jugadores de Semanas Pasadas</h2>
              <button className="modal-close" onClick={() => setShowWeekHistory(false)}>×</button>
            </div>
            <div className="weekly-history-list">
              {normalizedWeeklyHistory.length === 0 ? (
                <p className="weekly-history-empty">Aún no hay semanas pasadas con datos.</p>
              ) : (
                normalizedWeeklyHistory.map(entry => {
                  const winner = entry.winner ? players.find(p => p.id === entry.winner.id) : null
                  const dateLabel = `${entry.weekStart.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${entry.weekEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
                  const isCurrentWeek = entry.weekStart.toISOString().split('T')[0] === currentWeekKey
                  return (
                    <div key={entry.weekStart.toISOString()} className="weekly-history-item">
                      <div className="weekly-history-dates">
                        {dateLabel} {isCurrentWeek ? '· Semana actual' : ''}
                      </div>
                      {winner ? (
                        <div className="weekly-history-winner">
                          <AvatarImage
                            src={getPlayerPhoto(entry.winner.id)}
                            name={winner?.name || ''}
                            imgClassName="weekly-history-avatar"
                            fallbackClassName="weekly-history-avatar-placeholder"
                          />
                          <div className="weekly-history-info">
                            <span className="weekly-history-name">{winner?.name}</span>
                            <span className="weekly-history-stats">
                              {entry.winner.wins}V {entry.winner.played - entry.winner.wins}D · {entry.winner.winRate}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="weekly-history-none">Sin datos suficientes</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      <h2 className="section-title">
        {timeFilter === 'all'
          ? 'Ranking General'
          : timeFilter === 'month'
            ? 'Ranking del Mes'
            : 'Ranking de la Semana'}
      </h2>

      {/* Search Bar */}
      <div className="stats-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          placeholder="Buscar jugador..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="search-clear" onClick={() => setSearchQuery('')}>×</button>
        )}
      </div>

      {/* Sort Chips */}
      <div className="sort-chips">
        <span className="sort-label">Ordenar:</span>
        <div className="sort-chips-scroll">
          {sortOptions.map(opt => (
            <button
              key={opt.key}
              className={`sort-chip ${sortBy === opt.key ? 'active' : ''}`}
              onClick={() => handleSort(opt.key)}
            >
              <span className="sort-chip-icon">{opt.icon}</span>
              <span className="sort-chip-label">{opt.label}</span>
              {sortBy === opt.key && (
                <svg className="sort-chip-arrow" viewBox="0 0 24 24" fill="currentColor" width="10" height="10">
                  {sortDir === 'desc' 
                    ? <path d="M7 10l5 5 5-5H7z"/>
                    : <path d="M7 14l5-5 5 5H7z"/>
                  }
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {filteredStats.length > 0 ? (
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th onClick={() => handleSort('name')} className="sortable">
                Jugador <SortIcon column="name" />
              </th>
              <th className="rank-col"></th>
              <th onClick={() => handleSort('rankingScore')} className="sortable">
                Score <SortIcon column="rankingScore" />
              </th>
              <th onClick={() => handleSort('winRate')} className="sortable">
                WR <SortIcon column="winRate" />
              </th>
              <th className="bar-col"></th>
              <th onClick={() => handleSort('wins')} className="sortable">
                V <SortIcon column="wins" />
              </th>
              <th>D</th>
              <th onClick={() => handleSort('mvps')} className="sortable">
                MVP <SortIcon column="mvps" />
              </th>
              <th onClick={() => handleSort('avgRating')} className="sortable">
                Rat <SortIcon column="avgRating" />
              </th>
              <th onClick={() => handleSort('xp')} className="sortable">
                XP <SortIcon column="xp" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredStats.map((player, index) => {
              const xp = calculateXP(player.id)
              const rank = getRank(xp)
              return (
                <tr key={player.id} onClick={() => onPlayerClick(player.id)} className="clickable-row">
                  <td>
                    <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                  </td>
                  <td>
                    <div className="player-name">
                      <AvatarImage
                        src={getPlayerPhoto(player.id)}
                        name={player.name}
                        imgClassName="player-avatar-img"
                        fallbackClassName="player-avatar"
                      />
                      {player.name}
                    </div>
                  </td>
                  <td>
                    <span className="rank-icon-cell" style={{ color: rank.color }} title={rank.name}>
                      {getRankIcon(rank.key, 20)}
                    </span>
                  </td>
                  <td>
                    <span className="ranking-score">{player.rankingScore}</span>
                  </td>
                  <td>
                    <span className={`win-rate ${getWinRateClass(player.winRate)}`}>
                      {typeof player.winRate === 'number' ? player.winRate.toFixed(0) : player.winRate || 0}%
                    </span>
                  </td>
                  <td>
                    <div className="winrate-bar-container">
                      <div
                        className={`winrate-bar ${getWinRateClass(player.winRate)}`}
                        style={{ width: `${player.winRate}%` }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className="stat-value wins">{player.wins}</span>
                  </td>
                  <td>
                    <span className="stat-value losses">{player.losses}</span>
                  </td>
                  <td>
                    <span className={`mvp-count ${player.mvps > 0 ? 'has-mvps' : ''}`}>
                      {player.mvps > 0 ? player.mvps : '-'}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`rating-value ${getRatingClass(player.avgRating ? parseFloat(player.avgRating) : 0)}`}
                    >
                      {player.avgRating || '-'}
                    </span>
                  </td>
                  <td>
                    <span className="xp-value">{xp}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <EmptyState
          type="noStats"
          title="Sin estadísticas"
          description={
            timeFilter !== 'all'
              ? 'No hay partidos en este período'
              : 'Agrega partidos para ver las estadísticas'
          }
        />
      )}
    </section>
  )
}

export default StatsTab
