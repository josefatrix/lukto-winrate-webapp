/**
 * Rank Icon Component
 * SVG icons for different player ranks
 */


const rankIcons = {
  leyenda: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <path d="M12 6l1.5 3 3.5.5-2.5 2.5.5 3.5-3-1.5-3 1.5.5-3.5L7 9.5l3.5-.5z"/>
    </svg>
  ),
  maestro: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4l2-4z"/>
    </svg>
  ),
  diamante: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M19 3H5L2 9l10 12L22 9l-3-6zM12 17.3L5 9h14l-7 8.3z"/>
    </svg>
  ),
  platino: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  oro: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
    </svg>
  ),
  plata: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/>
    </svg>
  ),
  bronce: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  none: (size) => (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2"/>
    </svg>
  )
}

// Rank data with colors
export const RANK_DATA = {
  leyenda: { name: 'Leyenda', color: '#ff6b6b', tier: 7, minXP: 1500 },
  maestro: { name: 'Maestro', color: '#a855f7', tier: 6, minXP: 1000 },
  diamante: { name: 'Diamante', color: '#00d4ff', tier: 5, minXP: 700 },
  platino: { name: 'Platino', color: '#22d3ee', tier: 4, minXP: 500 },
  oro: { name: 'Oro', color: '#ffd700', tier: 3, minXP: 300 },
  plata: { name: 'Plata', color: '#c0c0c0', tier: 2, minXP: 150 },
  bronce: { name: 'Bronce', color: '#cd7f32', tier: 1, minXP: 50 },
  none: { name: 'Sin rango', color: '#666', tier: 0, minXP: 0 }
}

/**
 * Get rank data from XP
 */
export const getRankFromXP = (xp) => {
  if (xp >= RANK_DATA.leyenda.minXP) return { ...RANK_DATA.leyenda, key: 'leyenda' }
  if (xp >= RANK_DATA.maestro.minXP) return { ...RANK_DATA.maestro, key: 'maestro' }
  if (xp >= RANK_DATA.diamante.minXP) return { ...RANK_DATA.diamante, key: 'diamante' }
  if (xp >= RANK_DATA.platino.minXP) return { ...RANK_DATA.platino, key: 'platino' }
  if (xp >= RANK_DATA.oro.minXP) return { ...RANK_DATA.oro, key: 'oro' }
  if (xp >= RANK_DATA.plata.minXP) return { ...RANK_DATA.plata, key: 'plata' }
  if (xp >= RANK_DATA.bronce.minXP) return { ...RANK_DATA.bronce, key: 'bronce' }
  return { ...RANK_DATA.none, key: 'none' }
}

/**
 * Rank Icon Component
 */
export const RankIcon = ({ rank, size = 16, className = '' }) => {
  const IconComponent = rankIcons[rank] || rankIcons.none
  const rankData = RANK_DATA[rank] || RANK_DATA.none
  
  return (
    <span 
      className={`rank-icon rank-${rank} ${className}`}
      style={{ color: rankData.color }}
      title={rankData.name}
    >
      {IconComponent(size)}
    </span>
  )
}

export default RankIcon

