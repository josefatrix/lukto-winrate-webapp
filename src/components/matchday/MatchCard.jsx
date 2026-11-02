import { useEffect, useState } from 'react'

import { useApp } from '../../contexts'
import '../../styles/matchday.css'
import { getMatchStartDate, isMatchPlayed } from '../../utils/matchConstants'
import {
  formatMatchDate,
  getMatchFormatLabel,
  getRatingDeadline,
  getRatingProgress,
  isPredictionOpen,
  isVotingOpen,
} from '../../utils/matchday'
import { getMatchMvp } from '../../utils/statistics'
import { MatchShareCard } from '../common'
import { AttendancePanel } from './AttendancePanel'
import { MatchUtilities } from './MatchUtilities'

export function MatchCard({
  match,
  featured = false,
  onOpenRatingModal,
  onOpenPrediction,
  canPredictMatch,
  onOpenEditMatch,
  onDeleteMatch,
  onToggleRatings,
  triggerMVPConfetti,
  highlighted = false,
  now = Date.now(),
}) {
  const {
    user,
    userPlayer,
    ratings,
    predictions,
    getPlayerName,
    isAdmin,
    leagueSettings,
    handleGoogleLogin,
  } = useApp()
  const [expanded, setExpanded] = useState(false)
  const [share, setShare] = useState(false)
  const played = isMatchPlayed(match)
  const voting = isVotingOpen(match, now)
  const start = getMatchStartDate(match)
  const future = !played && (!start || start.getTime() > now)
  const deadline = getRatingDeadline(match)
  const participants = [...(match.teamWhite || []), ...(match.teamBlack || [])]
  const mine = participants.includes(userPlayer)
  const progress = getRatingProgress(match, ratings || {}, userPlayer)
  const prediction = predictions?.[match.id]?.[user?.uid]
  const mvp = getMatchMvp(match, ratings || {}, leagueSettings?.mvpMinVotes ?? 4)
  const formatLabel = getMatchFormatLabel(match)
  const mvpMinVotes = leagueSettings?.mvpMinVotes ?? 4
  const scorePresent = value =>
    value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  const hasScore = scorePresent(match.scoreWhite) && scorePresent(match.scoreBlack)
  const whiteWon = match.winner === 'white'
  const blackWon = match.winner === 'black'
  const scoreLabel = hasScore
    ? `${match.scoreWhite} : ${match.scoreBlack}`
    : played
      ? match.winner === 'tie'
        ? 'Empate'
        : 'Finalizado'
      : 'VS'
  const ratingNote =
    voting && match.ratingsOpen === true && !match.ratingDeadline
      ? 'Abierta hasta que el admin la cierre'
      : deadline
        ? `${voting ? 'Cierra' : 'Cerro'} ${deadline.toLocaleString('es-CO', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'Sin fecha limite'
  const mvpPlayerIds = mvp ? (mvp.tiedPlayerIds?.length ? mvp.tiedPlayerIds : [mvp.playerId]) : []
  const mvpNames = mvpPlayerIds.map(getPlayerName).join(' & ')
  const predictionWindowOpen = canPredictMatch
    ? canPredictMatch(match)
    : isPredictionOpen(match, now)
  const predictionStatus =
    future && !prediction
      ? !match.kickoffAt
        ? 'Pide a un administrador que guarde la hora de inicio para activar predicciones.'
        : !predictionWindowOpen
          ? 'Las predicciones cerraron cerca del inicio.'
          : !user
            ? 'Inicia sesion para predecir.'
            : !userPlayer
              ? 'Pide a un administrador que vincule tu cuenta para predecir.'
              : ''
      : ''
  const report = {
    scoreWhite: Number(match.scoreWhite),
    scoreBlack: Number(match.scoreBlack),
    hasFinalScore: hasScore,
    mvp: mvp ? { ...mvp, name: getPlayerName(mvp.playerId) } : null,
  }
  const status = played ? 'Jugado' : future ? 'Proximo' : 'Esperando resultado'
  useEffect(() => {
    if (!played || !mvp || !userPlayer) return
    const winnerIds = mvp.tiedPlayerIds?.length ? mvp.tiedPlayerIds : [mvp.playerId]
    if (winnerIds.includes(userPlayer)) triggerMVPConfetti?.(match.id, userPlayer)
  }, [match.id, mvp, played, triggerMVPConfetti, userPlayer])
  return (
    <article
      id={`match-${match.id}`}
      className={`md-card ${featured ? 'md-featured' : ''} ${highlighted ? 'md-highlighted' : ''}`}
    >
      <div className="md-card-head">
        <div>
          <span className="md-eyebrow">
            {featured ? 'PROXIMO EN CANCHA' : formatMatchDate(match)}
          </span>
          {featured && <h2>{formatMatchDate(match)}</h2>}
          <p>
            {match.time || 'Hora por confirmar'}
            {match.venue ? ` / ${match.venue}` : ''}
            {formatLabel ? ` / ${formatLabel}` : ''}
          </p>
        </div>
        <span className={`md-badge ${future ? 'lime' : ''}`}>{status}</span>
      </div>
      <div className="md-match-row">
        <div className={`md-match-side ${whiteWon ? 'winner' : ''}`}>
          <i className="md-team-mark white" />
          <strong>Blanco</strong>
          {whiteWon && <small>Ganador</small>}
        </div>
        <div className={`md-score-compact ${match.winner === 'tie' ? 'tie' : ''}`}>
          {hasScore ? (
            <span
              className="md-score-numbers"
              aria-label={`Blanco ${match.scoreWhite}, Negro ${match.scoreBlack}`}
            >
              <strong className={whiteWon ? 'winner' : ''}>{match.scoreWhite}</strong>
              <span>:</span>
              <strong className={blackWon ? 'winner' : ''}>{match.scoreBlack}</strong>
            </span>
          ) : (
            <strong>{scoreLabel}</strong>
          )}
          {played && !hasScore && <small>Marcador no registrado</small>}
        </div>
        <div className={`md-match-side right ${blackWon ? 'winner' : ''}`}>
          <i className="md-team-mark black" />
          <strong>Negro</strong>
          {blackWon && <small>Ganador</small>}
        </div>
      </div>
      {mine && !played && (
        <p className="md-your-team">
          Tu equipo / <strong>{match.teamWhite?.includes(userPlayer) ? 'Blanco' : 'Negro'}</strong>
        </p>
      )}
      {future && <AttendancePanel match={match} />}
      {played && (
        <div className="md-match-insights">
          <span className={`md-status-dot ${voting ? 'open' : ''}`}>
            {voting ? 'Votacion abierta' : 'Votacion cerrada'}
          </span>
          <span>{ratingNote}</span>
          {mine && (
            <strong>
              {progress.completed} / {progress.total} calificados
            </strong>
          )}
          {mvp && (
            <span>
              MVP / {mvpNames} <strong>{Number(mvp.avgRating).toFixed(1)}</strong>
            </span>
          )}
        </div>
      )}
      <div className="md-actions md-card-actions">
        {user && mine && voting && (
          <button className="md-button primary" onClick={() => onOpenRatingModal?.(match)}>
            {progress.completed ? 'Editar tus calificaciones' : 'Calificar jugadores'}
          </button>
        )}
        {!user && played && voting && (
          <button className="md-button primary" onClick={handleGoogleLogin}>
            Inicia sesion para calificar
          </button>
        )}
        {user && !userPlayer && played && voting && (
          <span className="md-prediction">Pide a un administrador que vincule tu cuenta para calificar.</span>
        )}
        {user && userPlayer && future && !prediction && predictionWindowOpen && (
          <button className="md-button primary" onClick={() => onOpenPrediction?.(match)}>
            Hacer una prediccion
          </button>
        )}
        {prediction && (
          <span className="md-prediction">
            Tu eleccion: {prediction.prediction === 'white' ? 'Blanco' : 'Negro'}
            {played
              ? match.winner === 'tie'
                ? ' / Empate'
                : prediction.prediction === match.winner
                  ? ' / Correcta'
                  : ' / Incorrecta'
              : ''}
          </span>
        )}
        {predictionStatus && <span className="md-prediction">{predictionStatus}</span>}
        <button
          className="md-button"
          aria-expanded={expanded}
          aria-controls={`lineups-${match.id}`}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Ocultar alineaciones' : `Alineaciones / ${participants.length}`}
        </button>
        {played && (
          <button className="md-button" onClick={() => setShare(true)}>
            Compartir resumen
          </button>
        )}
        <MatchUtilities match={match} />
      </div>
      {expanded && (
        <div className="md-details" id={`lineups-${match.id}`}>
          {played && !mvp && (
            <p className="md-detail-note">
              El MVP aparece cuando un jugador recibe {mvpMinVotes} votos.
            </p>
          )}
          {played && voting && user && userPlayer && !mine && (
            <p className="md-detail-note">
              Las calificaciones solo estan disponibles para jugadores asignados a este partido.
            </p>
          )}
          <div className="md-lineups">
            {[
              { key: 'White', label: 'Blanco' },
              { key: 'Black', label: 'Negro' },
            ].map(team => (
              <div key={team.key}>
                <h3>Equipo {team.label}</h3>
                {(match[`team${team.key}`] || []).map(id => (
                  <p key={id}>
                    {getPlayerName(id)}
                    {id === userPlayer && <small> Tu</small>}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      {isAdmin && (
        <details className="md-admin">
          <summary>Administrar partido</summary>
          <div className="md-actions">
            <button className="md-button" onClick={() => onOpenEditMatch?.(match)}>
              Editar partido
            </button>
            {played && (
              <button className="md-button" onClick={() => onToggleRatings?.(match.id)}>
                {match.ratingsOpen === false ? 'Abrir votacion' : 'Cerrar votacion'}
              </button>
            )}
            <button className="md-button danger" onClick={() => onDeleteMatch?.(match.id)}>
              Eliminar partido
            </button>
          </div>
        </details>
      )}
      <MatchShareCard
        open={share}
        match={match}
        report={report}
        top={mvp ? [report.mvp] : []}
        getPlayerName={getPlayerName}
        onClose={() => setShare(false)}
      />
    </article>
  )
}
