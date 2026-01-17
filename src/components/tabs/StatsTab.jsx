/**
 * Stats Tab Component
 * Shows ranking table and featured players
 */

import { useState, useMemo } from 'react'
import { useApp } from '../../contexts'

export const StatsTab = ({
  stats,
  playerOfWeek,
  playerOfMonth,
  onPlayerClick,
  calculateXP,
  getRank,
  getRankIcon,
  getWinRateClass,
  getRatingClass,
  announcements,
}) => {
  const { players, timeFilter, getPlayerPhoto, getInitials } = useApp()
  
  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('rankingScore')
  const [sortDir, setSortDir] = useState('desc')

  const potwPlayer = playerOfWeek ? players.find(p => p.id === playerOfWeek.id) : null
  const potmPlayer = playerOfMonth ? players.find(p => p.id === playerOfMonth.id) : null

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
        {playerOfWeek && potwPlayer && (
          <div className="featured-card week">
            <div className="featured-badge">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M7 2v11h3v9l7-12h-4l4-8z" />
              </svg>
              Jugador de la Semana
            </div>
            <div className="featured-content">
              {getPlayerPhoto(playerOfWeek.id) ? (
                <img src={getPlayerPhoto(playerOfWeek.id)} alt="" className="featured-avatar" />
              ) : (
                <div className="featured-avatar-placeholder">
                  {getInitials(potwPlayer?.name || '')}
                </div>
              )}
              <div className="featured-info">
                <h3>{potwPlayer?.name}</h3>
                <div className="featured-stats">
                  <span className="stat-item">
                    {playerOfWeek.wins}V {playerOfWeek.played - playerOfWeek.wins}D
                  </span>
                  <span className="stat-item highlight">{playerOfWeek.winRate}%</span>
                </div>
              </div>
            </div>
          </div>
        )}

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
              {getPlayerPhoto(playerOfMonth.id) ? (
                <img src={getPlayerPhoto(playerOfMonth.id)} alt="" className="featured-avatar" />
              ) : (
                <div className="featured-avatar-placeholder">
                  {getInitials(potmPlayer?.name || '')}
                </div>
              )}
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

      {filteredStats.length > 0 ? (
        <table className="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th onClick={() => handleSort('name')} className="sortable">
                Jugador <SortIcon column="name" />
              </th>
              <th>Rango</th>
              <th onClick={() => handleSort('rankingScore')} className="sortable">
                Score <SortIcon column="rankingScore" />
              </th>
              <th onClick={() => handleSort('winRate')} className="sortable">
                WR <SortIcon column="winRate" />
              </th>
              <th></th>
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
                      {getPlayerPhoto(player.id) ? (
                        <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                      ) : (
                        <div className="player-avatar">{getInitials(player.name)}</div>
                      )}
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
        <div className="empty-state">
          <div className="icon">—</div>
          <h3>Sin estadísticas</h3>
          <p>
            {timeFilter !== 'all'
              ? 'No hay partidos en este período'
              : 'Agrega partidos para ver las estadísticas'}
          </p>
        </div>
      )}
    </section>
  )
}

export default StatsTab

