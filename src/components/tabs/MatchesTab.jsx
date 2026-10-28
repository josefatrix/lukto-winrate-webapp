/**
 * Matches Tab — what's next, what you still owe, then the history by month.
 *
 * Top to bottom: your record, filters, the next match (predict), the matches
 * you still have to rate, and every played match as one compact row per month
 * that opens into its full report.
 */

import { useApp } from '../../contexts'
import { useMemo, useState } from 'react'
import { AppIcon, AvatarImage, EmptyState, MatchShareCard } from '../common'
import { isMatchPlayed } from '../../utils/matchConstants'

// Months of history shown before "Ver partidos de …"
const MONTHS_PER_PAGE = 2

const POSITION_LABELS = {
  portero: 'Portero',
  cierre: 'Cierre / Def',
  lateral_izq: 'Lateral Izq',
  lateral_der: 'Lateral Der',
  medio: 'Mediocampista',
  pivote: 'Pivote',
  delantero: 'Delantero',
}

const RESULT_LETTER = { win: 'G', tie: 'E', loss: 'P' }
const RESULT_TEXT = { win: 'Ganaste', tie: 'Empataste', loss: 'Perdiste' }

const capitalize = text => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '')

const toDate = dateStr => new Date(`${dateStr}T12:00:00`)

const monthKey = dateStr => (dateStr || '').slice(0, 7)

const monthLabel = dateStr =>
  capitalize(toDate(dateStr).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }))

// "Lunes 3 nov"
const longDate = dateStr => {
  const date = toDate(dateStr)
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'long' })
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
  return `${capitalize(weekday)} ${date.getDate()} ${month}`
}

const shortWeekday = dateStr =>
  toDate(dateStr).toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')

// "Hoy", "Mañana", "En 6 días" — or null once the date has passed
const countdownLabel = dateStr => {
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days = Math.round((toDate(dateStr) - today) / 86400000)
  if (days < 0) return null
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  return `En ${days} días`
}

const parseScoreValue = value => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// 'win' | 'tie' | 'loss' for a player who took part in a decided match, else null
const resultFor = (match, playerId) => {
  if (!playerId || !match?.winner) return null
  const inWhite = match.teamWhite?.includes(playerId)
  const inBlack = match.teamBlack?.includes(playerId)
  if (!inWhite && !inBlack) return null
  if (match.winner === 'tie') return 'tie'
  return (match.winner === 'white') === inWhite ? 'win' : 'loss'
}

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
    getPlayerPhoto,
    userLinks,
  } = useApp()

  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  // Matches whose lineups / predictions are open inside a card or report
  const [openLineups, setOpenLineups] = useState(new Set())
  const [openPredictions, setOpenPredictions] = useState(new Set())
  const [visibleMonths, setVisibleMonths] = useState(MONTHS_PER_PAGE)
  // Match currently open in the share-image sheet
  const [shareTarget, setShareTarget] = useState(null)

  const toggleIn = setter => id => setter(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })
  const toggleLineups = toggleIn(setOpenLineups)
  const togglePredictions = toggleIn(setOpenPredictions)

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

  const hasRated = (match, raterId) =>
    Object.values(ratings || {}).some(playerRatings =>
      playerRatings.some(r => (r.ratedBy === raterId || r.odedBy === raterId) && r.matchId === match.id)
    )

  // Average received rating per player for one match, best first
  const getMatchPlayerRatings = match => {
    const rows = []
    ;[...match.teamWhite, ...match.teamBlack].forEach(playerId => {
      const matchRatings = (ratings[playerId] || []).filter(r => r.matchId === match.id)
      if (matchRatings.length === 0) return
      const avg = matchRatings.reduce((sum, r) => sum + (typeof r.score === 'number' ? r.score : parseFloat(r.score) || 0), 0) / matchRatings.length
      rows.push({
        playerId,
        name: getPlayerName(playerId),
        rawAvg: avg,
        avgRating: typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : '0.0',
        votes: matchRatings.length,
      })
    })
    return rows.sort((a, b) => (b.rawAvg || 0) - (a.rawAvg || 0))
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
    return { mvp, bestPair, scoreWhite, scoreBlack, hasFinalScore, hasWinner, predictionSummary, storyline, winnerAvg, loserAvg, ratingGap, ranking: sortedByRating }
  }

  // ── Buckets ────────────────────────────────────────────────────────────────
  const validMatches = useMemo(
    () => (matches || []).filter(m => m.teamWhite && m.teamBlack),
    [matches]
  )

  const isMine = match => !!userPlayer && (match.teamWhite.includes(userPlayer) || match.teamBlack.includes(userPlayer))

  const upcoming = useMemo(
    () => validMatches
      .filter(m => !isMatchPlayed(m))
      .sort((a, b) => toDate(a.date) - toDate(b.date)),
    [validMatches]
  )

  const played = useMemo(
    () => validMatches
      .filter(m => isMatchPlayed(m))
      .sort((a, b) => toDate(b.date) - toDate(a.date) || (b.time || '').localeCompare(a.time || '')),
    [validMatches]
  )

  const toRate = user && userPlayer
    ? played.filter(m => isMine(m) && m.ratingsOpen !== false && !hasRated(m, userPlayer))
    : []
  const toRateIds = new Set(toRate.map(m => m.id))

  // Your record across every decided match you played, last 5 oldest → newest
  const myRecord = useMemo(() => {
    if (!userPlayer) return null
    const results = played.map(m => resultFor(m, userPlayer)).filter(Boolean)
    if (results.length === 0) return null
    const count = r => results.filter(x => x === r).length
    const wins = count('win'); const ties = count('tie'); const losses = count('loss')
    return {
      wins, ties, losses,
      winRate: Math.round(((wins + ties * 0.5) / results.length) * 100),
      last5: results.slice(0, 5).reverse(),
    }
  }, [played, userPlayer])

  const showUpcoming = filter !== 'pending'
  const visibleUpcoming = filter === 'mine' ? upcoming.filter(isMine) : upcoming
  const historyMatches = filter === 'pending'
    ? []
    : played.filter(m => !toRateIds.has(m.id) && (filter !== 'mine' || isMine(m)))

  // `played` is newest first, so consecutive matches share a month
  const monthGroups = []
  historyMatches.forEach(match => {
    const key = monthKey(match.date)
    let group = monthGroups[monthGroups.length - 1]
    if (!group || group.key !== key) {
      group = { key, label: monthLabel(match.date), matches: [] }
      monthGroups.push(group)
    }
    group.matches.push(match)
  })

  const shownGroups = monthGroups.slice(0, visibleMonths)
  const nextGroup = monthGroups[visibleMonths]

  const selectFilter = id => {
    setFilter(id)
    setVisibleMonths(MONTHS_PER_PAGE)
  }

  // ── Pieces ─────────────────────────────────────────────────────────────────
  const renderAdminActions = (match, isClosed) => isAdmin && (
    <div className="mh-admin-actions">
      {isMatchPlayed(match) && (
        <button
          className={`mh-icon-btn ${isClosed ? 'red' : ''}`}
          onClick={() => onToggleRatings(match.id)}
          title={isClosed ? 'Abrir calificaciones' : 'Cerrar calificaciones'}
          aria-label={isClosed ? 'Abrir calificaciones' : 'Cerrar calificaciones'}
        >
          <AppIcon name={isClosed ? 'lock' : 'unlock'} size={13} />
        </button>
      )}
      <button className="mh-icon-btn" onClick={() => onOpenEditMatch(match)} aria-label="Editar partido" title="Editar partido">
        <AppIcon name="note" size={13} />
      </button>
      <button className="mh-icon-btn red" onClick={() => onDeleteMatch(match.id)} aria-label="Eliminar partido" title="Eliminar partido">
        <AppIcon name="trash" size={13} />
      </button>
    </div>
  )

  const renderLineups = match => (
    <div className="mh-lineups">
      {[
        { key: 'white', label: 'Blanco', ids: match.teamWhite },
        { key: 'black', label: 'Negro', ids: match.teamBlack },
      ].map(team => (
        <div key={team.key} className="mh-lineup">
          <div className="mh-lineup-team">
            <span className={`mh-team-dot ${team.key}`} />
            <span>{team.label}</span>
          </div>
          {team.ids.map(id => (
            <div key={id} className={`mh-lineup-player ${id === userPlayer ? 'is-me' : ''}`}>
              <span className="mh-lineup-name">{getPlayerName(id)}{id === userPlayer ? ' (tú)' : ''}</span>
              {match.positions?.[id] && POSITION_LABELS[match.positions[id]] && (
                <span className="mh-lineup-pos">{POSITION_LABELS[match.positions[id]]}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )

  const renderPredictions = match => (
    <div className="predictions-grid">
      {Object.entries(predictions[match.id] || {}).map(([odedBy, predictionData]) => {
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
                <span className="prediction-extra-line">Marcador: {predictedScoreWhite} - {predictedScoreBlack}</span>
              )}
              {predictedMvp && (
                <span className="prediction-extra-line">MVP probable: {predictedMvp}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderScore = (match, size = 'sm') => {
    const scoreWhite = parseScoreValue(match.scoreWhite)
    const scoreBlack = parseScoreValue(match.scoreBlack)
    const hasFinalScore = scoreWhite !== null && scoreBlack !== null
    const whiteState = match.winner === 'white' ? 'winner' : match.winner === 'black' ? 'loser' : ''
    const blackState = match.winner === 'black' ? 'winner' : match.winner === 'white' ? 'loser' : ''
    return (
      <div className={`mh-score ${size}`}>
        <span className={`mh-score-team ${whiteState}`}>
          {size === 'lg' && <span className="mh-team-dot white" />}Blanco
        </span>
        <span className="mh-score-value">
          {hasFinalScore
            ? <><span className={whiteState}>{scoreWhite}</span><span className="mh-score-dash">–</span><span className={blackState}>{scoreBlack}</span></>
            : match.winner === 'tie' ? 'Empate' : 'vs'}
        </span>
        <span className={`mh-score-team ${blackState}`}>
          Negro{size === 'lg' && <span className="mh-team-dot black" />}
        </span>
      </div>
    )
  }

  const renderResultPill = result => result && (
    <span className={`mh-result-pill ${result}`} title={RESULT_TEXT[result]}>{RESULT_LETTER[result]}</span>
  )

  const renderTeamStack = (ids, align) => (
    <div className={`mh-stack ${align}`}>
      {ids.slice(0, 6).map(id => (
        <AvatarImage
          key={id}
          src={getPlayerPhoto(id)}
          name={getPlayerName(id)}
          imgClassName={`mh-stack-avatar ${id === userPlayer ? 'is-me' : ''}`}
          fallbackClassName={`mh-stack-avatar mh-stack-ph ${id === userPlayer ? 'is-me' : ''}`}
        />
      ))}
      {ids.length > 6 && <span className="mh-stack-avatar mh-stack-ph">+{ids.length - 6}</span>}
    </div>
  )

  const renderUpcomingCard = match => {
    const countdown = countdownLabel(match.date)
    const myPrediction = user ? predictions[match.id]?.[user.uid] : null
    const canPredict = user && userPlayer && !myPrediction && !match.winner && (canPredictMatch ? canPredictMatch(match) : true)
    const myTeam = match.teamWhite.includes(userPlayer) ? 'white' : match.teamBlack.includes(userPlayer) ? 'black' : null
    const lineupsOpen = openLineups.has(match.id)
    const predictionCount = predictions[match.id] ? Object.keys(predictions[match.id]).length : 0

    return (
      <article key={match.id} className="mh-card mh-upcoming">
        <div className="mh-upcoming-when">
          <div className="mh-when-text">
            <span className="mh-when-date">{longDate(match.date)}{match.time ? ` · ${match.time}` : ''}</span>
            {match.venue && <span className="mh-when-venue">{match.venue}</span>}
          </div>
          <div className="mh-when-side">
            <span className={`mh-countdown ${countdown ? '' : 'late'}`}>{countdown || 'Falta el resultado'}</span>
            {renderAdminActions(match, match.ratingsOpen === false)}
          </div>
        </div>

        <div className="mh-upcoming-teams">
          <div className="mh-upcoming-team">
            <span className="mh-upcoming-name"><span className="mh-team-dot white" />Blanco</span>
            {renderTeamStack(match.teamWhite, 'left')}
            {myTeam === 'white' && <span className="mh-you-here">Tú juegas aquí</span>}
          </div>
          <span className="mh-vs">VS</span>
          <div className="mh-upcoming-team right">
            <span className="mh-upcoming-name">Negro<span className="mh-team-dot black" /></span>
            {renderTeamStack(match.teamBlack, 'right')}
            {myTeam === 'black' && <span className="mh-you-here">Tú juegas aquí</span>}
          </div>
        </div>

        {lineupsOpen && <div className="mh-card-section">{renderLineups(match)}</div>}

        <div className="mh-actions">
          {canPredict ? (
            <button className="mh-btn predict" onClick={() => onOpenPrediction(match)}>
              <AppIcon name="target" size={15} /> Predecir resultado
            </button>
          ) : myPrediction ? (
            <span className="mh-predicted">
              <AppIcon name="check" size={13} /> Predijiste {myPrediction.prediction === 'white' ? 'Blanco' : 'Negro'}
            </span>
          ) : predictionCount > 0 ? (
            <span className="mh-predicted muted">{predictionCount} {predictionCount === 1 ? 'predicción' : 'predicciones'}</span>
          ) : <span />}
          <button className="mh-btn ghost" onClick={() => toggleLineups(match.id)} aria-expanded={lineupsOpen}>
            <AppIcon name="users" size={15} /> {lineupsOpen ? 'Ocultar' : 'Equipos'}
          </button>
        </div>
      </article>
    )
  }

  const renderToRateCard = match => {
    const result = resultFor(match, userPlayer)
    const matchPlayers = [...match.teamWhite, ...match.teamBlack]
    const ratedCount = matchPlayers.filter(id => hasRated(match, id)).length
    const leader = getMatchPlayerRatings(match)[0]

    return (
      <article key={match.id} className="mh-card mh-torate">
        <div className="mh-torate-top">
          <span className="mh-torate-date">{longDate(match.date)}{match.time ? ` · ${match.time}` : ''}</span>
          {result && (
            <span className="mh-torate-result">
              {renderResultPill(result)} {RESULT_TEXT[result]}
            </span>
          )}
        </div>
        {renderScore(match, 'lg')}
        <div className="mh-progress">
          <div className="mh-progress-labels">
            <span>{ratedCount} de {matchPlayers.length} jugadores ya calificaron</span>
            {leader && <span className="mh-mvp">★ {leader.name} {leader.avgRating}</span>}
          </div>
          <div className="mh-progress-track">
            <div className="mh-progress-fill" style={{ width: `${Math.round((ratedCount / Math.max(matchPlayers.length, 1)) * 100)}%` }} />
          </div>
        </div>
        <button className="mh-btn primary block" onClick={() => onOpenRatingModal(match)}>
          Calificar a mis compañeros
        </button>
      </article>
    )
  }

  const renderHistoryRow = match => {
    const isOpen = expandedId === match.id
    const isClosed = match.ratingsOpen === false
    const matchPlayerRatings = getMatchPlayerRatings(match)
    const top3 = matchPlayerRatings.slice(0, 3)
    const report = getPostMatchReport(match, matchPlayerRatings)
    const predictionCount = predictions[match.id] ? Object.keys(predictions[match.id]).length : 0
    const result = resultFor(match, userPlayer)
    const date = toDate(match.date)
    const predictionsOpen = openPredictions.has(match.id)
    const canRate = user && userPlayer && isMine(match) && !isClosed

    return (
      <div key={match.id} className={`mh-row ${isOpen ? 'is-open' : ''}`}>
        <button
          className="mh-row-main"
          onClick={() => setExpandedId(current => (current === match.id ? null : match.id))}
          aria-expanded={isOpen}
        >
          <span className="mh-row-date">
            <span className="mh-row-day">{date.getDate()}</span>
            <span className="mh-row-weekday">{shortWeekday(match.date)}</span>
          </span>
          <span className="mh-row-body">
            {renderScore(match)}
            <span className="mh-row-meta">
              {top3[0] && <span className="mh-mvp">★ {top3[0].name} {top3[0].avgRating}</span>}
              {top3[0] && predictionCount > 0 && ' · '}
              {predictionCount > 0 && `${predictionCount} ${predictionCount === 1 ? 'predicción' : 'predicciones'}`}
              {!top3[0] && predictionCount === 0 && (match.venue || 'Sin calificaciones')}
            </span>
          </span>
          {renderResultPill(result)}
          <span className={`mh-chevron ${isOpen ? 'open' : ''}`} aria-hidden="true">
            <AppIcon name="arrowDown" size={14} />
          </span>
        </button>

        {isOpen && (
          <div className="mh-detail">
            {(report?.storyline || report?.bestPair || match.venue) && (
              <div className="mh-story">
                <AppIcon name="note" size={14} />
                <div className="mh-story-text">
                  {report?.storyline && <p>{report.storyline}</p>}
                  {report?.bestPair && (
                    <p className="muted">Dupla destacada: {getPlayerName(report.bestPair.p1)} + {getPlayerName(report.bestPair.p2)}</p>
                  )}
                  <p className="muted">
                    {longDate(match.date)}{match.time ? ` · ${match.time}` : ''}{match.venue ? ` · ${match.venue}` : ''}
                  </p>
                </div>
              </div>
            )}

            {top3.length > 0 && (
              <div className="mh-block">
                <span className="mh-block-title">Top del partido</span>
                <div className="mh-top">
                  {top3.map((player, idx) => {
                    if (idx === 0 && player.playerId === userPlayer) {
                      setTimeout(() => triggerMVPConfetti(match.id, player.playerId), 500)
                    }
                    return (
                      <div key={player.playerId} className={`mh-top-row ${player.playerId === userPlayer ? 'is-me' : ''}`}>
                        <span className={`mh-top-pos ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}`}>{idx + 1}</span>
                        <span className="mh-top-name">
                          {player.name}{player.playerId === userPlayer ? ' (tú)' : ''}
                          {idx === 0 && <span className="mh-top-mvp">MVP</span>}
                        </span>
                        <span className="mh-top-score">{player.avgRating}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mh-block">
              <span className="mh-block-title">Alineaciones</span>
              {renderLineups(match)}
            </div>

            {predictionsOpen && predictionCount > 0 && (
              <div className="mh-block">
                <span className="mh-block-title">
                  Predicciones
                  {report?.predictionSummary && (
                    <span className="mh-block-sub">
                      {' · '}{report.predictionSummary.correct} correctas
                      {report.predictionSummary.wrong > 0 ? ` · ${report.predictionSummary.wrong} fallidas` : ''}
                      {report.predictionSummary.voided > 0 ? ` · ${report.predictionSummary.voided} anuladas` : ''}
                    </span>
                  )}
                </span>
                {renderPredictions(match)}
              </div>
            )}

            <div className="mh-actions">
              {canRate && (
                <button className="mh-btn primary" onClick={() => onOpenRatingModal(match)}>
                  Calificar
                </button>
              )}
              <button className="mh-btn ghost" onClick={() => setShareTarget({ match, report })}>
                <AppIcon name="share" size={14} /> Compartir resumen
              </button>
              {predictionCount > 0 && (
                <button className="mh-btn ghost" onClick={() => togglePredictions(match.id)} aria-expanded={predictionsOpen}>
                  <AppIcon name="target" size={14} /> {predictionsOpen ? 'Ocultar predicciones' : 'Ver predicciones'}
                </button>
              )}
              {renderAdminActions(match, isClosed)}
            </div>
          </div>
        )}
      </div>
    )
  }

  const groupSummary = group => {
    const results = group.matches.map(m => resultFor(m, userPlayer)).filter(Boolean)
    const base = `${group.matches.length} ${group.matches.length === 1 ? 'partido' : 'partidos'}`
    if (results.length === 0) return base
    const wins = results.filter(r => r === 'win').length
    const ties = results.filter(r => r === 'tie').length
    const losses = results.filter(r => r === 'loss').length
    return `${base} · ${[wins && `${wins}G`, ties && `${ties}E`, losses && `${losses}P`].filter(Boolean).join(' ')}`
  }

  const nothingToShow =
    (!showUpcoming || visibleUpcoming.length === 0) &&
    toRate.length === 0 &&
    shownGroups.length === 0

  return (
    <section className="stats-section mh-section">
      <div className="mh-header">
        <h2 className="section-title">Partidos</h2>
        <span className="mh-header-sub">{played.length} jugados</span>
      </div>

      {myRecord && (
        <div className="mh-record">
          <div className="mh-record-top">
            <span className="mh-label">Tu récord</span>
            <span className="mh-record-wr">{myRecord.winRate}% efectividad</span>
          </div>
          <div className="mh-record-bottom">
            <div className="mh-record-totals">
              <span className="mh-record-total"><b>{myRecord.wins}</b><i className="win">G</i></span>
              <span className="mh-record-total"><b>{myRecord.ties}</b><i className="tie">E</i></span>
              <span className="mh-record-total"><b>{myRecord.losses}</b><i className="loss">P</i></span>
            </div>
            <div className="mh-record-form">
              <span className="mh-record-form-label">Últimos {myRecord.last5.length}</span>
              <div className="mh-record-pills">
                {myRecord.last5.map((r, i) => <span key={i}>{renderResultPill(r)}</span>)}
              </div>
            </div>
          </div>
        </div>
      )}

      {userPlayer && (
        <div className="mh-filters" role="tablist" aria-label="Filtrar partidos">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'mine', label: 'Jugué' },
            { id: 'pending', label: 'Por calificar', count: toRate.length },
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={filter === tab.id}
              className={`mh-filter ${filter === tab.id ? 'active' : ''}`}
              onClick={() => selectFilter(tab.id)}
            >
              {tab.label}
              {tab.count > 0 && <span className="mh-filter-count">{tab.count}</span>}
            </button>
          ))}
        </div>
      )}

      {validMatches.length === 0 ? (
        <EmptyState
          type="noMatches"
          title="Sin partidos"
          description={isAdmin ? 'Agrega tu primer partido para comenzar' : 'Todavía no hay partidos registrados'}
        />
      ) : (
        <>
          {showUpcoming && visibleUpcoming.length > 0 && (
            <div className="mh-group">
              <h3 className="mh-group-title accent">
                <AppIcon name="calendar" size={13} /> {visibleUpcoming.length === 1 ? 'Próximo partido' : 'Próximos partidos'}
              </h3>
              {visibleUpcoming.map(renderUpcomingCard)}
            </div>
          )}

          {toRate.length > 0 && (
            <div className="mh-group">
              <h3 className="mh-group-title gold">
                <AppIcon name="star" size={13} /> Te falta calificar
              </h3>
              {toRate.map(renderToRateCard)}
            </div>
          )}

          {shownGroups.map(group => (
            <div key={group.key} className="mh-group">
              <div className="mh-group-head">
                <h3 className="mh-group-title">{group.label}</h3>
                <span className="mh-group-summary">{groupSummary(group)}</span>
              </div>
              <div className="mh-card mh-rows">
                {group.matches.map(renderHistoryRow)}
              </div>
            </div>
          ))}

          {nextGroup && (
            <button className="mh-more" onClick={() => setVisibleMonths(n => n + MONTHS_PER_PAGE)}>
              Ver partidos de {nextGroup.label.toLowerCase()}
            </button>
          )}

          {nothingToShow && (
            <p className="mh-empty">
              {filter === 'pending'
                ? 'Estás al día: no tienes partidos por calificar.'
                : filter === 'mine'
                  ? 'Todavía no tienes partidos registrados.'
                  : 'No hay partidos para mostrar.'}
            </p>
          )}
        </>
      )}

      <MatchShareCard
        open={!!shareTarget}
        match={shareTarget?.match}
        report={shareTarget?.report}
        top={shareTarget?.report?.ranking || []}
        getPlayerName={getPlayerName}
        onClose={() => setShareTarget(null)}
      />
    </section>
  )
}

export default MatchesTab
