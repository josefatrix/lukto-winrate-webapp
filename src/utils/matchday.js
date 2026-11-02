import {
  getMatchStartDate as getSharedMatchStartDate,
  timestampToMillis,
} from '../../functions/lib/attendance.js'
import { isMatchPlayed } from './matchConstants.js'

export {
  deriveAttendanceEntries,
  getMatchCapacity,
  getMatchFormatLabel,
  getMatchStartDate,
  isSafeFirestoreId,
  shouldWriteAttendanceResponse,
  timestampToMillis,
  updateAttendance,
} from '../../functions/lib/attendance.js'

export function getRatingDeadline(match) {
  const value = match?.ratingDeadline
  const explicit = value?.toDate
    ? value.toDate()
    : value?.seconds
      ? new Date(value.seconds * 1000)
      : value
        ? new Date(value)
        : null
  if (explicit && Number.isFinite(explicit.getTime())) return explicit
  const start = getSharedMatchStartDate(match)
  return start ? new Date(start.getTime() + 48 * 60 * 60 * 1000) : null
}
export function isVotingOpen(match, now = Date.now()) {
  if (!isMatchPlayed(match) || match.ratingsOpen === false) return false
  // Existing explicitly open matches retain the administrator's prior choice.
  if (!match.ratingDeadline && match.ratingsOpen === true) return true
  const deadline = getRatingDeadline(match)
  return !!deadline && deadline.getTime() > now
}
export function getRatingProgress(match, ratings, playerId) {
  const targets = new Set(
    [...(match.teamWhite || []), ...(match.teamBlack || [])].filter(id => id !== playerId)
  )
  const completed = [...targets].filter(id =>
    (ratings[id] || []).some(
      r => r.matchId === match.id && (r.ratedBy === playerId || r.odedBy === playerId)
    )
  ).length
  return { completed, total: targets.size }
}
export const formatMatchDate = match => {
  const date = getSharedMatchStartDate(match)
  return date
    ? date.toLocaleDateString('es-CO', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'Fecha por confirmar'
}
export const getMapsUrl = match =>
  match?.venue
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(match.venue)}`
    : null
const escapeCalendar = value =>
  String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
const utcStamp = date =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
export function createMatchCalendar(match) {
  const start = getSharedMatchStartDate(match)
  if (!start) throw new Error('Define la fecha del partido antes de agregarlo a tu calendario.')
  const end = new Date(start.getTime() + 90 * 60 * 1000)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LUKTO//Partido//ES',
    'BEGIN:VEVENT',
    `UID:${escapeCalendar(match.id)}@lukto.app`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    'SUMMARY:LUKTO - Blanco vs Negro',
    `LOCATION:${escapeCalendar(match.venue)}`,
    'DESCRIPTION:Llega temprano y prepárate para jugar. La duración estimada del partido es de 90 minutos.',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:El partido de LUKTO empieza en 30 minutos',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}
export function downloadMatchCalendar(match) {
  const url = URL.createObjectURL(
    new Blob([createMatchCalendar(match)], { type: 'text/calendar;charset=utf-8' })
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `lukto-${match.date || match.id}.ics`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isPredictionOpen(match, now = Date.now()) {
  const kickoff = match?.kickoffAt
  if (!kickoff || (typeof kickoff.toMillis !== 'function' && typeof kickoff.seconds !== 'number'))
    return false
  if (match.winner || ['completed', 'closed', 'finished'].includes(match.status)) return false
  if (match.scoreWhite != null || match.scoreBlack != null) return false
  return timestampToMillis(kickoff) > now + 10 * 60 * 1000
}
