export const MATCH_FORMATS = [
  { value: '5v5', teamSize: 5 },
  { value: '6v6', teamSize: 6 },
  { value: '7v7', teamSize: 7 },
]

export const getFormatTeamSize = format => {
  const found = MATCH_FORMATS.find(option => option.value === format)
  return found?.teamSize || 6
}

export const getMatchCapacity = match =>
  Number.isInteger(Number(match?.capacity)) && Number(match.capacity) > 0
    ? Number(match.capacity)
    : Number.isInteger(Number(match?.teamSize)) && Number(match.teamSize) > 0
      ? Number(match.teamSize) * 2
      : getFormatTeamSize(match?.matchFormat || match?.format) * 2

export const getMatchFormatLabel = match => {
  if (match?.matchFormat) return match.matchFormat
  if (match?.format) return match.format
  if (Number.isInteger(Number(match?.teamSize)) && Number(match.teamSize) > 0) {
    return `${Number(match.teamSize)}v${Number(match.teamSize)}`
  }
  return ''
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
const OFFSET_PATTERN = /^[+-]\d{2}:\d{2}$/
const DEFAULT_UTC_OFFSET = '-05:00'

const validDateParts = (year, month, day) => {
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

export const getMatchStartDate = match => {
  if (!match?.date) return null
  const dateParts = DATE_PATTERN.exec(String(match.date))
  if (!dateParts) return null
  const timeValue = String(match.time || match.matchTime || match.startTime || '23:59')
  const timeParts = TIME_PATTERN.exec(timeValue)
  if (!timeParts) return null
  const offset = match.utcOffset || DEFAULT_UTC_OFFSET
  if (!OFFSET_PATTERN.test(offset)) return null

  const [, yearText, monthText, dayText] = dateParts
  const [, hourText, minuteText, secondText = '00'] = timeParts
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)

  if (!validDateParts(year, month, day)) return null
  if (hour > 23 || minute > 59 || second > 59) return null

  const start = new Date(
    `${match.date}T${timeValue.length === 5 ? `${timeValue}:00` : timeValue}${offset}`
  )
  return Number.isFinite(start.getTime()) ? start : null
}

export const isSafeFirestoreId = value => {
  const id = typeof value === 'string' ? value.trim() : ''
  return !!id && !id.includes('/')
}

export const timestampToMillis = value => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value?.toMillis) return value.toMillis()
  if (value?.seconds !== undefined) return Number(value.seconds) * 1000
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const isMatchPlayed = match => {
  if (!match) return false
  if (match.winner) return true
  const present = value =>
    value !== null && value !== undefined && value !== '' && !Number.isNaN(Number(value))
  return present(match.scoreWhite) && present(match.scoreBlack)
}

export function updateAttendance(current, playerId, uid, intent, capacity, now = Date.now()) {
  if (!playerId || !uid) throw new Error('Sign in with a linked player to respond.')
  if (!['confirmed', 'declined'].includes(intent)) throw new Error('Invalid attendance response.')
  const entries = Object.fromEntries(
    Object.entries(current || {}).map(([id, entry]) => [id, { ...entry }])
  )
  const previous = entries[playerId]
  if (previous && previous.uid !== uid) {
    throw new Error(
      "This player's attendance belongs to another account. Contact an administrator."
    )
  }
  const retaining = intent === 'confirmed' && ['confirmed', 'waitlisted'].includes(previous?.status)
  entries[playerId] = {
    playerId,
    uid,
    status: intent === 'declined' ? 'declined' : retaining ? previous.status : 'waitlisted',
    requestedAt: retaining ? previous.requestedAt : now,
    updatedAt: now,
  }
  let available = Math.max(
    0,
    capacity - Object.values(entries).filter(entry => entry.status === 'confirmed').length
  )
  Object.values(entries)
    .filter(entry => entry.status === 'waitlisted')
    .sort((a, b) => a.requestedAt - b.requestedAt || a.playerId.localeCompare(b.playerId))
    .forEach(entry => {
      if (available > 0) {
        entry.status = 'confirmed'
        entry.updatedAt = now
        available -= 1
      }
    })
  return entries
}

export function deriveAttendanceEntries(responses, capacity) {
  const rows = (responses || [])
    .map(response => {
      const playerId = typeof response?.playerId === 'string' ? response.playerId.trim() : ''
      const uid = typeof response?.uid === 'string' ? response.uid.trim() : ''
      const intent = response?.intent
      const updatedAt = timestampToMillis(response?.updatedAt)
      if (
        !isSafeFirestoreId(playerId) ||
        !isSafeFirestoreId(uid) ||
        !['confirmed', 'declined'].includes(intent) ||
        updatedAt === null
      ) {
        return null
      }
      return {
        playerId,
        uid,
        intent,
        requestedAt: updatedAt,
        updatedAt,
      }
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.requestedAt - b.requestedAt ||
        a.playerId.localeCompare(b.playerId) ||
        a.uid.localeCompare(b.uid)
    )

  const entries = {}
  const seenPlayers = new Set()
  let confirmed = 0
  const safeCapacity = Math.max(0, Number(capacity) || 0)

  rows.forEach(row => {
    if (seenPlayers.has(row.playerId)) return
    seenPlayers.add(row.playerId)
    const status =
      row.intent === 'declined' ? 'declined' : confirmed < safeCapacity ? 'confirmed' : 'waitlisted'
    if (status === 'confirmed') confirmed += 1
    entries[row.playerId] = {
      playerId: row.playerId,
      uid: row.uid,
      status,
      requestedAt: row.requestedAt,
      updatedAt: row.updatedAt,
    }
  })

  return entries
}

export const shouldWriteAttendanceResponse = (previous, playerId, intent) =>
  previous?.playerId !== playerId || previous?.intent !== intent
