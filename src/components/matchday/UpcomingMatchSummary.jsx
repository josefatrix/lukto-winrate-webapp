import '../../styles/matchday.css'
import { getMatchStartDate } from '../../utils/matchConstants'
import { formatMatchDate, getMatchFormatLabel } from '../../utils/matchday'

const formatTime = match => {
  const start = getMatchStartDate(match)
  if (start) {
    return start.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })
  }
  return match?.time || 'Hora por confirmar'
}

export function UpcomingMatchSummary({ match, onOpen }) {
  if (!match) return null

  const formatLabel = getMatchFormatLabel(match)
  const content = (
    <>
      <span className="md-upcoming-kicker">Proximo</span>
      <span className="md-upcoming-main">
        <strong>{formatMatchDate(match)}</strong>
        <span>{formatTime(match)}</span>
        {match.venue && <span>{match.venue}</span>}
        {formatLabel && <span>{formatLabel}</span>}
      </span>
      <span className="md-upcoming-action">{onOpen ? 'Abrir' : 'Programado'}</span>
    </>
  )

  if (onOpen) {
    return (
      <button type="button" className="md-upcoming-summary" onClick={() => onOpen(match)}>
        {content}
      </button>
    )
  }

  return <div className="md-upcoming-summary">{content}</div>
}
