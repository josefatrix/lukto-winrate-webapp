/**
 * Ratings Tab Component
 * Shows player ratings accordion
 */
import React, { useState } from 'react'
import { useApp } from '../../contexts'
import { EmptyState } from '../common'

export const RatingsTab = ({ getRatingClass }) => {
  const { players, matches, ratings, user, userPlayer, timeFilter, getPlayerPhoto, getInitials } =
    useApp()

  const [expandedPlayer, setExpandedPlayer] = useState(null)

  const formatDate = dateStr => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  // Get filtered matches for time period
  const getFilteredMatches = () => {
    const now = new Date()
    return matches.filter(match => {
      const matchDate = new Date(match.date)
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return matchDate >= weekAgo
      }
      if (timeFilter === 'month') {
        return (
          matchDate.getMonth() === now.getMonth() && matchDate.getFullYear() === now.getFullYear()
        )
      }
      return true
    })
  }

  const filteredMatches = getFilteredMatches()
  const filteredMatchIds = new Set(filteredMatches.map(m => m.id))

  // Calculate filtered ratings stats
  const playerRatingsFiltered = {}
  players.forEach(player => {
    const allRatings = ratings[player.id] || []
    const filtered = allRatings.filter(r => filteredMatchIds.has(r.matchId))
    if (filtered.length > 0) {
      const sum = filtered.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
      const avgNum = sum / filtered.length
      const avg = typeof avgNum === 'number' && !isNaN(avgNum) ? avgNum.toFixed(1) : '0.0'
      playerRatingsFiltered[player.id] = {
        id: player.id,
        name: player.name,
        avgRating: avg,
        ratings: filtered,
      }
    }
  })

  const sortedPlayers = Object.values(playerRatingsFiltered).sort(
    (a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating)
  )

  return (
    <section className="stats-section">
      <h2 className="section-title">
        {timeFilter === 'all'
          ? 'Ranking por Calificaciones'
          : timeFilter === 'month'
            ? 'Calificaciones del Mes'
            : 'Calificaciones de la Semana'}
      </h2>
      <p className="section-subtitle">
        {user
          ? userPlayer
            ? 'Toca un jugador para ver sus calificaciones por partido'
            : 'Vincula tu cuenta con un jugador para calificar'
          : 'Toca un jugador para ver el desglose por partido'}
      </p>

      {sortedPlayers.length > 0 ? (
        <div className="ratings-accordion">
          {sortedPlayers.map((player, index) => {
            const playerRatings = player.ratings
            const isExpanded = expandedPlayer === player.id

            // Group ratings by match
            const ratingsByMatch = {}
            playerRatings.forEach(r => {
              if (!ratingsByMatch[r.matchId]) {
                const match = matches.find(m => m.id === r.matchId)
                ratingsByMatch[r.matchId] = {
                  match,
                  ratings: [],
                }
              }
              ratingsByMatch[r.matchId].ratings.push(r)
            })

            return (
              <div key={player.id} className={`accordion-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="accordion-header"
                  onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                >
                  <span className={`rank ${index < 3 ? `rank-${index + 1}` : ''}`}>{index + 1}</span>
                  {getPlayerPhoto(player.id) ? (
                    <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                  ) : (
                    <div className="player-avatar">{getInitials(player.name)}</div>
                  )}
                  <span className="accordion-player-name">{player.name}</span>
                  <span className={`rating-value ${getRatingClass(parseFloat(player.avgRating))}`}>
                    {player.avgRating}
                  </span>
                  <span className="stat-value votes-count">{playerRatings.length} votos</span>
                  <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
                </div>

                {isExpanded && (
                  <div className="accordion-content">
                    {Object.entries(ratingsByMatch).length > 0 ? (
                      <table className="match-ratings-table">
                        <thead>
                          <tr>
                            <th>Partido</th>
                            <th>Promedio</th>
                            <th>Votos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(ratingsByMatch)
                            .sort(
                              (a, b) =>
                                new Date(b[1].match?.date || 0) - new Date(a[1].match?.date || 0)
                            )
                            .map(([matchId, data]) => {
                              let matchAvg = '-'
                              if (data.ratings.length > 0) {
                                const sum = data.ratings.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
                                const avg = sum / data.ratings.length
                                matchAvg = typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : '-'
                              }
                              return (
                                <tr key={matchId}>
                                  <td>
                                    <div className="match-info-cell">
                                      <span className="match-date-small">
                                        {data.match
                                          ? formatDate(data.match.date)
                                          : 'Partido eliminado'}
                                      </span>
                                      {data.match && (
                                        <span className="match-venue-small">{data.match.venue}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`rating-value ${getRatingClass(parseFloat(matchAvg))}`}
                                    >
                                      {matchAvg}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="stat-value">{data.ratings.length}</span>
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    ) : (
                      <p className="no-data-text">Sin calificaciones detalladas</p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          type="noStats"
          title="Sin calificaciones"
          description={
            timeFilter !== 'all'
              ? 'No hay calificaciones en este período'
              : 'Ve a la pestaña de Partidos y califica a tus compañeros'
          }
        />
      )}
    </section>
  )
}

export default RatingsTab

