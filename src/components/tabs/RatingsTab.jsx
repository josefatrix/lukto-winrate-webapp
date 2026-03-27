/**
 * Ratings Tab Component
 * Shows player ratings accordion
 */
import { useState } from 'react'
import { useApp } from '../../contexts'
import { AvatarImage, AppIcon, EmptyState } from '../common'
import { isPredictionCorrect } from '../../hooks/useStats'

// Prediction bonus constant
const PREDICTION_BONUS = 0.2

export const RatingsTab = ({ getRatingClass }) => {
  const { players, matches, ratings, predictions, userLinks, user, userPlayer, timeFilter, getPlayerPhoto } =
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

            const matchRows = Object.entries(ratingsByMatch)
              .sort(
                (a, b) =>
                  new Date(b[1].match?.date || 0) - new Date(a[1].match?.date || 0)
              )
              .map(([matchId, data]) => {
                let matchAvg = '-'

                const playerId = player.id
                const userId = userLinks
                  ? Object.entries(userLinks).find(([_uid, linkData]) => linkData?.playerId === playerId)?.[0]
                  : null

                const predictionCorrect = userId && data.match?.winner
                  ? isPredictionCorrect(userId, matchId, data.match.winner, predictions)
                  : false

                if (data.ratings.length > 0) {
                  const sum = data.ratings.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
                  const baseAvg = sum / data.ratings.length
                  const finalAvg = predictionCorrect ? baseAvg + PREDICTION_BONUS : baseAvg
                  matchAvg = typeof finalAvg === 'number' && !isNaN(finalAvg) ? finalAvg.toFixed(1) : '-'
                }

                return {
                  matchId,
                  match: data.match,
                  ratingsCount: data.ratings.length,
                  matchAvg,
                  predictionCorrect,
                }
              })

            return (
              <div key={player.id} className={`accordion-item ${isExpanded ? 'expanded' : ''}`}>
                <div
                  className="accordion-header"
                  onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                >
                  <span className={`rank ${index < 3 ? `rank-${index + 1}` : ''}`}>{index + 1}</span>
                  <AvatarImage
                    src={getPlayerPhoto(player.id)}
                    name={player.name}
                    imgClassName="player-avatar-img"
                    fallbackClassName="player-avatar"
                  />
                  <span className="accordion-player-name">{player.name}</span>
                  <span className={`rating-value ${getRatingClass(parseFloat(player.avgRating))}`}>
                    {player.avgRating}
                  </span>
                  <span className="stat-value votes-count">{playerRatings.length} votos</span>
                  <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>
                    <AppIcon name="arrowDown" size={12} />
                  </span>
                </div>

                {isExpanded && (
                  <div className="accordion-content">
                    {matchRows.length > 0 ? (
                      <>
                        <div className="desktop-match-ratings">
                          <table className="match-ratings-table">
                            <thead>
                              <tr>
                                <th>Partido</th>
                                <th>Promedio</th>
                                <th>Votos</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchRows.map(row => (
                                <tr key={row.matchId}>
                                  <td>
                                    <div className="match-info-cell">
                                      <span className="match-date-small">
                                        {row.match
                                          ? formatDate(row.match.date)
                                          : 'Partido eliminado'}
                                      </span>
                                      {row.match && (
                                        <span className="match-venue-small">{row.match.venue}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    <span
                                      className={`rating-value ${getRatingClass(parseFloat(row.matchAvg))}`}
                                    >
                                      {row.matchAvg}
                                      {row.predictionCorrect && (
                                        <span className="prediction-bonus-badge" title={`+${PREDICTION_BONUS} por predicción correcta`}>
                                          <svg width="12" height="12" viewBox="0 0 12 12">
                                            <circle cx="6" cy="6" r="5" fill="#a855f7" />
                                            <path d="M4 6l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                                          </svg>
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="stat-value">{row.ratingsCount}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="mobile-match-ratings">
                          {matchRows.map(row => (
                            <article key={`m-${row.matchId}`} className="mobile-rating-card">
                              <div className="mobile-rating-head">
                                <span className="mobile-rating-date">
                                  <AppIcon name="calendar" size={12} /> {row.match ? formatDate(row.match.date) : 'Partido eliminado'}
                                </span>
                                <span className={`rating-value ${getRatingClass(parseFloat(row.matchAvg))}`}>
                                  {row.matchAvg}
                                </span>
                              </div>
                              {row.match && <div className="mobile-rating-venue">{row.match.venue}</div>}
                              <div className="mobile-rating-meta">
                                <span>{row.ratingsCount} votos</span>
                                {row.predictionCorrect && (
                                  <span className="mobile-rating-bonus">+{PREDICTION_BONUS} bono predicción</span>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </>
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
