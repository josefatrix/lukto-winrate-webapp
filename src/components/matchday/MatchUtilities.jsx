import { useEffect, useState } from 'react'

import { getMatchStartDate, isMatchPlayed } from '../../utils/matchConstants'
import {
  downloadMatchCalendar,
  getMapsUrl,
  getRatingDeadline,
  isVotingOpen,
} from '../../utils/matchday'

export function MatchUtilities({ match }) {
  const [reminder, setReminder] = useState(false)
  const [message, setMessage] = useState('')
  const start = getMatchStartDate(match)
  const played = isMatchPlayed(match)
  const reminderTime = played
    ? getRatingDeadline(match)?.getTime() - 60 * 60 * 1000
    : start?.getTime() - 30 * 60 * 1000
  const canRemind =
    reminderTime > Date.now() &&
    (!played || isVotingOpen(match)) &&
    !(played && match.ratingsOpen === true && !match.ratingDeadline)
  const reminderStillAvailable = () =>
    reminderTime > Date.now() &&
    (!played || isVotingOpen(match, Date.now())) &&
    !(played && match.ratingsOpen === true && !match.ratingDeadline)
  useEffect(() => {
    if (!reminder || !reminderTime) return undefined
    const timer = window.setInterval(() => {
      if (Date.now() < reminderTime) return
      const text = played
        ? 'Queda una hora para calificar a tus companeros.'
        : 'Tu partido de LUKTO empieza en 30 minutos.'
      setMessage(text)
      setReminder(false)
      try {
        if (Notification.permission === 'granted')
          new Notification('Fecha LUKTO', { body: text })
      } catch {
        /* The in-page reminder remains available. */
      }
    }, 15000)
    return () => window.clearInterval(timer)
  }, [reminder, reminderTime, played])
  const enableReminder = async () => {
    if (reminder) {
      setReminder(false)
      setMessage('Recordatorio cancelado.')
      return
    }
    try {
      if (!reminderStillAvailable()) {
        setMessage('La hora del recordatorio ya paso. Usa el evento de calendario para proximos recordatorios.')
        return
      }
      if (!('Notification' in window)) {
        setMessage('Las notificaciones no estan disponibles en este navegador. Usa el recordatorio del calendario.')
        return
      }
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setMessage('No se concedio permiso para notificaciones. Usa el recordatorio del calendario.')
        return
      }
      if (!reminderStillAvailable()) {
        setMessage('La hora del recordatorio ya paso. Usa el evento de calendario para proximos recordatorios.')
        return
      }
      setReminder(true)
      setMessage(
        'Recordatorio activado mientras esta pagina siga abierta. Agrega el evento al calendario para recibirlo despues de salir de la app.'
      )
    } catch {
      setMessage('No se pudieron activar las notificaciones. Usa el recordatorio del calendario.')
    }
  }
  return (
    <div className="md-utilities">
      <div className="md-actions">
        {!played && start && (
          <button
            className="md-button"
            onClick={() => {
              try {
                downloadMatchCalendar(match)
              } catch (error) {
                setMessage(error.message)
              }
            }}
          >
            Agregar al calendario
          </button>
        )}
        {getMapsUrl(match) && (
          <a className="md-button" href={getMapsUrl(match)} target="_blank" rel="noreferrer">
            Como llegar
          </a>
        )}
        {canRemind && (
          <button className="md-button" onClick={enableReminder}>
            {reminder ? 'Cancelar recordatorio' : 'Recordarme'}
          </button>
        )}
      </div>
      {message && (
        <p className="md-muted" role="status">
          {message}
        </p>
      )}
    </div>
  )
}
