/**
 * Matches Tab — SofaScore-style fixture cards
 */

import { useApp } from '../../contexts'
import { useState } from 'react'
import { AppIcon, EmptyState } from '../common'

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

  // Two independent expand states per match
  const [expandedPlayers, setExpandedPlayers] = useState(new Set())
  const [expandedDetails, setExpandedDetails] = useState(new Set())

  const formatDate = dateStr => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
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

  const getPositionLabel = value => {
    const map = {
      portero: 'Portero',
      cierre: 'Cierre / Def',
      lateral_izq: 'Lateral Izq',
      lateral_der: 'Lateral Der',
      medio: 'Mediocampista',
      pivote: 'Pivote',
      delantero: 'Delantero',
    }
    return map[value] || ''
  }

  const parseScoreValue = value => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const getPostMatchReport = (match, matchPlayerRatings) => {
    if (!matchPlayerRatings || matchPlayerRatings.length === 0) return null
    const ratingMap = Object.fromEntries(
      matchPlayerRatings.map(entry => [entry.playerId, parseFloat(entry.avgRating) || 0])
    )
    const sortedByRating = [...matchPlayerRatings]
      .sort((a, b) => (b.rawAvg || parseFloat(b.avgRating) || 0) - (a.rawAvg || parseFloat(a.avgRating) || 0))
    const mvp = sortedByRating[0] || null
    const hasWinner = !!match?.winner
    const scoreWhite = parseScoreValue(match.scoreWhite)
    const scoreBlack = parseScoreValue(match.scoreBlack)
    const hasFinalScore = scoreWhite !== null && scoreBlack !== null
    const winnerTeam = match?.winner === 'white' ? (match.teamWhite || []) : match?.winner === 'black' ? (match.teamBlack || []) : []
    const loserTeam = match?.winner === 'white' ? (match.teamBlack || []) : match?.winner === 'black' ? (match.teamWhite || []) : []
    const avgTeamRating = teamIds => {
      if (!teamIds.length) return null
      const rated = teamIds.map(pid => ratingMap[pid]).filter(v => Number.isFinite(v) && v > 0)
      if (!rated.length) return null
      return rated.reduce((s, v) => s + v, 0) / rated.length
    }
    const winnerAvg = avgTeamRating(winnerTeam)
    const loserAvg = avgTeamRating(loserTeam)
    const ratingGap = winnerAvg !== null && loserAvg !== null ? winnerAvg - loserAvg : null
    let bestPair = null
    if (hasWinner && winnerTeam.length >= 2) {
      for (let i = 0; i < winnerTeam.length; i++) {
        for (let j = i + 1; j < winnerTeam.length; j++) {
          const p1 = winnerTeam[i]; const p2 = winnerTeam[j]
          const pairScore = (ratingMap[p1] || 0) + (ratingMap[p2] || 0)
          if (!bestPair || pairScore > bestPair.score) bestPair = { p1, p2, score: pairScore }
        }
      }
    }
    const matchPredictions = Object.values(predictions?.[match.id] || {})
    const predictionSummary = hasWinner ? {
      total: matchPredictions.length,
      correct: match.winner === 'tie' ? 0 : matchPredictions.filter(p => p?.prediction === match.winner).length,
      wrong: match.winner === 'tie' ? 0 : matchPredictions.length - matchPredictions.filter(p => p?.prediction === match.winner).length,
      voided: match.winner === 'tie' ? matchPredictions.length : 0,
      mvpHits: mvp?.playerId ? matchPredictions.filter(p => p?.predictedMvpId === mvp.playerId).length : 0,
      exactScoreHits: hasFinalScore ? matchPredictions.filter(p =>
        parseScoreValue(p?.predictedScoreWhite) === scoreWhite && parseScoreValue(p?.predictedScoreBlack) === scoreBlack
      ).length : 0,
    } : null
    const storyline = hasWinner ? (() => {
      if (match.winner === 'tie') return 'Partido parejo: terminó en empate.'
      if (ratingGap !== null && ratingGap >= 0.8) return 'La diferencia de rating del equipo ganador fue clara.'
      if (ratingGap !== null && ratingGap <= 0.25) return 'Partido cerrado: se definió por detalles.'
      return 'Resultado sólido con ventaja moderada del equipo ganador.'
    })() : null
    return { mvp, bestPair, scoreWhite, scoreBlack, hasFinalScore, hasWinner, predictionSummary, storyline, winnerAvg, loserAvg, ratingGap }
  }

  const togglePlayers = id => setExpandedPlayers(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleDetails = id => setExpandedDetails(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  return (
    <section className="stats-section">
      <h2 className="section-title">Historial de Partidos</h2>

      {matches.length > 0 ? (
        [...matches].reverse().map(match => {
          if (!match.teamWhite || !match.teamBlack) return null

          const playersOpen = expandedPlayers.has(match.id)
          const detailsOpen = expandedDetails.has(match.id)

          // Build ratings data
          const matchPlayerRatings = []
          const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]
          allMatchPlayers.forEach(playerId => {
            const playerRatings = ratings[playerId] || []
            const matchRatings = playerRatings.filter(r => r.matchId === match.id)
            if (matchRatings.length > 0) {
              const avg = matchRatings.reduce((sum, r) => sum + (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0), 0) / matchRatings.length
              matchPlayerRatings.push({
                playerId,
                name: getPlayerName(playerId),
                rawAvg: avg,
                avgRating: typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : '0.0',
                votes: matchRatings.length,
              })
            }
          })
          const top3 = [...matchPlayerRatings].sort((a, b) => (b.rawAvg || 0) - (a.rawAvg || 0)).slice(0, 3)
          const postMatchReport = getPostMatchReport(match, matchPlayerRatings)
          const predictionCount = predictions[match.id] ? Object.keys(predictions[match.id]).length : 0

          const scoreWhite = parseScoreValue(match.scoreWhite)
          const scoreBlack = parseScoreValue(match.scoreBlack)
          const hasFinalScore = scoreWhite !== null && scoreBlack !== null
          const isClosed = match.ratingsOpen === false

          // Team result classes
          const whiteResult = match.winner === 'white' ? 'winner' : match.winner === 'black' ? 'loser' : match.winner === 'tie' ? 'tied' : ''
          const blackResult = match.winner === 'black' ? 'winner' : match.winner === 'white' ? 'loser' : match.winner === 'tie' ? 'tied' : ''

          return (
            <div key={match.id} className="mc-card">

              {/* ── Top meta: date + venue + status + admin ── */}
              <div className="mc-meta">
                <div className="mc-meta-left">
                  <span className="mc-date">{formatDate(match.date)}</span>
                  {match.time && <span className="mc-time">{match.time}</span>}
                  {match.venue && <span className="mc-venue">{match.venue}</span>}
                </div>
                <div className="mc-meta-right">
                  {isClosed
                    ? <span className="mc-status closed"><AppIcon name="lock" size={10} /> Cerrado</span>
                    : <span className="mc-status open"><AppIcon name="check" size={10} /> Abierto</span>
                  }
                  {isAdmin && (
                    <div className="mc-admin-actions">
                      <button
                        className={`mc-icon-btn ${isClosed ? 'red' : 'purple'}`}
                        onClick={() => onToggleRatings(match.id, isClosed)}
                        title={isClosed ? 'Abrir calificaciones' : 'Cerrar calificaciones'}
                      >
                        <AppIcon name={isClosed ? 'lock' : 'unlock'} size={13} />
                      </button>
                      <button className="mc-icon-btn" onClick={() => onOpenEditMatch(match)}>
                        <AppIcon name="note" size={13} />
                      </button>
                      <button className="mc-icon-btn red" onClick={() => onDeleteMatch(match.id)}>
                        <AppIcon name="close" size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Fixture score row ── */}
              <div className="mc-fixture">
                <div className={`mc-team-side left ${whiteResult}`}>
                  <span className="mc-team-dot white-dot" />
                  <span className="mc-team-label">Blanco</span>
                  {match.winner === 'white' && <span className="mc-winner-check">✓</span>}
                </div>

                <div className="mc-score-center">
                  {hasFinalScore ? (
                    <>
                      <span className={`mc-score-num ${whiteResult}`}>{scoreWhite}</span>
                      <span className="mc-score-dash">–</span>
                      <span className={`mc-score-num ${blackResult}`}>{scoreBlack}</span>
                    </>
                  ) : match.winner === 'tie' ? (
                    <span className="mc-tie-label">Empate</span>
                  ) : (
                    <span className="mc-vs-label">VS</span>
                  )}
                </div>

                <div className={`mc-team-side right ${blackResult}`}>
                  {match.winner === 'black' && <span className="mc-winner-check">✓</span>}
                  <span className="mc-team-label">Negro</span>
                  <span className="mc-team-dot black-dot" />
                </div>
              </div>

              {/* ── Player list (collapsed by default) ── */}
              {playersOpen && (
                <div className="mc-players">
                  <div className={`mc-player-col ${whiteResult}`}>
                    {match.teamWhite.map(id => (
                      <div key={id} className="mc-player-row">
                        <span className="mc-player-name">{getPlayerName(id)}</span>
                        {match.positions?.[id] && (
                          <span className="mc-player-pos">{getPositionLabel(match.positions[id])}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className={`mc-player-col ${blackResult}`}>
                    {match.teamBlack.map(id => (
                      <div key={id} className="mc-player-row">
                        <span className="mc-player-name">{getPlayerName(id)}</span>
                        {match.positions?.[id] && (
                          <span className="mc-player-pos">{getPositionLabel(match.positions[id])}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Footer: chips + actions ── */}
              <div className="mc-footer">
                <div className="mc-footer-chips">
                  {top3[0] && (
                    <span className="mc-chip mvp">
                      ★ {top3[0].name} {top3[0].avgRating}
                    </span>
                  )}
                  {predictionCount > 0 && (
                    <span className="mc-chip">{predictionCount} pred.</span>
                  )}
                </div>
                <div className="mc-footer-actions">
                  <button className="mc-toggle-btn" onClick={() => togglePlayers(match.id)}>
                    {playersOpen ? 'Ocultar' : 'Jugadores'}
                    <span className={`mc-chevron ${playersOpen ? 'up' : ''}`}>›</span>
                  </button>
                  {user && userPlayer && !isClosed && (
                    <button className="mc-rate-btn" onClick={() => onOpenRatingModal(match)}>
                      Calificar
                    </button>
                  )}
                  {user && userPlayer && !predictions[match.id]?.[user.uid] && !match.winner && (canPredictMatch ? canPredictMatch(match) : true) && (
                    <button className="mc-predict-btn" onClick={() => onOpenPrediction(match)}>
                      Predecir
                    </button>
                  )}
                  {(top3.length > 0 || predictionCount > 0) && (
                    <button className="mc-toggle-btn" onClick={() => toggleDetails(match.id)}>
                      {detailsOpen ? 'Menos' : 'Informe'}
                      <span className={`mc-chevron ${detailsOpen ? 'up' : ''}`}>›</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ── Expanded: leaderboard + report + predictions ── */}
              {detailsOpen && (
                <>
                  {top3.length > 0 && (
                    <div className="match-leaderboard">
                      <div className="leaderboard-title">Top del partido</div>
                      <div className="leaderboard-items">
                        {top3.map((player, idx) => {
                          if (idx === 0 && player.playerId === userPlayer) {
                            setTimeout(() => triggerMVPConfetti(match.id, player.playerId), 500)
                          }
                          return (
                            <div
                              key={player.playerId}
                              className={`leaderboard-item ${idx === 0 && player.playerId === userPlayer ? 'is-me' : ''}`}
                            >
                              <span className={`leaderboard-position ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}`}>
                                {idx + 1}
                              </span>
                              <span className="leaderboard-name">
                                {player.name}
                                {idx === 0 && <span className="mvp-badge-inline"> MVP</span>}
                              </span>
                              <span className="leaderboard-score">{player.avgRating}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {postMatchReport && (
                    <div className="post-match-report">
                      <div className="post-match-report-title">
                        <AppIcon name="note" size={14} />
                        <span>Reporte automático</span>
                      </div>
                      <div className="post-match-report-grid">
                        {postMatchReport.storyline && (
                          <div className="pmr-card">
                            <span className="pmr-label">Lectura del partido</span>
                            <strong>{postMatchReport.storyline}</strong>
                          </div>
                        )}
                        <div className="pmr-card">
                          <span className="pmr-label">MVP detectado</span>
                          <strong>
                            {postMatchReport.mvp
                              ? `${postMatchReport.mvp.name} (${postMatchReport.mvp.avgRating})`
                              : 'Sin calificaciones suficientes'}
                          </strong>
                        </div>
                        {postMatchReport.hasWinner && (
                          <div className="pmr-card">
                            <span className="pmr-label">Dupla destacada</span>
                            <strong>
                              {postMatchReport.bestPair
                                ? `${getPlayerName(postMatchReport.bestPair.p1)} + ${getPlayerName(postMatchReport.bestPair.p2)}`
                                : 'Sin datos suficientes'}
                            </strong>
                          </div>
                        )}
                        {postMatchReport.predictionSummary && (
                          <div className="pmr-card">
                            <span className="pmr-label">Predicciones</span>
                            <strong>
                              {postMatchReport.predictionSummary.correct} correctas
                              {postMatchReport.predictionSummary.wrong > 0 ? ` · ${postMatchReport.predictionSummary.wrong} fallidas` : ''}
                              {postMatchReport.predictionSummary.voided > 0 ? ` · ${postMatchReport.predictionSummary.voided} anuladas` : ''}
                            </strong>
                            <span className="pmr-sub">
                              MVP acertado: {postMatchReport.predictionSummary.mvpHits}
                              {postMatchReport.hasFinalScore ? ` · Marcador exacto: ${postMatchReport.predictionSummary.exactScoreHits}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {predictions[match.id] && Object.keys(predictions[match.id]).length > 0 && (
                    <div className="match-predictions">
                      <div className="predictions-title">Predicciones</div>
                      <div className="predictions-grid">
                        {Object.entries(predictions[match.id]).map(([odedBy, predictionData]) => {
                          const predictionValue = predictionData?.prediction
                          const status = getPredictionStatus(predictionData, match.winner)
                          const bet = getPredictionBet(predictionData)
                          const win = getPredictionWin(predictionData)
                          const predictedScoreWhite = parseScoreValue(predictionData?.predictedScoreWhite)
                          const predictedScoreBlack = parseScoreValue(predictionData?.predictedScoreBlack)
                          const hasPredictedScore = predictedScoreWhite !== null && predictedScoreBlack !== null
                          const predictedMvp = predictionData?.predictedMvpId ? getPlayerName(predictionData.predictedMvpId) : null
                          const isMe = user?.uid === odedBy
                          const name = getPredictionUserName(odedBy, predictionData)
                          return (
                            <div key={odedBy} className={`prediction-tile ${status}`}>
                              <div className="prediction-tile-header">
                                <span className="prediction-name">{name}</span>
                                {isMe && <span className="prediction-me">Tú</span>}
                              </div>
                              <div className="prediction-tile-body">
                                <span className={`prediction-team-chip ${predictionValue}`}>
                                  {predictionValue === 'white' ? 'Equipo Blanco' : 'Equipo Negro'}
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
                                {hasPredictedScore && (
                                  <span className="prediction-extra-line">
                                    Marcador: {predictedScoreWhite} - {predictedScoreBlack}
                                  </span>
                                )}
                                {predictedMvp && (
                                  <span className="prediction-extra-line">
                                    MVP probable: {predictedMvp}
                                  </span>
                                )}
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
