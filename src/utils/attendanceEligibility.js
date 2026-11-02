import { isMatchPlayed } from './matchConstants.js'
import { isSafeFirestoreId, timestampToMillis } from './matchday.js'

export const getAttendanceKickoffMillis = match => timestampToMillis(match?.kickoffAt)

export const getAttendanceUnavailableReason = (match, now = Date.now()) => {
  if (!match?.id) return 'Selecciona un partido antes de responder.'
  if (!isSafeFirestoreId(String(match.id)))
    return 'La asistencia no está disponible para este partido.'
  if (isMatchPlayed(match)) return 'La confirmación de asistencia está cerrada para este partido.'
  const kickoff = getAttendanceKickoffMillis(match)
  if (kickoff === null)
    return 'Pide a un administrador que guarde la hora de inicio para habilitar las respuestas.'
  if (kickoff <= now) return 'La confirmación de asistencia está cerrada para este partido.'
  return ''
}

export const shouldSubscribeToAttendance = ({ match, uid, playerId, now = Date.now() }) => {
  const safeMatchId = match?.id ? String(match.id).trim() : ''
  const safeUid = typeof uid === 'string' ? uid.trim() : ''
  const safePlayerId = typeof playerId === 'string' ? playerId.trim() : ''

  return (
    isSafeFirestoreId(safeMatchId) &&
    isSafeFirestoreId(safeUid) &&
    isSafeFirestoreId(safePlayerId) &&
    !getAttendanceUnavailableReason(match, now)
  )
}
