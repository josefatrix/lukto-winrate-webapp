/**
 * Matches Tab Component
 * Shows match history with leaderboards
 */

import { useApp } from '../../contexts'
import { useState } from 'react'
import { EmptyState } from '../common'

export const MatchesTab = ({
  onOpenRatingModal,
  onOpenEditMatch,
  onDeleteMatch,
  onToggleRatings,
  onOpenPrediction,
  canPredictMatch,
  triggerMVPConfetti,
}) => {
  const {
    matches,
    ratings,
    predictions,
    user,
    userPlayer,
    isAdmin,
    getPlayerName,
    userLinks,
  } = useApp()
  const [expandedMatches, setExpandedMatches] = useState(new Set())

  const formatDate = dateStr => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatTime = timeStr => {
    if (!timeStr) return ''
    return timeStr
  }

  const getPredictionBet = pred => pred?.lukCoinsBet ?? pred?.xpBet ?? 0
  const getPredictionWin = pred => pred?.lukCoinsWin ?? pred?.potentialWin ?? 0
  const getPredictionStatus = (pred, matchWinner) => {
    if (!matchWinner) return 'pending'
    if (matchWinner === 'tie') return 'void'
    return pred?.prediction === matchWinner ? 'correct' : 'wrong'
  }
  const getPredictionUserName = (odedBy, predictionData) => {
    const link = userLinks?.[odedBy]
    if (link?.playerId) return getPlayerName(link.playerId)
    if (link?.userName) return link.userName
    if (link?.userEmail) return link.userEmail.split('@')[0]
    if (predictionData?.userName) return predictionData.userName
    if (predictionData?.userEmail) return predictionData.userEmail.split('@')[0]
    if (odedBy) return odedBy.slice(0, 6)
    return 'Usuario'
  }

  const getPositionLabel = (value) => {
    const map = {
      portero: 'Portero',
      cierre: 'Cierre / Defensa',
      lateral_izq: 'Lateral Izq',
      lateral_der: 'Lateral Der',
      medio: 'Mediocampista',
      pivote: 'Pivote',
      delantero: 'Delantero',
    }
    return map[value] || ''
  }

  const getPositionGroup = (value) => {
    if (!value) return 'Sin posición'
    if (value === 'portero') return 'Portero'
    if (value === 'cierre' || value === 'lateral_izq' || value === 'lateral_der') return 'Defensa'
    if (value === 'medio' || value === 'pivote') return 'Medio'
    if (value === 'delantero') return 'Delantero'
    return 'Otro'
  }

  const getTeamFormationSummary = (teamIds, positions = {}) => {
    const counts = {}
    teamIds.forEach(id => {
      const group = getPositionGroup(positions[id])
      if (group === 'Sin posición') return
      counts[group] = (counts[group] || 0) + 1
    })
    const ordered = ['Portero', 'Defensa', 'Medio', 'Delantero']
    const parts = ordered
      .filter(k => counts[k])
      .map(k => `${k} ${counts[k]}`)
    return parts.length > 0 ? parts.join(' · ') : 'Sin posiciones'
  }

  const toggleDetails = (matchId) => {
    setExpandedMatches(prev => {
      const next = new Set(prev)
      if (next.has(matchId)) {
        next.delete(matchId)
      } else {
        next.add(matchId)
      }
      return next
    })
  }

  return (
    <section className="stats-section">
      <h2 className="section-title">Historial de Partidos</h2>
      {matches.length > 0 ? (
        [...matches].reverse().map(match => {
          const isExpanded = expandedMatches.has(match.id)
          // Calculate top 3 rated players for this match
          const matchPlayerRatings = []
          const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]
          allMatchPlayers.forEach(playerId => {
            const playerRatings = ratings[playerId] || []
            const matchRatings = playerRatings.filter(r => r.matchId === match.id)
            if (matchRatings.length > 0) {
              const avg = matchRatings.reduce((sum, r) => sum + (typeof r.score === 'number' ? r.score : 0), 0) / matchRatings.length
              matchPlayerRatings.push({
                playerId,
                name: getPlayerName(playerId),
                avgRating: typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : '0.0',
                votes: matchRatings.length,
              })
            }
          })
          const top3 = matchPlayerRatings
            .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
            .slice(0, 3)
          const predictionCount = predictions[match.id]
            ? Object.keys(predictions[match.id]).length
            : 0

          return (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <div>
                  <div className="match-date">{formatDate(match.date)}</div>
                  <div className="match-venue">
                    {match.venue}
                    {match.time && <span> · {formatTime(match.time)}</span>}
                  </div>
                  {match.winner === 'tie' && (
                    <div className="match-result tie">Empate</div>
                  )}
                </div>
                <div className="match-actions">
                  {user &&
                    userPlayer &&
                    !predictions[match.id]?.[user.uid] &&
                    !match.winner &&
                    (canPredictMatch ? canPredictMatch(match) : true) && (
                      <button className="predict-btn" onClick={() => onOpenPrediction(match)}>
                        Predecir
                      </button>
                    )}
                  {/* SIEMPRE mostrar badge si está cerrado */}
                  {match.ratingsOpen === false && (
                    <span className="ratings-closed-badge">🔒 CERRADO</span>
                  )}
                  {match.ratingsOpen !== false && (
                    <span className="ratings-open-badge">🟢 ABIERTO</span>
                  )}
                  {/* Solo mostrar botón calificar si NO está cerrado */}
                  {user && userPlayer && match.ratingsOpen !== false && (
                    <button className="rate-match-btn" onClick={() => onOpenRatingModal(match)}>
                      Calificar
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button
                        className={`toggle-ratings-btn ${match.ratingsOpen === false ? 'closed' : 'open'}`}
                        onClick={() => onToggleRatings(match.id, match.ratingsOpen !== false)}
                        title={
                          match.ratingsOpen === false
                            ? 'Abrir calificaciones'
                            : 'Cerrar calificaciones'
                        }
                      >
                        {match.ratingsOpen === false ? '🔒' : '🔓'}
                      </button>
                      <button className="edit-match-btn" onClick={() => onOpenEditMatch(match)}>
                        Editar
                      </button>
                      <button className="delete-match-btn" onClick={() => onDeleteMatch(match.id)}>
                        ×
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="match-teams">
                <div className={`match-team ${match.winner === 'white' ? 'winner' : ''}`}>
                  <div className="match-team-header">
                    <span className="team-badge white"></span>
                    Equipo Blanco
                    {match.winner === 'white' && ' · Ganador'}
                  </div>
                  <div className="match-formation">
                    {getTeamFormationSummary(match.teamWhite, match.positions)}
                  </div>
                  <div className="match-team-players">
                    {match.teamWhite.map(id => (
                      <span key={id} className="match-player-tag">
                        <span className="match-player-name">{getPlayerName(id)}</span>
                        {match.positions?.[id] && (
                          <span className="match-player-position">
                            {getPositionLabel(match.positions[id])}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="vs-badge">VS</div>
                <div className={`match-team ${match.winner === 'black' ? 'winner' : ''}`}>
                  <div className="match-team-header">
                    <span className="team-badge black"></span>
                    Equipo Negro
                    {match.winner === 'black' && ' · Ganador'}
                  </div>
                  <div className="match-formation">
                    {getTeamFormationSummary(match.teamBlack, match.positions)}
                  </div>
                  <div className="match-team-players">
                    {match.teamBlack.map(id => (
                      <span key={id} className="match-player-tag">
                        <span className="match-player-name">{getPlayerName(id)}</span>
                        {match.positions?.[id] && (
                          <span className="match-player-position">
                            {getPositionLabel(match.positions[id])}
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="match-summary-row">
                {top3.length > 0 && <span className="match-summary-pill">Top: {top3.length}</span>}
                {predictionCount > 0 && <span className="match-summary-pill">Predicciones: {predictionCount}</span>}
                <button
                  className="match-details-toggle"
                  onClick={() => toggleDetails(match.id)}
                >
                  {isExpanded ? 'Ver menos' : 'Ver más'}
                </button>
              </div>

              {isExpanded && (
                <>
                  {top3.length > 0 && (
                    <div className="match-leaderboard">
                      <div className="leaderboard-title">Top del partido</div>
                      <div className="leaderboard-items">
                        {top3.map((player, idx) => {
                          // Trigger confetti if current user is MVP
                          if (idx === 0 && player.playerId === userPlayer) {
                            setTimeout(() => triggerMVPConfetti(match.id, player.playerId), 500)
                          }
                          return (
                            <div
                              key={player.playerId}
                              className={`leaderboard-item ${idx === 0 && player.playerId === userPlayer ? 'is-me' : ''}`}
                            >
                              <span
                                className={`leaderboard-position ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}`}
                              >
                                {idx + 1}
                              </span>
                              <span className="leaderboard-name">{player.name}</span>
                              <span className="leaderboard-score">{player.avgRating}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Show predictions for this match */}
                  {predictions[match.id] && Object.keys(predictions[match.id]).length > 0 && (
                    <div className="match-predictions">
                      <div className="predictions-title">Predicciones</div>
                      <div className="predictions-grid">
                        {Object.entries(predictions[match.id]).map(([odedBy, predictionData]) => {
                          const predictionValue = predictionData?.prediction
                          const status = getPredictionStatus(predictionData, match.winner)
                          const bet = getPredictionBet(predictionData)
                          const win = getPredictionWin(predictionData)
                          const isMe = user?.uid === odedBy
                          const name = getPredictionUserName(odedBy, predictionData)
                          return (
                            <div
                              key={odedBy}
                              className={`prediction-tile ${status}`}
                            >
                              <div className="prediction-tile-header">
                                <span className="prediction-name">{name}</span>
                                {isMe && <span className="prediction-me">Tú</span>}
                              </div>
                              <div className="prediction-tile-body">
                                <span className={`prediction-team-chip ${predictionValue}`}>
                                  {predictionValue === 'white' ? '⬜ Blanco' : '⬛ Negro'}
                                </span>
                                <span className="prediction-outcome">
                                  {status === 'pending'
                                    ? `Pendiente · ${bet} LC`
                                    : status === 'void'
                                      ? 'Empate · Apuesta devuelta'
                                      : status === 'correct'
                                        ? `Ganó +${win} LC`
                                        : `Perdió -${bet} LC`}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })
      ) : (
        <EmptyState
          type="noMatches"
          title="Sin partidos"
          description="Agrega tu primer partido para comenzar"
        />
      )}
    </section>
  )
}

export default MatchesTab
