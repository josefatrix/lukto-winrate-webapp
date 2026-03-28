import React from 'react'

const XP_THRESHOLDS = [
  0, 50, 84, 117, 150, 200, 250, 300, 367, 433, 500, 567, 633, 700, 800, 900, 1000, 1167,
  1334, 1500,
]

export function getRankIcon(rank, size = 16) {
  const icons = {
    leyenda: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
        <path d="M12 6l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 9.5l3.5-.5z" />
      </svg>
    ),
    maestro: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z" />
      </svg>
    ),
    diamante: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M19 3H5L2 9l10 12L22 9l-3-6zM12 17.3L5 9h14l-7 8.3z" />
      </svg>
    ),
    platino: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    oro: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
      </svg>
    ),
    plata: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
      </svg>
    ),
    bronce: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <circle cx="12" cy="12" r="10" />
      </svg>
    ),
    none: (
      <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
        <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  }
  return icons[rank] || icons.none
}

export function getRank(xp) {
  if (xp >= 1500) return { name: 'Leyenda', key: 'leyenda', color: '#ff6b6b', tier: 7 }

  if (xp >= 1334) return { name: 'Maestro I', key: 'maestro', color: '#a855f7', tier: 6 }
  if (xp >= 1167) return { name: 'Maestro II', key: 'maestro', color: '#a855f7', tier: 6 }
  if (xp >= 1000) return { name: 'Maestro III', key: 'maestro', color: '#a855f7', tier: 6 }

  if (xp >= 900) return { name: 'Diamante I', key: 'diamante', color: '#00d4ff', tier: 5 }
  if (xp >= 800) return { name: 'Diamante II', key: 'diamante', color: '#00d4ff', tier: 5 }
  if (xp >= 700) return { name: 'Diamante III', key: 'diamante', color: '#00d4ff', tier: 5 }

  if (xp >= 633) return { name: 'Platino I', key: 'platino', color: '#22d3ee', tier: 4 }
  if (xp >= 567) return { name: 'Platino II', key: 'platino', color: '#22d3ee', tier: 4 }
  if (xp >= 500) return { name: 'Platino III', key: 'platino', color: '#22d3ee', tier: 4 }

  if (xp >= 433) return { name: 'Oro I', key: 'oro', color: '#ffd700', tier: 3 }
  if (xp >= 367) return { name: 'Oro II', key: 'oro', color: '#ffd700', tier: 3 }
  if (xp >= 300) return { name: 'Oro III', key: 'oro', color: '#ffd700', tier: 3 }

  if (xp >= 250) return { name: 'Plata I', key: 'plata', color: '#c0c0c0', tier: 2 }
  if (xp >= 200) return { name: 'Plata II', key: 'plata', color: '#c0c0c0', tier: 2 }
  if (xp >= 150) return { name: 'Plata III', key: 'plata', color: '#c0c0c0', tier: 2 }

  if (xp >= 117) return { name: 'Bronce I', key: 'bronce', color: '#cd7f32', tier: 1 }
  if (xp >= 84) return { name: 'Bronce II', key: 'bronce', color: '#cd7f32', tier: 1 }
  if (xp >= 50) return { name: 'Bronce III', key: 'bronce', color: '#cd7f32', tier: 1 }

  return { name: 'Sin rango', key: 'none', color: '#666', tier: 0 }
}

export function getXPProgress(xp) {
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= XP_THRESHOLDS[i]) {
      const current = XP_THRESHOLDS[i]
      const next = XP_THRESHOLDS[i + 1] ?? XP_THRESHOLDS[i]
      const progress = next === current ? 100 : ((xp - current) / (next - current)) * 100
      return { current, next, progress: Math.min(progress, 100) }
    }
  }
  return { current: 0, next: 50, progress: (xp / 50) * 100 }
}

export function getWinRateClass(rate) {
  if (rate >= 60) return 'high'
  if (rate >= 40) return 'medium'
  return 'low'
}

export function getRatingClass(rating) {
  if (rating >= 8) return 'high'
  if (rating >= 6) return 'medium'
  return 'low'
}

export function formatDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function getPredictionBet(pred) {
  return pred?.lukCoinsBet ?? pred?.xpBet ?? 0
}

export function getPredictionWin(pred) {
  return pred?.lukCoinsWin ?? pred?.potentialWin ?? 0
}
