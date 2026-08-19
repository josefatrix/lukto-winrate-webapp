export const POSITION_OPTIONS = [
  { value: '', label: 'Sin posición' },
  { value: 'portero', label: 'Portero' },
  { value: 'cierre', label: 'Cierre / Defensa' },
  { value: 'lateral_izq', label: 'Lateral Izq' },
  { value: 'lateral_der', label: 'Lateral Der' },
  { value: 'medio', label: 'Mediocampista' },
  { value: 'pivote', label: 'Pivote' },
  { value: 'delantero', label: 'Delantero' },
]

export const MATCH_FORMAT_OPTIONS = [
  { value: '5v5', label: '5 vs 5', teamSize: 5 },
  { value: '6v6', label: '6 vs 6', teamSize: 6 },
  { value: '7v7', label: '7 vs 7', teamSize: 7 },
]

export const DEFAULT_MATCH_FORMAT = '6v6'

export const getFormatTeamSize = (format) => {
  const found = MATCH_FORMAT_OPTIONS.find(opt => opt.value === format)
  return found?.teamSize || 6
}

export const getFormatForTeamSize = (size) => {
  const found = MATCH_FORMAT_OPTIONS.find(opt => opt.teamSize === Number(size))
  return found?.value || DEFAULT_MATCH_FORMAT
}

export const getPositionLabel = (value) => {
  const found = POSITION_OPTIONS.find(opt => opt.value === value)
  return found?.label || ''
}

export const getPositionGroup = (value) => {
  if (!value) return 'Sin posición'
  if (value === 'portero') return 'Portero'
  if (value === 'cierre' || value === 'lateral_izq' || value === 'lateral_der') return 'Defensa'
  if (value === 'medio' || value === 'pivote') return 'Medio'
  if (value === 'delantero') return 'Delantero'
  return 'Otro'
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * Kick-off Date for a match, or null when the date is unusable.
 * Matches without a time default to end-of-day so they stay "upcoming" until
 * the day is over. Shared so the match card, the Hoy screen and the prediction
 * cutoff all agree on when a match starts.
 */
export const getMatchStartDate = (match) => {
  if (!match?.date) return null
  const timeValue = match.time || match.matchTime || match.startTime || '23:59'
  const start = new Date(`${match.date}T${timeValue}:00`)
  return isNaN(start.getTime()) ? null : start
}

/**
 * A match counts as played once it has a result — a winner, or both scores.
 * Ratings only make sense after that; before it, only predictions do.
 * Single source of truth so the match card, the rating modal and the pending
 * notification can never disagree about what is rateable.
 */
export const isMatchPlayed = (match) => {
  if (!match) return false
  if (match.winner) return true
  const white = match.scoreWhite
  const black = match.scoreBlack
  const present = v => v !== null && v !== undefined && v !== '' && !Number.isNaN(Number(v))
  return present(white) && present(black)
}
