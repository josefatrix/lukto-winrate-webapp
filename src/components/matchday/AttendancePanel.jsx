import { useApp } from '../../contexts'
import { useAttendance } from '../../hooks/useAttendance'
import { getMatchCapacity } from '../../utils/matchday'

export function AttendancePanel({ match }) {
  const { user, userPlayer, handleGoogleLogin } = useApp()
  const { entries, error, loading, busy, canRespond, unavailableReason, respond, retry } =
    useAttendance(match, user, userPlayer)
  const confirmed = Object.values(entries).filter(entry => entry.status === 'confirmed').length
  const waiting = Object.values(entries).filter(entry => entry.status === 'waitlisted').length
  const status = entries[userPlayer]?.status
  const labels = {
    confirmed: 'Estas marcado como disponible',
    waitlisted: 'Estas en lista de espera',
    declined: 'Estas marcado como no disponible',
  }
  const disabled = busy || loading || !!error || !canRespond
  return (
    <div className="md-attendance">
      <div>
        <strong>Disponibilidad</strong>
        <p>
          {loading
            ? 'Cargando asistencia...'
            : user
              ? `${confirmed} confirmados / ${getMatchCapacity(match)} cupos${waiting ? ` / ${waiting} en espera` : ''}`
              : 'Inicia sesion para compartir tu disponibilidad.'}
        </p>
      </div>
      {error ? (
        <div className="md-error" role="alert">
          {error}{' '}
          <button className="md-link" onClick={retry}>
            Reintentar
          </button>
        </div>
      ) : null}
      {status && (
        <p className={`md-response ${status}`} role="status">
          {labels[status]}
        </p>
      )}
      {!error && unavailableReason ? (
        <p className="md-muted" role="status">
          {unavailableReason}
        </p>
      ) : null}
      {!user ? (
        <button
          className="md-button primary"
          disabled={!!unavailableReason}
          onClick={handleGoogleLogin}
        >
          Iniciar sesion para responder
        </button>
      ) : !userPlayer ? (
        <p>Pide a un administrador que vincule tu cuenta con un jugador.</p>
      ) : (
        <div className="md-actions">
          <button
            className="md-button primary"
            disabled={disabled || status === 'confirmed' || status === 'waitlisted'}
            onClick={() => respond('confirmed')}
          >
            {busy
              ? 'Guardando...'
              : confirmed >= getMatchCapacity(match)
                ? 'Entrar a lista de espera'
                : 'Cuenten conmigo'}
          </button>
          <button
            className="md-button"
            disabled={disabled || status === 'declined'}
            onClick={() => respond('declined')}
          >
            No puedo ir
          </button>
        </div>
      )}
      <small>La lista de espera va en orden cronologico. El admin confirma los equipos antes del inicio.</small>
    </div>
  )
}
