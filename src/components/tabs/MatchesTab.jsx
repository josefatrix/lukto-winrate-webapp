/**
 * Matches Tab Component
 * Shows match history with leaderboards
 */

import { useApp } from '../../contexts'
import { EmptyState } from '../common'

export const MatchesTab = ({
  onOpenRatingModal,
  onOpenEditMatch,
  onDeleteMatch,
  onToggleRatings,
  onOpenPrediction,
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

  const formatDate = dateStr => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const getPredictionBet = pred => pred?.lukCoinsBet ?? pred?.xpBet ?? 0
  const getPredictionWin = pred => pred?.lukCoinsWin ?? pred?.potentialWin ?? 0
  const getPredictionStatus = (pred, matchWinner) => {
    if (!matchWinner) return 'pending'
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

  return (
    <section className="stats-section">
      <h2 className="section-title">Historial de Partidos</h2>
      {matches.length > 0 ? (
        [...matches].reverse().map(match => {
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

          return (
            <div key={match.id} className="match-card">
              <div className="match-header">
                <div>
                  <div className="match-date">{formatDate(match.date)}</div>
                  <div className="match-venue">{match.venue}</div>
                </div>
                <div className="match-actions">
                  {user &&
                    userPlayer &&
                    !predictions[match.id]?.[user.uid] &&
                    !match.winner && (
                      <button className="predict-btn" onClick={() => onOpenPrediction(match)}>
                        Predecir
                      </button>
                    )}
                  {/* SIEMPRE mostrar badge si está cerrado */}
                  {match.ratingsOpen === false && (
                    <span className="ratings-closed-badge">🔒 CERRADO</span>
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
                  <div className="match-team-players">
                    {match.teamWhite.map(id => (
                      <span key={id} className="match-player-tag">
                        {getPlayerName(id)}
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
                  <div className="match-team-players">
                    {match.teamBlack.map(id => (
                      <span key={id} className="match-player-tag">
                        {getPlayerName(id)}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

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
