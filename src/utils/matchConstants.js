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
  { value: '6v6', label: '6 vs 6', teamSize: 6 },
  { value: '7v7', label: '7 vs 7', teamSize: 7 },
]

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
