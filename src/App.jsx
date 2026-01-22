/**
 * LUKTO Stats - Main App Component
 * Premium version with Apple-style interactions
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp, SUPER_ADMIN_EMAIL } from './contexts'
import { useStats, useHaptic } from './hooks'
import { doc, setDoc, collection, writeBatch, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import confetti from 'canvas-confetti'

// Import components
import { Header, BottomNav } from './components/layout'
import { StatsTab, MatchesTab, RatingsTab, StoreTab } from './components/tabs'
import { AdminLoginModal, PendingUserModal } from './components/modals'
import { AvatarImage, FloatingActionButton, SkeletonPage, SkeletonTable, SkeletonMatchesList, Onboarding, useOnboarding, EmptyState, AnimatedCounter, PendingRatingsNotification } from './components/common'

// ============ HELPER FUNCTIONS ============

const getWinRateClass = rate => {
  if (rate >= 60) return 'high'
  if (rate >= 40) return 'medium'
  return 'low'
}

const getRatingClass = rating => {
  if (rating >= 8) return 'high'
  if (rating >= 6) return 'medium'
  return 'low'
}

const formatDate = dateStr => {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const getPredictionBet = pred => pred?.lukCoinsBet ?? pred?.xpBet ?? 0
const getPredictionWin = pred => pred?.lukCoinsWin ?? pred?.potentialWin ?? 0

// ============ RANK SYSTEM ============

const getRankIcon = (rank, size = 16) => {
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

const getRank = xp => {
  if (xp >= 1500) return { name: 'Leyenda', key: 'leyenda', color: '#ff6b6b', tier: 7 }
  if (xp >= 1000) return { name: 'Maestro', key: 'maestro', color: '#a855f7', tier: 6 }
  if (xp >= 700) return { name: 'Diamante', key: 'diamante', color: '#00d4ff', tier: 5 }
  if (xp >= 500) return { name: 'Platino', key: 'platino', color: '#22d3ee', tier: 4 }
  if (xp >= 300) return { name: 'Oro', key: 'oro', color: '#ffd700', tier: 3 }
  if (xp >= 150) return { name: 'Plata', key: 'plata', color: '#c0c0c0', tier: 2 }
  if (xp >= 50) return { name: 'Bronce', key: 'bronce', color: '#cd7f32', tier: 1 }
  return { name: 'Sin rango', key: 'none', color: '#666', tier: 0 }
}

const getXPProgress = xp => {
  const thresholds = [0, 50, 150, 300, 500]
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (xp >= thresholds[i]) {
      const current = thresholds[i]
      const next = thresholds[i + 1] || thresholds[i]
      const progress = next === current ? 100 : ((xp - current) / (next - current)) * 100
      return { current, next, progress: Math.min(progress, 100) }
    }
  }
  return { current: 0, next: 50, progress: (xp / 50) * 100 }
}

// ============ PROFILE SVG ICONS ============
const ProfileIcons = {
  trophy: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  fire: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
      <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
    </svg>
  ),
  crown: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .55-.45 1-1 1H6c-.55 0-1-.45-1-1v-1h14v1z"/>
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z"/>
    </svg>
  ),
  controller: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H8v3H6v-3H3v-2h3V8h2v3h3v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4-3c-.83 0-1.5-.67-1.5-1.5S18.67 9 19.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
    </svg>
  ),
  muscle: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29z"/>
    </svg>
  ),
  check100: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
    </svg>
  ),
  arrowUp: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M7 14l5-5 5 5H7z"/>
    </svg>
  ),
  arrowDown: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M7 10l5 5 5-5H7z"/>
    </svg>
  ),
  medal: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M12 7.5c1.93 0 3.5 1.57 3.5 3.5s-1.57 3.5-3.5 3.5-3.5-1.57-3.5-3.5 1.57-3.5 3.5-3.5zM12 2L9 9h6l-3-7zM5 9l7 13 7-13H5zm7 4.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
    </svg>
  ),
  heartBroken: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
      <path fill="var(--bg-card)" d="M12 5l-1 4h2l-1 4"/>
    </svg>
  ),
  diamond: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M19 3H5L2 9l10 12L22 9l-3-6zm-7 14.5L5.5 9h13L12 17.5z"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  ),
  thumbsup: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/>
    </svg>
  ),
  rocket: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2.5c-3.9 3.9-5.5 9.3-4.3 14.3l2.6-2.6c-.3-1.4-.1-2.9.6-4.2.7-1.3 1.8-2.3 3.1-2.9 1.3-.6 2.7-.7 4.1-.3l2.6-2.6c-5-1.2-10.4.4-14.3 4.3l-2.1-2.1L2 8.5v7l3.5 3.5h7l2.1-2.1-2.1-2.1c-1.2.9-2.8 1.1-4.2.5-1.4-.6-2.4-1.9-2.6-3.4l-2.6 2.6c.5 2.1 1.7 4 3.4 5.4l-3.5 3.5v2h2l3.5-3.5c1.4 1.7 3.3 2.9 5.4 3.4l2.6-2.6c-1.5-.2-2.8-1.2-3.4-2.6-.6-1.4-.4-3 .5-4.2L21.5 2l-9.5 9.5z"/>
    </svg>
  ),
  flame: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 23c-3.87 0-7-3.13-7-7 0-2.38 1.19-4.47 3-5.74V10c0-3.87 3.13-7 7-7s7 3.13 7 7v.26c1.81 1.27 3 3.36 3 5.74 0 3.87-3.13 7-7 7zm0-4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0-14c-2.76 0-5 2.24-5 5v2.62c1.23.82 2.15 2.02 2.56 3.38h4.88c.41-1.36 1.33-2.56 2.56-3.38V10c0-2.76-2.24-5-5-5z"/>
    </svg>
  ),
  lightning: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </svg>
  ),
  ball: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <circle cx="12" cy="12" r="10"/>
      <path fill="var(--bg-card)" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v2.02c-2.83.48-5 2.94-5 5.91s2.17 5.43 5 5.91v2.02zm6.9-5.43h-2.02c-.37 1.52-1.36 2.8-2.68 3.52l1.01 1.75c1.84-1.07 3.18-2.9 3.69-5.27zm-3.69-7.77l-1.01 1.75c1.32.72 2.31 2 2.68 3.52h2.02c-.51-2.37-1.85-4.2-3.69-5.27z"/>
    </svg>
  ),
  badge: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M20 7h-4V4c0-1.1-.9-2-2-2h-4c-1.1 0-2 .9-2 2v3H4c-1.1 0-2 .9-2 2v11c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zM10 4h4v3h-4V4zm6 11h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z"/>
    </svg>
  ),
  castle: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M21 9V7l-2 1V4h-2v2h-2V4h-2v2h-2V4H9v2H7V4H5v4L3 7v2l2 1v10h6v-4h2v4h6V10l2-1zM12 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  ),
  gem: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2L2 7l10 15 10-15-10-5zm0 3.5l6 3-6 9-6-9 6-3z"/>
    </svg>
  ),
  crystal: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12 2l-5.5 9L12 22l5.5-11L12 2zm0 4l3 5-3 6-3-6 3-5z"/>
    </svg>
  ),
  infinity: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18.6 6.62c-1.44 0-2.8.56-3.77 1.53L12 10.66 10.48 12h.01L7.8 14.39c-.64.64-1.49.99-2.4.99-1.87 0-3.39-1.51-3.39-3.38S3.53 8.62 5.4 8.62c.91 0 1.76.35 2.44 1.03l1.13 1 1.51-1.34L9.22 8.2C8.2 7.18 6.84 6.62 5.4 6.62 2.42 6.62 0 9.04 0 12s2.42 5.38 5.4 5.38c1.44 0 2.8-.56 3.77-1.53l2.83-2.5.01.01L13.52 12h-.01l2.69-2.39c.64-.64 1.49-.99 2.4-.99 1.87 0 3.39 1.51 3.39 3.38s-1.52 3.38-3.39 3.38c-.9 0-1.76-.35-2.44-1.03l-1.14-1.01-1.51 1.34 1.27 1.12c1.02 1.01 2.37 1.57 3.82 1.57 2.98 0 5.4-2.41 5.4-5.38s-2.42-5.37-5.4-5.37z"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
    </svg>
  ),
  checkDouble: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z"/>
    </svg>
  ),
}

// ============ PLAYER PROFILE MODAL ============

function PlayerProfileModal({ 
  show, 
  playerId, 
  onClose, 
  players, 
  stats, 
  matches,
  ratings,
  predictions = {},
  userLinks = {},
  getPlayerPhoto,
  getPlayerName,
  calculateXP,
  getRank,
}) {
  const isVisible = !!show && !!playerId

  // State for badge tooltip
  const [selectedBadge, setSelectedBadge] = useState(null)

  // State for share card
  const [showShareCard, setShowShareCard] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const shareCardRef = useRef(null)

  useEffect(() => {
    if (!show) return undefined
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [show])

  if (!isVisible) return null

  const player = players?.find(p => p.id === playerId)
  if (!player) {
    return (
      <div className="profile-overlay" onClick={onClose}>
        <div className="profile-card" onClick={e => e.stopPropagation()}>
          <button className="profile-close" onClick={onClose}>×</button>
          <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>Jugador no encontrado</p>
        </div>
      </div>
    )
  }

  const playerStats = stats?.find(s => s.id === playerId) || { played: 0, wins: 0, losses: 0, mvps: 0, winRate: 0 }
  const xp = calculateXP ? calculateXP(playerId) : 0
  const rank = getRank ? getRank(xp) : { name: 'Bronce', color: '#CD7F32', key: 'bronce' }
  const playerRatings = ratings?.[playerId] || []
  const photo = getPlayerPhoto ? getPlayerPhoto(playerId) : null
  const linkedUserId = Object.entries(userLinks || {}).find(([, data]) => data?.playerId === playerId)?.[0]
  const cosmetics = linkedUserId ? userLinks?.[linkedUserId]?.cosmetics : null
  const banner = cosmetics?.banner || null
  const nameStyle = cosmetics?.nameStyle || null
  const bannerTextMap = {
    junior: 'Banner Junior',
    monda: 'Soy la monda',
    hayjuego: 'Hay juegooo',
    amamar: 'A mamar',
    legend: 'Leyenda',
  }
  const bannerText = banner ? bannerTextMap[banner] : null
  
  // Calculate all stats averages for comparison
  const ratingSamples = stats?.filter(p => p.avgRating) || []
  const ratingSampleCount = ratingSamples.length
  const avgStats = {
    winRate: stats?.length > 0 ? stats.reduce((s, p) => s + (p.winRate || 0), 0) / stats.length : 50,
    rating: ratingSampleCount > 0 ? ratingSamples.reduce((s, p) => s + parseFloat(p.avgRating || 5), 0) / ratingSampleCount : 5,
    mvps: stats?.length > 0 ? stats.reduce((s, p) => s + (p.mvps || 0), 0) / stats.length : 0
  }
  
  // Calculate streaks
  const playerMatches = matches?.filter(m => 
    m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
  ).sort((a, b) => new Date(b.date) - new Date(a.date)) || []
  
  let bestWinStreak = 0, worstLossStreak = 0, tempWinStreak = 0, tempLossStreak = 0
  let currentStreak = { type: 'none', count: 0 }
  let firstResult = true
  
  for (const m of playerMatches) {
    const inWhite = m.teamWhite?.includes(playerId)
    const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
    
    if (won) {
      tempWinStreak++
      tempLossStreak = 0
      if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak
      // Track current streak (first matches in the sorted list are most recent)
      if (firstResult) { currentStreak = { type: 'win', count: 1 }; firstResult = false }
      else if (currentStreak.type === 'win') currentStreak.count++
    } else {
      tempLossStreak++
      tempWinStreak = 0
      if (tempLossStreak > worstLossStreak) worstLossStreak = tempLossStreak
      // Track current streak
      if (firstResult) { currentStreak = { type: 'loss', count: 1 }; firstResult = false }
      else if (currentStreak.type === 'loss') currentStreak.count++
    }
  }

  // Rating stats
  const bestRating = playerRatings.length > 0 ? Math.max(...playerRatings.map(r => r.score)) : 0
  const worstRating = playerRatings.length > 0 ? Math.min(...playerRatings.map(r => r.score)) : 0
  const avgRating = playerRatings.length > 0 
    ? (playerRatings.reduce((s, r) => s + r.score, 0) / playerRatings.length)
    : 0
  
  // Achievements/Badges with SVG icons and descriptions
  const badges = []
  
  // MVP badges (progression)
  if (playerStats.mvps >= 1) badges.push({ icon: 'star', name: 'MVP', color: '#fbbf24', desc: 'Ser el jugador más valorado en al menos 1 partido' })
  if (playerStats.mvps >= 3) badges.push({ icon: 'star', name: 'Triple MVP', color: '#f59e0b', desc: 'Acumular 3 títulos de MVP' })
  if (playerStats.mvps >= 5) badges.push({ icon: 'crown', name: 'Rey', color: '#f97316', desc: 'Acumular 5 o más títulos de MVP' })
  if (playerStats.mvps >= 10) badges.push({ icon: 'trophy', name: 'Leyenda', color: '#dc2626', desc: 'Alcanzar 10 MVPs totales - el máximo honor' })
  
  // Rating badges
  if (bestRating === 10) badges.push({ icon: 'check100', name: 'Perfecto', color: '#10b981', desc: 'Recibir una calificación perfecta de 10' })
  if (avgRating >= 8 && playerStats.played >= 3) badges.push({ icon: 'target', name: 'Consistente', color: '#3b82f6', desc: 'Mantener un rating promedio superior a 8.0' })
  if (avgRating >= 9 && playerStats.played >= 5) badges.push({ icon: 'diamond', name: 'Élite', color: '#06b6d4', desc: 'Rating promedio de 9+ con 5 partidos jugados' })
  if (worstRating >= 7 && playerStats.played >= 3) badges.push({ icon: 'shield', name: 'Blindado', color: '#64748b', desc: 'Nunca recibir una calificación menor a 7' })
  
  // Win rate badges
  if (playerStats.winRate >= 50 && playerStats.played >= 3) badges.push({ icon: 'thumbsup', name: 'Ganador', color: '#22c55e', desc: 'Win rate del 50% o superior' })
  if (playerStats.winRate >= 70 && playerStats.played >= 3) badges.push({ icon: 'muscle', name: 'Dominante', color: '#ef4444', desc: 'Mantener un win rate superior al 70%' })
  if (playerStats.winRate >= 80 && playerStats.played >= 5) badges.push({ icon: 'fire', name: 'Intratable', color: '#f97316', desc: 'Win rate del 80%+ con 5 partidos' })
  if (playerStats.winRate === 100 && playerStats.played >= 3) badges.push({ icon: 'rocket', name: 'Invicto', color: '#a855f7', desc: '¡100% win rate sin derrotas!' })
  
  // Streak badges
  if (bestWinStreak >= 3) badges.push({ icon: 'flame', name: 'En Racha', color: '#f59e0b', desc: 'Racha de 3+ victorias consecutivas' })
  if (bestWinStreak >= 5) badges.push({ icon: 'bolt', name: 'Imparable', color: '#eab308', desc: 'Racha de 5+ victorias consecutivas' })
  if (bestWinStreak >= 7) badges.push({ icon: 'lightning', name: 'Demoledor', color: '#fbbf24', desc: 'Racha épica de 7+ victorias' })
  
  // Participation badges
  if (playerStats.played >= 1) badges.push({ icon: 'ball', name: 'Debutante', color: '#6b7280', desc: 'Jugar tu primer partido' })
  if (playerStats.played >= 5) badges.push({ icon: 'controller', name: 'Regular', color: '#8b5cf6', desc: 'Jugar 5 o más partidos' })
  if (playerStats.played >= 10) badges.push({ icon: 'medal', name: 'Veterano', color: '#7c3aed', desc: 'Jugar 10 o más partidos' })
  if (playerStats.played >= 20) badges.push({ icon: 'badge', name: 'Capitán', color: '#4f46e5', desc: 'Jugar 20 o más partidos' })
  if (playerStats.played >= 50) badges.push({ icon: 'castle', name: 'Pilar', color: '#2563eb', desc: 'Jugar 50+ partidos - pilar del equipo' })
  
  // XP badges
  if (xp >= 500) badges.push({ icon: 'gem', name: 'Ascendido', color: '#0ea5e9', desc: 'Alcanzar 500 puntos de XP' })
  if (xp >= 1000) badges.push({ icon: 'crystal', name: 'Maestro', color: '#06b6d4', desc: 'Alcanzar 1000 puntos de XP' })
  if (xp >= 2000) badges.push({ icon: 'infinity', name: 'Inmortal', color: '#14b8a6', desc: 'Alcanzar 2000 puntos de XP' })
  
  // Special badges
  if (playerStats.wins >= 10) badges.push({ icon: 'check', name: '10 Victorias', color: '#22c55e', desc: 'Acumular 10 victorias totales' })
  if (playerStats.wins >= 25) badges.push({ icon: 'checkDouble', name: '25 Victorias', color: '#16a34a', desc: 'Acumular 25 victorias - ¡Impresionante!' })
  
  // XP Progress calculation
  const RANK_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2600]
  const currentRankIndex = RANK_THRESHOLDS.findIndex((t, i) => xp < (RANK_THRESHOLDS[i + 1] || Infinity))
  const currentThreshold = RANK_THRESHOLDS[currentRankIndex] || 0
  const nextThreshold = RANK_THRESHOLDS[currentRankIndex + 1] || RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]
  const xpInCurrentRank = xp - currentThreshold
  const xpNeededForNext = nextThreshold - currentThreshold
  const xpProgress = Math.min(100, (xpInCurrentRank / xpNeededForNext) * 100)

  // Share function - now shows a shareable card
  const shareProfile = () => {
    setShowShareCard(true)
  }

  // Generate and share image
  const generateShareImage = async () => {
    if (!shareCardRef.current) return
    setIsGeneratingImage(true)
    
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true
      })
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false)
          return
        }
        
        const file = new File([blob], `${player.name}-lukto-stats.png`, { type: 'image/png' })
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            // Only share the image file, no text to avoid duplicate preview
            await navigator.share({
              files: [file]
            })
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadImage(canvas)
            }
          }
        } else {
          downloadImage(canvas)
        }
        setIsGeneratingImage(false)
        setShowShareCard(false)
      }, 'image/png')
    } catch (error) {
      console.error('Error generating image:', error)
      setIsGeneratingImage(false)
    }
  }

  const downloadImage = (canvas) => {
    const link = document.createElement('a')
    link.download = `${player.name}-lukto-stats.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-card profile-card-v2" onClick={e => e.stopPropagation()}>
        <div className="profile-actions">
          <button className="profile-share" onClick={shareProfile} title="Compartir">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
          </button>
          <button className="profile-close" onClick={onClose}>×</button>
        </div>
        
        {/* Clean Hero Header */}
        <div className={`profile-hero-v2 ${banner ? `banner-${banner}` : ''}`}>
          {bannerText && <div className="profile-banner-text">{bannerText}</div>}
          <div className={`ph-avatar ${cosmetics?.avatarGlow ? 'glow' : ''}`}>
            <AvatarImage src={photo} name={player.name} />
          </div>
          <h2
            className={`ph-name ${cosmetics?.goldName ? 'gold' : ''} ${nameStyle ? `name-${nameStyle}` : ''}`}
            data-text={player.name}
          >
            {player.name}
          </h2>
          
          {/* Rank & XP Progress */}
          <div className="ph-rank-section">
            <div className="ph-rank" style={{ '--rank-color': rank.color }}>
              <span className="ph-rank-name">{rank.name}</span>
              <span className="ph-xp">{xp} XP</span>
            </div>
            <div className="ph-progress-bar">
              <div className="ph-progress-fill" style={{ width: `${xpProgress}%`, background: rank.color }}></div>
            </div>
            <div className="ph-progress-labels">
              <span>{currentThreshold} XP</span>
              <span>{nextThreshold} XP</span>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="profile-stats-row">
          <div className="psr-item"><span className="psr-value">{playerStats.played}</span><span className="psr-label">Partidos</span></div>
          <div className="psr-item win"><span className="psr-value">{playerStats.wins}</span><span className="psr-label">Victorias</span></div>
          <div className="psr-item loss"><span className="psr-value">{playerStats.losses}</span><span className="psr-label">Derrotas</span></div>
          <div className="psr-item"><span className="psr-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : 0}%</span><span className="psr-label">Win Rate</span></div>
        </div>


        {/* Badges */}
        {badges.length > 0 && (
          <div className="profile-section-v2">
            <h4 className="ps-title">Logros</h4>
            <div className="badges-row">
              {badges.map((badge, i) => (
                <div 
                  key={i} 
                  className={`badge-v2 ${selectedBadge === i ? 'selected' : ''}`} 
                  style={{ '--badge-color': badge.color }}
                  onClick={() => setSelectedBadge(selectedBadge === i ? null : i)}
                >
                  <span className="badge-v2-icon">{ProfileIcons[badge.icon]}</span>
                  <span className="badge-v2-name">{badge.name}</span>
                </div>
              ))}
            </div>
            {/* Badge Tooltip */}
            {selectedBadge !== null && badges[selectedBadge] && (
              <div className="badge-tooltip" onClick={() => setSelectedBadge(null)}>
                <div className="bt-icon" style={{ color: badges[selectedBadge].color }}>
                  {ProfileIcons[badges[selectedBadge].icon]}
                </div>
                <div className="bt-content">
                  <span className="bt-name">{badges[selectedBadge].name}</span>
                  <span className="bt-desc">{badges[selectedBadge].desc}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison */}
        <div className="profile-section-v2">
          <h4 className="ps-title">vs Promedio</h4>
          <div className="comparison-row-v2">
            <div className="comp-v2">
              <span className="comp-v2-label">Win Rate</span>
              <span className="comp-v2-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : 0}%</span>
              <span className={`comp-v2-diff ${(playerStats.winRate || 0) >= avgStats.winRate ? 'pos' : 'neg'}`}>
                {(playerStats.winRate || 0) >= avgStats.winRate ? '+' : ''}{((playerStats.winRate || 0) - avgStats.winRate).toFixed(0)}%
              </span>
            </div>
            <div className="comp-v2">
              <span className="comp-v2-label">Rating</span>
              <span className="comp-v2-value">{avgRating ? avgRating.toFixed(1) : '-'}</span>
              <span className={`comp-v2-diff ${avgRating >= avgStats.rating ? 'pos' : 'neg'}`}>
                {avgRating >= avgStats.rating ? '+' : ''}{(avgRating - avgStats.rating).toFixed(1)}
              </span>
            </div>
            <div className="comp-v2">
              <span className="comp-v2-label">MVPs</span>
              <span className="comp-v2-value">{playerStats.mvps || 0}</span>
              <span className={`comp-v2-diff ${(playerStats.mvps || 0) >= avgStats.mvps ? 'pos' : 'neg'}`}>
                {(playerStats.mvps || 0) >= avgStats.mvps ? '+' : ''}{((playerStats.mvps || 0) - avgStats.mvps).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Current Streak & Records */}
        <div className="profile-section-v2">
          <h4 className="ps-title">Rachas y Récords</h4>
          
          {/* Current Streak Banner */}
          {currentStreak.count > 0 && (
            <div className={`current-streak-banner ${currentStreak.type}`}>
              <span className="csb-icon">
                {currentStreak.type === 'win' 
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#22c55e"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/><path d="M8 8l8 8M16 8l-8 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>
                }
              </span>
              <div className="csb-content">
                <span className="csb-count">{currentStreak.count} {currentStreak.type === 'win' ? 'victorias' : 'derrotas'}</span>
                <span className="csb-label">Racha actual</span>
              </div>
              {currentStreak.count >= 3 && currentStreak.type === 'win' && (
                <span className="csb-badge">🔥</span>
              )}
            </div>
          )}
          
          <div className="records-row-v2">
            <div className="record-v2">
              <span className="record-v2-icon win">{ProfileIcons.medal}</span>
              <span className="record-v2-value">{bestWinStreak}</span>
              <span className="record-v2-label">Mejor racha</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon loss">{ProfileIcons.heartBroken}</span>
              <span className="record-v2-value">{worstLossStreak}</span>
              <span className="record-v2-label">Peor racha</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon win">{ProfileIcons.arrowUp}</span>
              <span className="record-v2-value">{bestRating || '-'}</span>
              <span className="record-v2-label">Rating max</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon loss">{ProfileIcons.arrowDown}</span>
              <span className="record-v2-value">{worstRating || '-'}</span>
              <span className="record-v2-label">Rating min</span>
            </div>
          </div>
        </div>

        {/* Performance Graph */}
        {(() => {
          const playerMatches = matches
            .filter(m => m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
          
          const graphData = playerMatches.map(m => {
            const matchRatings = (ratings[playerId] || []).filter(r => r.matchId === m.id)
            const avgScore = matchRatings.length > 0 
              ? matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length 
              : null
            const inWhite = m.teamWhite?.includes(playerId)
            const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
            return { date: m.date, rating: avgScore, won }
          }).filter(d => d.rating !== null)

          if (graphData.length < 2) return null

          const maxRating = 10
          const minRating = 1
          const height = 120
          const width = 280
          const padding = 20

          const points = graphData.map((d, i) => {
            const x = padding + (i / (graphData.length - 1)) * (width - padding * 2)
            const y = height - padding - ((d.rating - minRating) / (maxRating - minRating)) * (height - padding * 2)
            return { x, y, ...d }
          })

          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Rendimiento</h4>
              <div className="performance-graph">
                <svg viewBox={`0 0 ${width} ${height}`} className="pg-svg">
                  {/* Grid lines */}
                  {[1, 5, 10].map(val => {
                    const y = height - padding - ((val - minRating) / (maxRating - minRating)) * (height - padding * 2)
                    return (
                      <g key={val}>
                        <line x1={padding} y1={y} x2={width - padding} y2={y} className="pg-grid" />
                        <text x={padding - 5} y={y + 4} className="pg-label">{val}</text>
                      </g>
                    )
                  })}
                  {/* Area fill */}
                  <path d={areaD} className="pg-area" />
                  {/* Line */}
                  <path d={pathD} className="pg-line" />
                  {/* Points */}
                  {points.map((p, i) => (
                    <circle 
                      key={i} 
                      cx={p.x} 
                      cy={p.y} 
                      r="4" 
                      className={`pg-point ${p.won ? 'win' : 'loss'}`}
                    />
                  ))}
                </svg>
                <div className="pg-legend">
                  <span className="pg-legend-item"><span className="dot win"></span> Victoria</span>
                  <span className="pg-legend-item"><span className="dot loss"></span> Derrota</span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Rivals & Allies */}
        {(() => {
          const rivalStats = {}
          matches.forEach(m => {
            const inWhite = m.teamWhite?.includes(playerId)
            const inBlack = m.teamBlack?.includes(playerId)
            if (!inWhite && !inBlack) return
            
            const myTeam = inWhite ? m.teamWhite : m.teamBlack
            const enemyTeam = inWhite ? m.teamBlack : m.teamWhite
            const won = (inWhite && m.winner === 'white') || (inBlack && m.winner === 'black')
            
            // Track teammates
            myTeam?.forEach(tid => {
              if (tid === playerId) return
              if (!rivalStats[tid]) rivalStats[tid] = { together: 0, togetherWins: 0, against: 0, againstWins: 0 }
              rivalStats[tid].together++
              if (won) rivalStats[tid].togetherWins++
            })
            
            // Track enemies
            enemyTeam?.forEach(eid => {
              if (!rivalStats[eid]) rivalStats[eid] = { together: 0, togetherWins: 0, against: 0, againstWins: 0 }
              rivalStats[eid].against++
              if (won) rivalStats[eid].againstWins++
            })
          })

          const rankings = Object.entries(rivalStats)
            .filter(([_, s]) => s.together + s.against >= 2)
            .map(([id, s]) => ({
              id,
              name: getPlayerName(id),
              photo: getPlayerPhoto(id),
              togetherWR: s.together > 0 ? Math.round((s.togetherWins / s.together) * 100) : null,
              togetherGames: s.together,
              againstWR: s.against > 0 ? Math.round((s.againstWins / s.against) * 100) : null,
              againstGames: s.against
            }))

          const bestAlly = rankings.filter(r => r.togetherGames >= 2).sort((a, b) => (b.togetherWR || 0) - (a.togetherWR || 0))[0]
          const worstAlly = rankings.filter(r => r.togetherGames >= 2).sort((a, b) => (a.togetherWR || 0) - (b.togetherWR || 0))[0]
          const bestRival = rankings.filter(r => r.againstGames >= 2).sort((a, b) => (b.againstWR || 0) - (a.againstWR || 0))[0]
          const worstRival = rankings.filter(r => r.againstGames >= 2).sort((a, b) => (a.againstWR || 0) - (b.againstWR || 0))[0]

          if (!bestAlly && !worstRival) return null

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Rivales y Aliados</h4>
              <div className="rivals-grid">
                {bestAlly && (
                  <div className="rival-card ally">
                    <span className="rc-label">Mejor Aliado</span>
                    <div className="rc-player">
                      <AvatarImage src={bestAlly.photo} name={bestAlly.name} />
                    </div>
                    <span className="rc-name">{bestAlly.name}</span>
                    <span className="rc-stat good">{bestAlly.togetherWR}% WR juntos</span>
                    <span className="rc-games">{bestAlly.togetherGames} partidos</span>
                  </div>
                )}
                {worstAlly && worstAlly.id !== bestAlly?.id && (
                  <div className="rival-card ally-bad">
                    <span className="rc-label">Peor Aliado</span>
                    <div className="rc-player">
                      <AvatarImage src={worstAlly.photo} name={worstAlly.name} />
                    </div>
                    <span className="rc-name">{worstAlly.name}</span>
                    <span className="rc-stat bad">{worstAlly.togetherWR}% WR juntos</span>
                    <span className="rc-games">{worstAlly.togetherGames} partidos</span>
                  </div>
                )}
                {bestRival && (
                  <div className="rival-card rival">
                    <span className="rc-label">Víctima Favorita</span>
                    <div className="rc-player">
                      <AvatarImage src={bestRival.photo} name={bestRival.name} />
                    </div>
                    <span className="rc-name">{bestRival.name}</span>
                    <span className="rc-stat good">{bestRival.againstWR}% WR vs</span>
                    <span className="rc-games">{bestRival.againstGames} enfrentamientos</span>
                  </div>
                )}
                {worstRival && worstRival.id !== bestRival?.id && (
                  <div className="rival-card nemesis">
                    <span className="rc-label">Tu Némesis</span>
                    <div className="rc-player">
                      <AvatarImage src={worstRival.photo} name={worstRival.name} />
                    </div>
                    <span className="rc-name">{worstRival.name}</span>
                    <span className="rc-stat bad">{worstRival.againstWR}% WR vs</span>
                    <span className="rc-games">{worstRival.againstGames} enfrentamientos</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Predictions History */}
        {(() => {
          // Find user ID for this player
          const userId = userLinks 
            ? Object.entries(userLinks).find(([uid, linkData]) => linkData?.playerId === playerId)?.[0]
            : null
          
          if (!userId) return null
          
          // Get all predictions for this user
          const userPredictions = Object.entries(predictions)
            .map(([matchId, matchPreds]) => {
              const pred = matchPreds?.[userId]
              if (!pred) return null
              const match = matches.find(m => m.id === (pred.matchId || matchId))
              return { ...pred, matchId: pred.matchId || matchId, match }
            })
            .filter(Boolean)
            .filter(p => p.match)
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
          
          if (userPredictions.length === 0) return null
          
          // Calculate stats
          const resolved = userPredictions.filter(p => p.match?.winner)
          const correct = resolved.filter(p => p.prediction === p.match.winner)
          const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0
          const totalCoinsWon = correct.reduce((sum, p) => sum + getPredictionWin(p), 0)
          const totalCoinsLost = resolved.filter(p => p.prediction !== p.match.winner)
            .reduce((sum, p) => sum + getPredictionBet(p), 0)
          
          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Historial de Predicciones</h4>
              
              {/* Summary Stats */}
              <div className="predictions-summary">
                <div className="pred-stat">
                  <span className="pred-stat-value">{resolved.length}</span>
                  <span className="pred-stat-label">Predicciones</span>
                </div>
                <div className="pred-stat">
                  <span className="pred-stat-value good">{correct.length}</span>
                  <span className="pred-stat-label">Acertadas</span>
                </div>
                <div className="pred-stat">
                  <span className={`pred-stat-value ${accuracy >= 50 ? 'good' : 'bad'}`}>{accuracy}%</span>
                  <span className="pred-stat-label">Precisión</span>
                </div>
                <div className="pred-stat">
                  <span className={`pred-stat-value ${totalCoinsWon - totalCoinsLost >= 0 ? 'good' : 'bad'}`}>
                    {totalCoinsWon - totalCoinsLost >= 0 ? '+' : ''}{totalCoinsWon - totalCoinsLost}
                  </span>
                  <span className="pred-stat-label">LukCoins Netos</span>
                </div>
              </div>
              
              {/* Predictions List */}
              <div className="predictions-list">
                {userPredictions.slice(0, 5).map((pred, idx) => {
                  const isCorrect = pred.match?.winner && pred.prediction === pred.match.winner
                  const isResolved = !!pred.match?.winner
                  const predictedTeam = pred.prediction === 'white' ? 'Blanco' : 'Negro'
                  const bet = getPredictionBet(pred)
                  const win = getPredictionWin(pred)
                  
                  return (
                    <div key={idx} className={`prediction-item ${isResolved ? (isCorrect ? 'correct' : 'wrong') : 'pending'}`}>
                      <div className="pred-match-info">
                        <span className="pred-date">
                          {new Date(pred.match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="pred-teams">
                          {pred.match.teamWhite?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')} vs {pred.match.teamBlack?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                        </span>
                      </div>
                      <div className="pred-result">
                        <span className="pred-choice">Eq. {predictedTeam}</span>
                        <span className="pred-xp">
                          {isResolved 
                            ? (isCorrect ? `+${win}` : `-${bet}`)
                            : `${bet}`
                          } LC
                        </span>
                        <span className="pred-status">
                          {isResolved 
                            ? (isCorrect 
                              ? <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#22c55e"/><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              : <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#ef4444"/><path d="M5.5 5.5l5 5m0-5l-5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                            )
                            : <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#f59e0b"/><circle cx="8" cy="8" r="2" fill="white"/></svg>
                          }
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {userPredictions.length > 5 && (
                <div className="predictions-more">
                  +{userPredictions.length - 5} predicciones más
                </div>
              )}
            </div>
          )
        })()}

        {/* Period Summary (Week/Month) */}
        {(() => {
          const now = new Date()
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          
          // Weekly stats
          const weekMatches = matches.filter(m => {
            const played = m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
            return played && new Date(m.date) >= weekAgo
          })
          
          // Monthly stats
          const monthMatches = matches.filter(m => {
            const played = m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
            const mDate = new Date(m.date)
            return played && mDate >= monthStart
          })
          
          const calcPeriodStats = (periodMatches) => {
            let wins = 0, losses = 0, mvps = 0, totalRating = 0, ratingCount = 0
            
            periodMatches.forEach(m => {
              const inWhite = m.teamWhite?.includes(playerId)
              if (m.winner) {
                if ((inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')) wins++
                else losses++
              }
              
              // Check MVP
              const allPlayers = [...(m.teamWhite || []), ...(m.teamBlack || [])]
              let mvpId = null, mvpRating = -1
              allPlayers.forEach(pid => {
                const pRatings = (ratings[pid] || []).filter(r => r.matchId === m.id)
                if (pRatings.length > 0) {
                  const avg = pRatings.reduce((s, r) => s + r.score, 0) / pRatings.length
                  if (avg > mvpRating) { mvpRating = avg; mvpId = pid }
                }
              })
              if (mvpId === playerId) mvps++
              
              // Rating
              const myRatings = (ratings[playerId] || []).filter(r => r.matchId === m.id)
              if (myRatings.length > 0) {
                totalRating += myRatings.reduce((s, r) => s + r.score, 0) / myRatings.length
                ratingCount++
              }
            })
            
            const played = periodMatches.length
            const winRate = played > 0 ? Math.round((wins / played) * 100) : 0
            const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null
            
            return { played, wins, losses, mvps, winRate, avgRating }
          }
          
          const weekStats = calcPeriodStats(weekMatches)
          const monthStats = calcPeriodStats(monthMatches)
          
          if (weekStats.played === 0 && monthStats.played === 0) return null
          
          const periodNames = {
            week: 'Esta Semana',
            month: new Date().toLocaleDateString('es-ES', { month: 'long' })
          }
          
          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Resumen del Período</h4>
              <div className="period-summary-tabs">
                {weekStats.played > 0 && (
                  <div className="period-card">
                    <span className="period-label">{periodNames.week}</span>
                    <div className="period-stats">
                      <span className="period-main">{weekStats.wins}V - {weekStats.losses}D</span>
                      <span className={`period-wr ${weekStats.winRate >= 50 ? 'good' : 'bad'}`}>{weekStats.winRate}%</span>
                    </div>
                    <div className="period-details">
                      {weekStats.avgRating && <span>⭐ {weekStats.avgRating}</span>}
                      {weekStats.mvps > 0 && <span>🏆 {weekStats.mvps} MVP</span>}
                      <span>📊 {weekStats.played} partidos</span>
                    </div>
                  </div>
                )}
                {monthStats.played > 0 && (
                  <div className="period-card">
                    <span className="period-label">{periodNames.month}</span>
                    <div className="period-stats">
                      <span className="period-main">{monthStats.wins}V - {monthStats.losses}D</span>
                      <span className={`period-wr ${monthStats.winRate >= 50 ? 'good' : 'bad'}`}>{monthStats.winRate}%</span>
                    </div>
                    <div className="period-details">
                      {monthStats.avgRating && <span>⭐ {monthStats.avgRating}</span>}
                      {monthStats.mvps > 0 && <span>🏆 {monthStats.mvps} MVP</span>}
                      <span>📊 {monthStats.played} partidos</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Share Card Modal */}
        {showShareCard && (
          <div className="share-card-overlay" onClick={() => setShowShareCard(false)}>
            <div className="share-card-container" onClick={e => e.stopPropagation()}>
              {/* The actual shareable card */}
              <div ref={shareCardRef} className="share-card">
                <div className="sc-header">
                  <img src="/lukto-logo.png" alt="LUKTO" className="sc-logo" />
                  <span className="sc-brand">LUKTO</span>
                </div>
                
                <div className="sc-player">
                  <div className="sc-avatar" style={{ borderColor: rank.color }}>
                    <AvatarImage src={photo} name={player.name} />
                  </div>
                  <h2 className="sc-name">{player.name}</h2>
                  <div className="sc-rank" style={{ color: rank.color }}>
                    {rank.name} · {xp} XP
                  </div>
                </div>

                <div className="sc-stats">
                  <div className="sc-stat">
                    <span className="sc-stat-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : 0}%</span>
                    <span className="sc-stat-label">Win Rate</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{avgRating ? avgRating.toFixed(1) : '-'}</span>
                    <span className="sc-stat-label">Rating</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{playerStats.mvps || 0}</span>
                    <span className="sc-stat-label">MVPs</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{playerStats.played || 0}</span>
                    <span className="sc-stat-label">Partidos</span>
                  </div>
                </div>

                <div className="sc-record">
                  <span className="sc-wins">{playerStats.wins || 0}V</span>
                  <span className="sc-sep">-</span>
                  <span className="sc-losses">{playerStats.losses || 0}D</span>
                </div>

                {badges.length > 0 && (
                  <div className="sc-badges">
                    {badges.slice(0, 4).map((badge, i) => (
                      <span key={i} className="sc-badge" style={{ color: badge.color }}>
                        {ProfileIcons[badge.icon]}
                      </span>
                    ))}
                  </div>
                )}

                <div className="sc-footer">
                  <span>LUKTO STATS</span>
                </div>
              </div>

              {/* Actions */}
              <div className="share-card-actions">
                <button 
                  className="sc-btn primary" 
                  onClick={generateShareImage}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? 'Generando...' : 'Compartir Imagen'}
                </button>
                <button className="sc-btn secondary" onClick={() => setShowShareCard(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ PENDING USER CARD ============

function PendingUserCard({ pending, players, linkingUser, onLink, onDelete }) {
  const [selectedPlayer, setSelectedPlayer] = useState('')

  const handleLink = () => {
    if (selectedPlayer && selectedPlayer !== '') {
      onLink(pending.odedBy, selectedPlayer)
    }
  }

  return (
    <div className={`user-link-card pending ${linkingUser === pending.odedBy ? 'linking' : ''}`}>
      <div className="user-link-info">
        <img
          src={pending.userPhoto || pending.odedByPhoto}
          alt=""
          className="user-link-avatar"
        />
        <div>
          <div className="user-link-name">{pending.userName || pending.odedByName}</div>
          <div className="user-link-email">{pending.userEmail || pending.odedByEmail}</div>
        </div>
      </div>
      <div className="user-link-action">
        {linkingUser === pending.odedBy ? (
          <span className="linking-text">Vinculando...</span>
        ) : (
          <>
            <select
              className="player-select-dropdown"
              value={selectedPlayer}
              onChange={e => setSelectedPlayer(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <button className="link-btn" onClick={handleLink}>
              ✓
            </button>
            <button 
              className="delete-user-btn" 
              onClick={() => onDelete(pending.odedBy, pending.userName || pending.userEmail)}
              title="Eliminar cuenta"
            >
              🗑️
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ============ MAIN APP COMPONENT ============

function App() {
  const {
    // Data
    players,
    matches,
    ratings,
    predictions,
    dataLoaded,
    // Auth
    user,
    userPlayer,
    userLinks,
    pendingUsers,
    userLinksLoaded,
    // Admin
    isAdmin,
    setIsAdmin,
    adminEmails,
    setAdminEmails,
    blockedUsers,
    setBlockedUsers,
    // Settings
    darkMode,
    leagueSettings,
    setLeagueSettings,
    announcements,
    activityLogs,
    // UI
    activeTab,
    setActiveTab,
    toast,
    showToast,
    timeFilter,
    setTimeFilter,
    // Utils
    getPlayerName,
    getPlayerPhoto,
    logActivity,
    confettiTriggered,
    handleLogout,
  } = useApp()

  // Stats hook
  const { stats, filteredStats, getPlayerOfMonth, getPlayerOfWeek } = useStats()

  // Onboarding hook
  const { showOnboarding, completeOnboarding } = useOnboarding()

  // Local state
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [currentRatings, setCurrentRatings] = useState({})
  const [ratingSuccess, setRatingSuccess] = useState(false)
  const [showPlayerProfile, setShowPlayerProfile] = useState(false)
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState(null)
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerAliases, setNewPlayerAliases] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [linkingUser, setLinkingUser] = useState(null)
  const [newAdminEmail, setNewAdminEmail] = useState('')

  // Match form state
  const [matchDate, setMatchDate] = useState('')
  const [matchVenue, setMatchVenue] = useState('LUKTO')
  const [teamWhite, setTeamWhite] = useState([])
  const [teamBlack, setTeamBlack] = useState([])
  const [winner, setWinner] = useState('')
  const [editingMatchId, setEditingMatchId] = useState(null)

  // Analytics state
  const [h2hPlayer1, setH2hPlayer1] = useState(null)
  const [h2hPlayer2, setH2hPlayer2] = useState(null)

  // Prediction state
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [predictionMatch, setPredictionMatch] = useState(null)
  const [selectedPrediction, setSelectedPrediction] = useState(null)
  const [coinBet, setCoinBet] = useState(10) // LukCoins to bet on prediction

  // Notifications
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'denied'
  })

  // Global haptic feedback for all buttons
  useEffect(() => {
    const handleClick = (e) => {
      const target = e.target.closest('button, .btn, .pill, .nav-item, .admin-tab, .clickable-row, .badge-v2, .prediction-team, .xp-bet-btn, .winner-btn, .match-card, [role="button"]')
      if (target && navigator.vibrate) {
        navigator.vibrate(3) // Short vibration
      }
    }
    
    document.addEventListener('click', handleClick, { passive: true })
    return () => document.removeEventListener('click', handleClick)
  }, [])

  // ============ CALCULATED VALUES ============

  const displayStats = timeFilter === 'all' ? stats : filteredStats

  const calculateXP = playerId => {
    const playerStats = stats.find(s => s.id === playerId)
    if (!playerStats) return 0
    let xp = 0
    xp += playerStats.played * 10
    xp += playerStats.wins * 25
    xp += playerStats.mvps * 50
    if (playerStats.avgRating) {
      xp += Math.round(parseFloat(playerStats.avgRating) * 5)
    }
    const linkedUserId = Object.entries(userLinks || {}).find(
      ([, linkData]) => linkData?.playerId === playerId
    )?.[0]
    const xpMultiplier = linkedUserId
      ? Math.max(1, userLinks?.[linkedUserId]?.xpMultiplier || userLinks?.[linkedUserId]?.cosmetics?.xpMultiplier || 1)
      : 1
    xp = xp * xpMultiplier
    return xp
  }

  const calculateLukCoins = playerId => {
    const playerStats = stats.find(s => s.id === playerId)
    if (!playerStats) return 0

    const COIN_REWARDS = {
      played: 5,
      win: 8,
      mvp: 12,
      ratedMatch: 4,
    }

    let coins = 0
    coins += playerStats.played * COIN_REWARDS.played
    coins += playerStats.wins * COIN_REWARDS.win
    coins += playerStats.mvps * COIN_REWARDS.mvp

    const ratedMatches = new Set()
    Object.values(ratings || {}).forEach(playerRatings => {
      playerRatings.forEach(r => {
        if (r.ratedBy === playerId && r.matchId) {
          ratedMatches.add(r.matchId)
        }
      })
    })
    coins += ratedMatches.size * COIN_REWARDS.ratedMatch

    const userId = Object.entries(userLinks || {}).find(
      ([, linkData]) => linkData?.playerId === playerId
    )?.[0]
    if (userId) {
      Object.entries(predictions || {}).forEach(([matchId, matchPreds]) => {
        const pred = matchPreds?.[userId]
        if (!pred) return
        const match = matches.find(m => m.id === (pred.matchId || matchId))
        const bet = getPredictionBet(pred)
        const win = getPredictionWin(pred)

        if (!match?.winner) {
          coins -= bet
          return
        }

        if (pred.prediction === match.winner) {
          coins += bet + win
        }
      })
      const spent = userLinks?.[userId]?.lukcoinsSpent || 0
      coins -= spent
    }

    return Math.max(0, Math.round(coins))
  }

  // ============ HANDLERS ============

  const handleAdminLogout = () => {
    setIsAdmin(false)
    try {
      localStorage.removeItem('lukto_admin')
    } catch {
      /* Ignore */
    }
    setActiveTab('stats')
  }

  // Add admin email
  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminEmail.includes('@')) {
      showToast('error', 'Ingresa un email válido')
      return
    }
    try {
      const newList = [...adminEmails, newAdminEmail.trim().toLowerCase()]
      await setDoc(doc(db, 'settings', 'admins'), { emails: newList })
      setNewAdminEmail('')
      showToast('success', 'Admin agregado')
    } catch (error) {
      console.error('Error adding admin:', error)
      showToast('error', 'Error al agregar admin')
    }
  }

  // Remove admin email
  const handleRemoveAdmin = async email => {
    if (!confirm(`¿Quitar permisos de admin a ${email}?`)) return
    try {
      const newList = adminEmails.filter(e => e !== email)
      await setDoc(doc(db, 'settings', 'admins'), { emails: newList })
      showToast('success', 'Admin removido')
    } catch (error) {
      console.error('Error removing admin:', error)
      showToast('error', 'Error al quitar admin')
    }
  }

  // Player management
  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) {
      showToast('error', 'Ingresa un nombre')
      return
    }
    const playerData = {
      name: newPlayerName.trim(),
      aliases: newPlayerAliases.split(',').map(a => a.trim()).filter(a => a),
    }
    try {
      if (editingPlayerId) {
        await updateDoc(doc(db, 'players', editingPlayerId), playerData)
        showToast('success', 'Jugador actualizado')
      } else {
        const newPlayerId = Date.now().toString()
        await setDoc(doc(db, 'players', newPlayerId), playerData)
        showToast('success', 'Jugador creado')
      }
      closePlayerModal()
    } catch (error) {
      console.error('Error:', error)
      showToast('error', 'Error al guardar')
    }
  }

  const handleDeletePlayer = async (playerId, playerName) => {
    if (!confirm(`¿Eliminar a "${playerName}"? Esta acción no se puede deshacer.`)) return
    try {
      await setDoc(doc(db, 'players', playerId), { deleted: true }, { merge: true })
      // Actually delete
      const batch = writeBatch(db)
      batch.delete(doc(db, 'players', playerId))
      await batch.commit()
      showToast('success', 'Jugador eliminado')
    } catch (error) {
      console.error('Error:', error)
      showToast('error', 'Error al eliminar')
    }
  }

  const openEditPlayer = player => {
    setEditingPlayerId(player.id)
    setNewPlayerName(player.name)
    setNewPlayerAliases(player.aliases?.join(', ') || '')
    setShowPlayerModal(true)
  }

  const closePlayerModal = () => {
    setShowPlayerModal(false)
    setEditingPlayerId(null)
    setNewPlayerName('')
    setNewPlayerAliases('')
  }

  // ============ PREDICTION HANDLERS ============
  
  // Calculate team win probability based on stats
  const calculateTeamProbability = (match) => {
    if (!match || !stats.length) return { white: 50, black: 50 }
    
    const getTeamStats = (teamIds) => {
      const teamStats = teamIds?.map(pid => stats.find(s => s.id === pid)).filter(Boolean) || []
      if (teamStats.length === 0) return { avgWinRate: 50, avgRating: 5, avgMvps: 0, recentForm: 50 }
      
      const avgWinRate = teamStats.reduce((s, p) => s + (p.winRate || 50), 0) / teamStats.length
      const avgRating = teamStats.reduce((s, p) => s + (parseFloat(p.avgRating) || 5), 0) / teamStats.length
      const avgMvps = teamStats.reduce((s, p) => s + (p.mvps || 0), 0) / teamStats.length
      
      // Calculate recent form (last 5 games win rate)
      const recentWins = teamStats.reduce((total, player) => {
        const playerMatches = matches.filter(m => 
          m.winner && (m.teamWhite?.includes(player.id) || m.teamBlack?.includes(player.id))
        ).slice(-5)
        const wins = playerMatches.filter(m => {
          const inWhite = m.teamWhite?.includes(player.id)
          return (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
        }).length
        return total + (playerMatches.length > 0 ? (wins / playerMatches.length) * 100 : 50)
      }, 0) / teamStats.length
      
      return { avgWinRate, avgRating, avgMvps, recentForm: recentWins }
    }
    
    const whiteStats = getTeamStats(match.teamWhite)
    const blackStats = getTeamStats(match.teamBlack)
    
    // Weighted score calculation
    // Win Rate: 35%, Rating: 30%, MVPs: 15%, Recent Form: 20%
    const calculateScore = (s) => {
      return (s.avgWinRate * 0.35) + 
             (s.avgRating * 3 * 0.30) + // Rating 1-10 scaled to ~30
             (Math.min(s.avgMvps, 5) * 6 * 0.15) + // MVPs capped at 5, scaled
             (s.recentForm * 0.20)
    }
    
    const whiteScore = calculateScore(whiteStats)
    const blackScore = calculateScore(blackStats)
    const totalScore = whiteScore + blackScore
    
    // Convert to percentages
    let whitePct = totalScore > 0 ? Math.round((whiteScore / totalScore) * 100) : 50
    let blackPct = 100 - whitePct
    
    // Ensure minimum 15% and maximum 85% (never 100% sure)
    whitePct = Math.max(15, Math.min(85, whitePct))
    blackPct = 100 - whitePct
    
    return { 
      white: whitePct, 
      black: blackPct,
      whiteStats,
      blackStats
    }
  }
  
  const openPredictionModal = (match) => {
    if (!user || !userPlayer) {
      showToast('error', 'Debes iniciar sesión para predecir')
      return
    }
    if (match.winner) {
      showToast('error', 'Este partido ya terminó')
      return
    }
    if (predictions[match.id]?.[user.uid]) {
      showToast('error', 'Ya hiciste tu predicción para este partido')
      return
    }
    setPredictionMatch(match)
    setSelectedPrediction(null)
    setShowPredictionModal(true)
  }

  const closePredictionModal = () => {
    setShowPredictionModal(false)
    setPredictionMatch(null)
    setSelectedPrediction(null)
    setCoinBet(10)
  }

  const spendLukCoins = async (amount, cosmeticsUpdate = {}) => {
    if (!user || !userPlayer) return
    const currentCoins = calculateLukCoins(userPlayer)
    if (amount > currentCoins) {
      showToast('error', 'No tienes suficientes LukCoins')
      return
    }
    const currentLink = userLinks?.[user.uid] || {}
    const newSpent = (currentLink.lukcoinsSpent || 0) + amount
    const newCosmetics = { ...(currentLink.cosmetics || {}), ...cosmeticsUpdate }

    try {
      await setDoc(
        doc(db, 'userLinks', user.uid),
        {
          lukcoinsSpent: newSpent,
          cosmetics: newCosmetics,
          xpMultiplier: newCosmetics.xpMultiplier || currentLink.xpMultiplier || 1,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
      showToast('success', 'Compra realizada')
    } catch (error) {
      console.error('Error saving LukCoins purchase:', error)
      showToast('error', 'No se pudo completar la compra')
    }
  }

  const submitPrediction = async () => {
    if (!selectedPrediction || !predictionMatch || !user) {
      showToast('error', 'Selecciona un equipo')
      return
    }
    
    // Check if user has enough LukCoins
    const currentCoins = userPlayer ? calculateLukCoins(userPlayer) : 0
    if (coinBet > currentCoins) {
      showToast('error', `No tienes suficientes LukCoins (tienes ${currentCoins})`)
      return
    }
    
    try {
      const predictionId = `${user.uid}_${predictionMatch.id}`
      const probability = calculateTeamProbability(predictionMatch)
      const winningOdds = selectedPrediction === 'white' ? probability.white : probability.black
      const potentialWin = Math.round(coinBet * (100 / winningOdds - 1))
      
      await setDoc(doc(db, 'predictions', predictionId), {
        odedBy: user.uid,
        matchId: predictionMatch.id,
        prediction: selectedPrediction,
        xpBet: coinBet,
        potentialWin: potentialWin,
        lukCoinsBet: coinBet,
        lukCoinsWin: potentialWin,
        probability: winningOdds,
        timestamp: new Date().toISOString(),
        resolved: false
      })
      showToast('success', `¡Apostaste ${coinBet} LukCoins al Equipo ${selectedPrediction === 'white' ? 'Blanco' : 'Negro'}!`)
      closePredictionModal()
    } catch (error) {
      console.error('Error saving prediction:', error)
      showToast('error', 'Error al guardar predicción')
    }
  }

  const triggerMVPConfetti = (matchId, mvpPlayerId) => {
    if (confettiTriggered.current[matchId]) return
    if (mvpPlayerId !== userPlayer) return
    confettiTriggered.current[matchId] = true
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#ffd700', '#ffffff'],
    })
  }

  // Rating modal functions
  const openRatingModal = async match => {
    if (!userPlayer) {
      showToast('error', 'Primero debes vincular tu cuenta')
      return
    }

    try {
      const matchDoc = await getDoc(doc(db, 'matches', match.id))
      if (matchDoc.exists()) {
        const data = matchDoc.data()
        if (data.ratingsOpen === false) {
          showToast('error', 'Las calificaciones están cerradas para este partido')
          return
        }
      }
    } catch (error) {
      console.error('Error checking match status:', error)
    }

    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    if (!allPlayers.includes(userPlayer)) {
      showToast('error', 'Solo puedes calificar partidos en los que jugaste')
      return
    }

    const existingRatings = {}
    Object.entries(ratings).forEach(([playerId, playerRatings]) => {
      const myRating = playerRatings.find(
        r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === match.id
      )
      if (myRating) {
        existingRatings[playerId] = myRating.score
      }
    })

    setSelectedMatch(match)
    setCurrentRatings(existingRatings)
    setShowRatingModal(true)
  }

  const handleRatingChange = (playerId, score) => {
    if (score <= 3) {
      if (!confirm('¿Enserio tan bajo? Solo coloca esa nota si se lo merece de verdad')) {
        return
      }
    }
    setCurrentRatings({ ...currentRatings, [playerId]: score })
  }

  const submitRatings = async () => {
    if (!selectedMatch || !userPlayer) return

    const matchDoc = await getDoc(doc(db, 'matches', selectedMatch.id))
    if (matchDoc.exists()) {
      const data = matchDoc.data()
      if (data.ratingsOpen === false) {
        showToast('error', 'Las calificaciones han sido cerradas para este partido')
        setShowRatingModal(false)
        return
      }
    }

    if (blockedUsers.includes(user?.uid)) {
      showToast('error', 'Tu cuenta ha sido bloqueada para calificar')
      return
    }

    const playersToRate = getPlayersToRate(selectedMatch)
    const missingRatings = playersToRate.filter(id => !currentRatings[id])

    if (missingRatings.length > 0) {
      const missingNames = missingRatings.map(id => getPlayerName(id)).join(', ')
      showToast('error', `Faltan por calificar: ${missingNames}`)
      return
    }

    const batch = writeBatch(db)

    Object.entries(currentRatings).forEach(([playerId, score]) => {
      const ratingId = `${userPlayer}_${playerId}_${selectedMatch.id}`
      const ratingRef = doc(db, 'ratings', ratingId)
      batch.set(ratingRef, {
        ratedBy: userPlayer,
        ratedPlayerId: playerId,
        matchId: selectedMatch.id,
        score: parseInt(score),
        timestamp: new Date().toISOString(),
      })
    })

    await batch.commit()
    await logActivity('rating', {
      matchId: selectedMatch.id,
      matchDate: selectedMatch.date,
      ratingsCount: Object.keys(currentRatings).length,
    })

    setRatingSuccess(true)
  }

  const closeRatingModal = () => {
    setShowRatingModal(false)
    setSelectedMatch(null)
    setCurrentRatings({})
    setRatingSuccess(false)
  }

  const getPlayersToRate = match => {
    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    return allPlayers.filter(id => id !== userPlayer)
  }

  const hasMyRatings = matchId => {
    if (!userPlayer) return false
    return Object.values(ratings).some(playerRatings =>
      playerRatings.some(
        r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === matchId
      )
    )
  }

  // Match functions
  const handlePlayerToggle = (playerId, team) => {
    if (team === 'white') {
      if (teamWhite.includes(playerId)) {
        setTeamWhite(teamWhite.filter(id => id !== playerId))
      } else if (!teamBlack.includes(playerId)) {
        setTeamWhite([...teamWhite, playerId])
      }
    } else {
      if (teamBlack.includes(playerId)) {
        setTeamBlack(teamBlack.filter(id => id !== playerId))
      } else if (!teamWhite.includes(playerId)) {
        setTeamBlack([...teamBlack, playerId])
      }
    }
  }

  const handleAddMatch = async () => {
    if (!matchDate || teamWhite.length === 0 || teamBlack.length === 0) {
      showToast('error', 'Completa fecha y equipos')
      return
    }

    const matchData = {
      date: matchDate,
      venue: matchVenue,
      teamWhite: [...teamWhite],
      teamBlack: [...teamBlack],
      winner,
      ratingsOpen: true,
    }

    if (editingMatchId) {
      await updateDoc(doc(db, 'matches', editingMatchId), matchData)
      await logActivity('match_edit', { matchId: editingMatchId, matchDate: matchData.date })
    } else {
      const newMatchId = Date.now().toString()
      await setDoc(doc(db, 'matches', newMatchId), matchData)
      await logActivity('match_create', {
        matchId: newMatchId,
        matchDate: matchData.date,
        venue: matchData.venue,
      })
    }

    resetMatchForm()
    setActiveTab('matches')
  }

  const resetMatchForm = () => {
    setMatchDate('')
    setMatchVenue('LUKTO')
    setTeamWhite([])
    setTeamBlack([])
    setWinner('')
    setEditingMatchId(null)
  }

  const openEditMatch = match => {
    setMatchDate(match.date)
    setMatchVenue(match.venue)
    setTeamWhite([...match.teamWhite])
    setTeamBlack([...match.teamBlack])
    setWinner(match.winner)
    setEditingMatchId(match.id)
    setActiveTab('new')
  }

  const handleDeleteMatch = async matchId => {
    if (
      !confirm(
        '¿Estás seguro de eliminar este partido y todas sus calificaciones? Esta acción no se puede deshacer.'
      )
    )
      return

    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'matches', matchId))

      const ratingsQuery = query(collection(db, 'ratings'), where('matchId', '==', matchId))
      const ratingsSnapshot = await getDocs(ratingsQuery)
      ratingsSnapshot.docs.forEach(docSnap => {
        batch.delete(doc(db, 'ratings', docSnap.id))
      })

      const predictionsQuery = query(collection(db, 'predictions'), where('matchId', '==', matchId))
      const predictionsSnapshot = await getDocs(predictionsQuery)
      predictionsSnapshot.docs.forEach(docSnap => {
        batch.delete(doc(db, 'predictions', docSnap.id))
      })

      await batch.commit()
      showToast('success', 'Partido y calificaciones eliminados')
    } catch (error) {
      console.error('Error deleting match:', error)
      showToast('error', 'Error al eliminar partido')
    }
  }

  const toggleMatchRatings = async (matchId, isCurrentlyOpen) => {
    try {
      const newState = !isCurrentlyOpen
      await updateDoc(doc(db, 'matches', matchId), { ratingsOpen: newState })
      showToast('success', newState ? '✅ Calificaciones ABIERTAS' : '🔒 Calificaciones CERRADAS')
    } catch (error) {
      console.error('Error toggling ratings:', error)
      showToast('error', 'Error al cambiar estado')
    }
  }

  // Admin user linking
  const adminLinkUserToPlayer = async (userId, playerId) => {
    if (!isAdmin || !userId || !playerId || playerId === '') return
    if (linkingUser === userId) return

    const playerToLink = players.find(p => p.id === playerId)
    if (!playerToLink) return

    setLinkingUser(userId)

    try {
      const linkRef = doc(db, 'userLinks', userId)
      const pendingUser = pendingUsers.find(p => p.odedBy === userId)

      await updateDoc(linkRef, {
        playerId: String(playerId),
        linkedAt: new Date().toISOString(),
      })

      await logActivity('user_link', {
        linkedUserId: userId,
        linkedUserEmail: pendingUser?.userEmail,
        linkedUserName: pendingUser?.userName,
        playerId: playerId,
        playerName: playerToLink.name,
      })

      setTimeout(() => window.location.reload(), 1000)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLinkingUser(null)
    }
  }

  const adminUnlinkUser = async odedBy => {
    if (!isAdmin) return
    if (!confirm('¿Estás seguro de desvincular este usuario?')) return

    try {
      const linkRef = doc(db, 'userLinks', odedBy)
      await updateDoc(linkRef, { playerId: null })
      showToast('success', 'Usuario desvinculado')
    } catch (error) {
      console.error('Error unlinking user:', error)
      showToast('error', 'Error al desvincular')
    }
  }

  const adminDeleteUser = async (userId, userName) => {
    if (!isAdmin) return
    if (!confirm(`¿Eliminar completamente a "${userName}"? Esta acción no se puede deshacer.`)) return

    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'userLinks', userId))
      await batch.commit()
      showToast('success', 'Cuenta eliminada')
    } catch (error) {
      console.error('Error deleting user:', error)
      showToast('error', 'Error al eliminar')
    }
  }

  // Notification functions
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('error', 'Tu navegador no soporta notificaciones')
      return
    }

    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)

    if (permission === 'granted') {
      showToast('success', '¡Notificaciones activadas!')
    } else {
      showToast('error', 'Notificaciones bloqueadas')
    }
  }

  const showProfile = playerId => {
    setSelectedPlayerProfile(playerId)
    setShowPlayerProfile(true)
  }

  const lukCoins = userPlayer ? calculateLukCoins(userPlayer) : 0

  // ============ RENDER ============

  return (
    <>
      {/* Onboarding for new users */}
      {showOnboarding && (
        <Onboarding 
          onComplete={completeOnboarding} 
          onSkip={completeOnboarding} 
        />
      )}

      <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <Header
        onShowLoginModal={() => setShowLoginModal(true)}
        onAdminLogout={handleAdminLogout}
        lukCoins={lukCoins}
      />

      {/* Time Filter Pills with Haptic */}
      {(activeTab === 'stats' || activeTab === 'ratings') && (
        <div className="filter-pills animate-fade-in">
          {['all', 'month', 'week'].map((filter) => (
            <button
              key={filter}
              className={`pill btn-haptic ${timeFilter === filter ? 'active' : ''}`}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(5)
                setTimeFilter(filter)
              }}
            >
              {filter === 'all' ? 'Todo' : filter === 'month' ? 'Mes' : 'Semana'}
            </button>
          ))}
        </div>
      )}

      {/* Admin Tabs */}
      {isAdmin && (
        <nav className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`admin-tab ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            + Partido
          </button>
          <button
            className={`admin-tab ${activeTab === 'players' ? 'active' : ''}`}
            onClick={() => setActiveTab('players')}
          >
            Jugadores
          </button>
          <button
            className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Vincular {pendingUsers.length > 0 && <span className="badge">{pendingUsers.length}</span>}
          </button>
          <button
            className={`admin-tab ${activeTab === 'tools' ? 'active' : ''}`}
            onClick={() => setActiveTab('tools')}
          >
            Herramientas
          </button>
          <button
            className={`admin-tab ${activeTab === 'allRatings' ? 'active' : ''}`}
            onClick={() => setActiveTab('allRatings')}
          >
            Historial
          </button>
        </nav>
      )}

      {/* Pending Ratings & Predictions Notification */}
      {(activeTab === 'stats' || activeTab === 'matches' || activeTab === 'ratings') && (
        <PendingRatingsNotification 
          onOpenRatingModal={openRatingModal} 
          onOpenPrediction={openPredictionModal}
        />
      )}

      {/* Loading State - Stats */}
      {activeTab === 'stats' && !dataLoaded && (
        <section className="stats-section">
          <h2 className="section-title">Ranking de Jugadores</h2>
          <p className="section-subtitle">Cargando estadísticas...</p>
          <SkeletonTable rows={8} />
        </section>
      )}

      {/* Loading State - Matches */}
      {activeTab === 'matches' && !dataLoaded && (
        <section className="stats-section">
          <h2 className="section-title">Partidos</h2>
          <p className="section-subtitle">Cargando partidos...</p>
          <SkeletonMatchesList count={4} />
        </section>
      )}

      {/* Loading State - Ratings */}
      {activeTab === 'ratings' && !dataLoaded && (
        <section className="stats-section">
          <h2 className="section-title">Calificaciones</h2>
          <p className="section-subtitle">Cargando calificaciones...</p>
          <SkeletonTable rows={6} />
        </section>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && dataLoaded && (
        <StatsTab
          stats={displayStats}
          playerOfWeek={getPlayerOfWeek()}
          playerOfMonth={getPlayerOfMonth()}
          onPlayerClick={showProfile}
          calculateXP={calculateXP}
          getRank={getRank}
          getRankIcon={getRankIcon}
          getWinRateClass={getWinRateClass}
          getRatingClass={getRatingClass}
          announcements={announcements}
        />
      )}

      {/* Ratings Tab */}
      {activeTab === 'ratings' && <RatingsTab getRatingClass={getRatingClass} />}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <MatchesTab
          onOpenRatingModal={openRatingModal}
          onOpenEditMatch={openEditMatch}
          onDeleteMatch={handleDeleteMatch}
          onToggleRatings={toggleMatchRatings}
          onOpenPrediction={openPredictionModal}
          triggerMVPConfetti={triggerMVPConfetti}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <section className="stats-section analytics-section">
          <h2 className="section-title">Análisis Avanzado</h2>
          
          {/* Best Duos & Trios */}
          {(() => {
            // Calculate duo and trio stats
            const duoStats = {}
            const trioStats = {}
            
            matches.forEach(m => {
              if (!m.winner) return
              
              const processTeam = (team, won) => {
                if (!team || team.length < 2) return
                
                // Duos
                for (let i = 0; i < team.length; i++) {
                  for (let j = i + 1; j < team.length; j++) {
                    const key = [team[i], team[j]].sort().join('_')
                    if (!duoStats[key]) duoStats[key] = { ids: [team[i], team[j]], wins: 0, games: 0 }
                    duoStats[key].games++
                    if (won) duoStats[key].wins++
                  }
                }
                
                // Trios
                if (team.length >= 3) {
                  for (let i = 0; i < team.length; i++) {
                    for (let j = i + 1; j < team.length; j++) {
                      for (let k = j + 1; k < team.length; k++) {
                        const key = [team[i], team[j], team[k]].sort().join('_')
                        if (!trioStats[key]) trioStats[key] = { ids: [team[i], team[j], team[k]], wins: 0, games: 0 }
                        trioStats[key].games++
                        if (won) trioStats[key].wins++
                      }
                    }
                  }
                }
              }
              
              processTeam(m.teamWhite, m.winner === 'white')
              processTeam(m.teamBlack, m.winner === 'black')
            })
            
            const topDuos = Object.values(duoStats)
              .filter(d => d.games >= 2)
              .map(d => ({ ...d, winRate: Math.round((d.wins / d.games) * 100) }))
              .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
              .slice(0, 3)
            
            const topTrios = Object.values(trioStats)
              .filter(t => t.games >= 2)
              .map(t => ({ ...t, winRate: Math.round((t.wins / t.games) * 100) }))
              .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
              .slice(0, 3)
            
            if (topDuos.length === 0 && topTrios.length === 0) return null
            
            return (
              <div className="team-stats-section">
                {topDuos.length > 0 && (
                  <div className="team-stats-card">
                    <h4 className="ts-title">Mejores Duplas</h4>
                    <div className="team-list">
                      {topDuos.map((duo, idx) => (
                        <div key={idx} className="team-item">
                          <span className="team-rank">#{idx + 1}</span>
                          <div className="team-players">
                            {duo.ids.map(id => (
                              <span key={id} className="team-player">
                                <AvatarImage
                                  src={getPlayerPhoto(id)}
                                  name={getPlayerName(id)}
                                  imgClassName="team-avatar"
                                  fallbackClassName="team-avatar-ph"
                                />
                              </span>
                            ))}
                          </div>
                          <div className="team-names">
                            {duo.ids.map(id => getPlayerName(id)?.split(' ')[0]).join(' & ')}
                          </div>
                          <div className="team-record">
                            <span className="wr good">{duo.winRate}%</span>
                            <span className="games">{duo.wins}V-{duo.games - duo.wins}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {topTrios.length > 0 && (
                  <div className="team-stats-card">
                    <h4 className="ts-title">Mejores Tríos</h4>
                    <div className="team-list">
                      {topTrios.map((trio, idx) => (
                        <div key={idx} className="team-item">
                          <span className="team-rank">#{idx + 1}</span>
                          <div className="team-players">
                            {trio.ids.map(id => (
                              <span key={id} className="team-player">
                                <AvatarImage
                                  src={getPlayerPhoto(id)}
                                  name={getPlayerName(id)}
                                  imgClassName="team-avatar"
                                  fallbackClassName="team-avatar-ph"
                                />
                              </span>
                            ))}
                          </div>
                          <div className="team-names">
                            {trio.ids.map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                          </div>
                          <div className="team-record">
                            <span className="wr good">{trio.winRate}%</span>
                            <span className="games">{trio.wins}V-{trio.games - trio.wins}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
          
          {/* Player Selection */}
          <div className="analytics-selectors">
            <div className="selector-group">
              <label>Jugador 1</label>
              <select
                value={h2hPlayer1 || ''}
                onChange={e => setH2hPlayer1(e.target.value)}
                className="player-select-dropdown"
              >
                <option value="">Seleccionar...</option>
                {stats.map(player => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
            <div className="selector-vs">VS</div>
            <div className="selector-group">
              <label>Jugador 2 (opcional)</label>
              <select
                value={h2hPlayer2 || ''}
                onChange={e => setH2hPlayer2(e.target.value)}
                className="player-select-dropdown"
              >
                <option value="">Seleccionar...</option>
                {stats.filter(p => p.id !== h2hPlayer1).map(player => (
                  <option key={player.id} value={player.id}>{player.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!h2hPlayer1 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
              <h3>Selecciona un jugador</h3>
              <p>Elige un jugador para ver su análisis o compara dos jugadores</p>
            </div>
          )}
          
          {/* H2H Comparison when both players selected */}
          {h2hPlayer1 && h2hPlayer2 && (() => {
            const p1 = stats.find(s => s.id === h2hPlayer1)
            const p2 = stats.find(s => s.id === h2hPlayer2)
            if (!p1 || !p2) return null
            
            // Calculate H2H stats (when they played together/against)
            const h2hMatches = matches.filter(m => {
              const p1InWhite = m.teamWhite?.includes(h2hPlayer1)
              const p1InBlack = m.teamBlack?.includes(h2hPlayer1)
              const p2InWhite = m.teamWhite?.includes(h2hPlayer2)
              const p2InBlack = m.teamBlack?.includes(h2hPlayer2)
              return (p1InWhite || p1InBlack) && (p2InWhite || p2InBlack)
            })
            
            let sameTeamWins = 0, sameTeamGames = 0
            let p1WinsAgainst = 0, p2WinsAgainst = 0, vsGames = 0
            
            h2hMatches.forEach(m => {
              const p1InWhite = m.teamWhite?.includes(h2hPlayer1)
              const p2InWhite = m.teamWhite?.includes(h2hPlayer2)
              const sameTeam = p1InWhite === p2InWhite
              
              if (sameTeam) {
                sameTeamGames++
                const won = (p1InWhite && m.winner === 'white') || (!p1InWhite && m.winner === 'black')
                if (won) sameTeamWins++
              } else {
                vsGames++
                if (p1InWhite && m.winner === 'white') p1WinsAgainst++
                else if (!p1InWhite && m.winner === 'black') p1WinsAgainst++
                else if (m.winner) p2WinsAgainst++
              }
            })
            
            return (
              <div className="h2h-comparison">
                <h3 className="h2h-title">Comparación Directa</h3>
                
                {/* Stats Comparison */}
                <div className="h2h-stats-grid">
                  <div className="h2h-player">
                    <div className="h2h-avatar">
                      <AvatarImage src={getPlayerPhoto(h2hPlayer1)} name={p1.name} />
                    </div>
                    <span className="h2h-name">{p1.name}</span>
                  </div>
                  
                  <div className="h2h-stats">
                    <div className="h2h-stat-row">
                      <span className={`h2h-val ${(p1.winRate || 0) > (p2.winRate || 0) ? 'winner' : ''}`}>
                        {typeof p1.winRate === 'number' ? p1.winRate.toFixed(0) : 0}%
                      </span>
                      <span className="h2h-label">Win Rate</span>
                      <span className={`h2h-val ${(p2.winRate || 0) > (p1.winRate || 0) ? 'winner' : ''}`}>
                        {typeof p2.winRate === 'number' ? p2.winRate.toFixed(0) : 0}%
                      </span>
                    </div>
                    <div className="h2h-stat-row">
                      <span className={`h2h-val ${parseFloat(p1.avgRating || 0) > parseFloat(p2.avgRating || 0) ? 'winner' : ''}`}>
                        {p1.avgRating || '-'}
                      </span>
                      <span className="h2h-label">Rating</span>
                      <span className={`h2h-val ${parseFloat(p2.avgRating || 0) > parseFloat(p1.avgRating || 0) ? 'winner' : ''}`}>
                        {p2.avgRating || '-'}
                      </span>
                    </div>
                    <div className="h2h-stat-row">
                      <span className={`h2h-val ${(p1.mvps || 0) > (p2.mvps || 0) ? 'winner' : ''}`}>
                        {p1.mvps || 0}
                      </span>
                      <span className="h2h-label">MVPs</span>
                      <span className={`h2h-val ${(p2.mvps || 0) > (p1.mvps || 0) ? 'winner' : ''}`}>
                        {p2.mvps || 0}
                      </span>
                    </div>
                    <div className="h2h-stat-row">
                      <span className={`h2h-val ${(p1.played || 0) > (p2.played || 0) ? 'winner' : ''}`}>
                        {p1.played || 0}
                      </span>
                      <span className="h2h-label">Partidos</span>
                      <span className={`h2h-val ${(p2.played || 0) > (p1.played || 0) ? 'winner' : ''}`}>
                        {p2.played || 0}
                      </span>
                    </div>
                  </div>
                  
                  <div className="h2h-player">
                    <div className="h2h-avatar">
                      <AvatarImage src={getPlayerPhoto(h2hPlayer2)} name={p2.name} />
                    </div>
                    <span className="h2h-name">{p2.name}</span>
                  </div>
                </div>
                
                {/* H2H Record */}
                {h2hMatches.length > 0 && (
                  <div className="h2h-record">
                    <h4 className="h2h-subtitle">Historial Directo ({h2hMatches.length} partidos)</h4>
                    <div className="h2h-record-cards">
                      {sameTeamGames > 0 && (
                        <div className="h2h-record-card together">
                          <span className="hrc-title">Juntos</span>
                          <span className="hrc-value">{sameTeamWins}V - {sameTeamGames - sameTeamWins}D</span>
                          <span className="hrc-percent">{Math.round((sameTeamWins / sameTeamGames) * 100)}% WR</span>
                        </div>
                      )}
                      {vsGames > 0 && (
                        <div className="h2h-record-card versus">
                          <span className="hrc-title">Enfrentados</span>
                          <span className="hrc-value">{p1.name?.split(' ')[0]}: {p1WinsAgainst} | {p2.name?.split(' ')[0]}: {p2WinsAgainst}</span>
                          <span className="hrc-percent">{vsGames} partidos</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {h2hPlayer1 && (() => {
            const playerData = stats.find(s => s.id === h2hPlayer1)
            const playerRatings = ratings[h2hPlayer1] || []
            const xp = calculateXP(h2hPlayer1)
            const rank = getRank(xp)
            
            // Calculate performance by match
            const matchPerformance = matches
              .filter(m => m.teamWhite?.includes(h2hPlayer1) || m.teamBlack?.includes(h2hPlayer1))
              .map(m => {
                const matchRatings = playerRatings.filter(r => r.matchId === m.id)
                const avgScore = matchRatings.length > 0 
                  ? matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length 
                  : 0
                const inWhite = m.teamWhite?.includes(h2hPlayer1)
                const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
                return {
                  date: m.date,
                  avgScore: typeof avgScore === 'number' ? avgScore.toFixed(1) : '0.0',
                  won,
                  venue: m.venue
                }
              })
              .sort((a, b) => new Date(a.date) - new Date(b.date))

            // Best/Worst teammates
            const teammateStats = {}
            matches.forEach(m => {
              const inWhite = m.teamWhite?.includes(h2hPlayer1)
              const inBlack = m.teamBlack?.includes(h2hPlayer1)
              if (!inWhite && !inBlack) return
              
              const team = inWhite ? m.teamWhite : m.teamBlack
              const won = (inWhite && m.winner === 'white') || (inBlack && m.winner === 'black')
              
              team?.forEach(tid => {
                if (tid === h2hPlayer1) return
                if (!teammateStats[tid]) teammateStats[tid] = { wins: 0, games: 0 }
                teammateStats[tid].games++
                if (won) teammateStats[tid].wins++
              })
            })

            const teammateRankings = Object.entries(teammateStats)
              .filter(([_, s]) => s.games >= 2)
              .map(([id, s]) => ({
                id,
                name: getPlayerName(id),
                winRate: s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0,
                games: s.games
              }))
              .sort((a, b) => Number(b.winRate) - Number(a.winRate))

            const bestTeammate = teammateRankings[0]
            const worstTeammate = teammateRankings[teammateRankings.length - 1]

            return (
              <div className="analytics-content">
                {/* Player Summary Card */}
                <div className="analytics-summary-card">
                  <div className="asc-header">
                    <AvatarImage
                      src={getPlayerPhoto(h2hPlayer1)}
                      name={getPlayerName(h2hPlayer1)}
                      imgClassName="asc-avatar"
                      fallbackClassName="asc-avatar-placeholder"
                    />
                    <div className="asc-info">
                      <h3>{getPlayerName(h2hPlayer1)}</h3>
                      <div className="asc-rank" style={{ color: rank?.color || '#CD7F32' }}>
                        {getRankIcon(rank?.key || 'bronce', 18)} {rank?.name || 'Bronce'}
                      </div>
                    </div>
                  </div>
                  <div className="asc-stats">
                    <div className="asc-stat">
                      <span className="asc-stat-value">{typeof playerData?.winRate === 'number' ? Math.round(playerData.winRate) : 0}%</span>
                      <span className="asc-stat-label">Win Rate</span>
                    </div>
                    <div className="asc-stat">
                      <span className="asc-stat-value">{typeof playerData?.avgRating === 'number' ? playerData.avgRating.toFixed(1) : (playerData?.avgRating || '-')}</span>
                      <span className="asc-stat-label">Rating</span>
                    </div>
                    <div className="asc-stat">
                      <span className="asc-stat-value">{playerData?.mvps || 0}</span>
                      <span className="asc-stat-label">MVPs</span>
                    </div>
                    <div className="asc-stat">
                      <span className="asc-stat-value">{xp}</span>
                      <span className="asc-stat-label">XP</span>
                    </div>
                  </div>
                </div>

                {/* Teammate Analysis */}
                {(bestTeammate || worstTeammate) && (
                  <div className="analytics-teammates">
                    <h4 className="analytics-subtitle">Compañeros de Equipo</h4>
                    <div className="teammates-grid">
                      {bestTeammate && (
                        <div className="teammate-card best">
                          <span className="tc-label">Mejor Compañero</span>
                          <span className="tc-name">{bestTeammate.name}</span>
                          <span className="tc-stat">{bestTeammate.winRate}% WR ({bestTeammate.games} juegos)</span>
                        </div>
                      )}
                      {worstTeammate && worstTeammate.id !== bestTeammate?.id && (
                        <div className="teammate-card worst">
                          <span className="tc-label">Peor Compañero</span>
                          <span className="tc-name">{worstTeammate.name}</span>
                          <span className="tc-stat">{worstTeammate.winRate}% WR ({worstTeammate.games} juegos)</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Match History */}
                <div className="analytics-history">
                  <h4 className="analytics-subtitle">Historial de Partidos</h4>
                  <div className="match-history-list">
                    {matchPerformance.length > 0 ? (
                      matchPerformance.slice(-10).reverse().map((m, idx) => (
                        <div key={idx} className={`match-history-item ${m.won ? 'win' : 'loss'}`}>
                          <div className="mhi-left">
                            <span className={`mhi-result ${m.won ? 'win' : 'loss'}`}>
                              {m.won ? 'V' : 'D'}
                            </span>
                            <div className="mhi-info">
                              <span className="mhi-date">
                                {new Date(m.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                              </span>
                              <span className="mhi-venue">{m.venue}</span>
                            </div>
                          </div>
                          <div className="mhi-rating">
                            {m.avgScore > 0 ? (
                              <span className={`rating-badge ${getRatingClass(parseFloat(m.avgScore))}`}>
                                {m.avgScore}
                              </span>
                            ) : (
                              <span className="no-rating">-</span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="no-data-text">Sin partidos registrados</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
        </section>
      )}

      {activeTab === 'store' && (
        <StoreTab lukCoins={lukCoins} onSpendLukCoins={spendLukCoins} />
      )}

      {/* Admin: Users Tab */}
      {activeTab === 'users' && isAdmin && (
        <section className="stats-section">
          <h2 className="section-title">Vincular Usuarios con Jugadores</h2>
          <p className="section-subtitle">
            Solo tú puedes decidir qué cuenta de Google corresponde a cada jugador
          </p>

          {pendingUsers.length > 0 && (
            <div className="pending-users-section">
              <h3 className="subsection-title">Usuarios Pendientes ({pendingUsers.length})</h3>
              <div className="user-links-list">
                {pendingUsers.map(pending => (
                  <PendingUserCard
                    key={pending.odedBy}
                    pending={pending}
                    players={players}
                    linkingUser={linkingUser}
                    onLink={adminLinkUserToPlayer}
                    onDelete={adminDeleteUser}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="linked-users-section">
            <h3 className="subsection-title">Usuarios Vinculados</h3>
            <div className="user-links-list">
              {Object.entries(userLinks).filter(([_, data]) => data.playerId).length > 0 ? (
                Object.entries(userLinks)
                  .filter(([_, data]) => data.playerId)
                  .map(([odedBy, data]) => (
                    <div key={odedBy} className="user-link-card linked">
                      <div className="user-link-info">
                        <img
                          src={data.userPhoto || data.odedByPhoto}
                          alt=""
                          className="user-link-avatar"
                        />
                        <div>
                          <div className="user-link-name">{data.userName || data.odedByName}</div>
                          <div className="user-link-email">{data.userEmail || data.odedByEmail}</div>
                        </div>
                      </div>
                      <div className="user-link-player">
                        → <strong>{getPlayerName(data.playerId)}</strong>
                      </div>
                      <div className="user-link-actions">
                        <button 
                          className="unlink-btn" 
                          onClick={() => adminUnlinkUser(odedBy)}
                          title="Desvincular"
                        >
                          ✕
                        </button>
                        <button 
                          className="delete-user-btn" 
                          onClick={() => adminDeleteUser(odedBy, data.userName || data.userEmail)}
                          title="Eliminar cuenta"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="empty-state small">
                  <p>No hay usuarios vinculados aún</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Admin: New Match Tab */}
      {activeTab === 'new' && isAdmin && (
        <section className="stats-section">
          <h2 className="section-title">
            {editingMatchId ? 'Editar Partido' : 'Registrar Nuevo Partido'}
          </h2>
          <div className="match-form">
            <div className="form-row">
              <div className="form-group">
                <label>Fecha del Partido</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={e => setMatchDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Lugar / Evento</label>
                <input
                  type="text"
                  value={matchVenue}
                  onChange={e => setMatchVenue(e.target.value)}
                  placeholder="LUKTO"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="team-section team-white">
                <div className="team-header">
                  <span className="team-badge white"></span>
                  <span className="team-title">EQUIPO BLANCO ({teamWhite.length})</span>
                </div>
                <div className="player-select-grid">
                  {players.map(player => (
                    <button
                      key={player.id}
                      className={`player-chip ${teamWhite.includes(player.id) ? 'selected' : ''} ${teamBlack.includes(player.id) ? 'disabled' : ''}`}
                      onClick={() => handlePlayerToggle(player.id, 'white')}
                      disabled={teamBlack.includes(player.id)}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="team-section team-black">
                <div className="team-header">
                  <span className="team-badge black"></span>
                  <span className="team-title">EQUIPO NEGRO ({teamBlack.length})</span>
                </div>
                <div className="player-select-grid">
                  {players.map(player => (
                    <button
                      key={player.id}
                      className={`player-chip ${teamBlack.includes(player.id) ? 'selected' : ''} ${teamWhite.includes(player.id) ? 'disabled' : ''}`}
                      onClick={() => handlePlayerToggle(player.id, 'black')}
                      disabled={teamWhite.includes(player.id)}
                    >
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="form-group">
              <label style={{ textAlign: 'center', display: 'block', marginBottom: '0.5rem' }}>
                ¿Quién Ganó?
              </label>
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Opcional - Déjalo vacío para que los usuarios puedan hacer predicciones
              </p>
              <div className="winner-section">
                <button
                  className={`winner-btn ${winner === 'white' ? 'selected' : ''}`}
                  onClick={() => setWinner(winner === 'white' ? '' : 'white')}
                >
                  <span className="team-badge white"></span>
                  EQUIPO BLANCO
                </button>
                <button
                  className={`winner-btn ${winner === 'black' ? 'selected' : ''}`}
                  onClick={() => setWinner(winner === 'black' ? '' : 'black')}
                >
                  <span className="team-badge black"></span>
                  EQUIPO NEGRO
                </button>
              </div>
              {winner && (
                <button 
                  onClick={() => setWinner('')}
                  style={{ 
                    marginTop: '0.75rem', 
                    width: '100%', 
                    padding: '0.5rem', 
                    background: 'transparent', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Quitar ganador (permitir predicciones)
                </button>
              )}
            </div>

            <div className="form-buttons">
              {editingMatchId && (
                <button className="cancel-btn" onClick={resetMatchForm}>
                  CANCELAR
                </button>
              )}
              <button
                className="submit-btn"
                onClick={handleAddMatch}
                disabled={!matchDate || teamWhite.length === 0 || teamBlack.length === 0}
              >
                {editingMatchId ? 'ACTUALIZAR PARTIDO' : 'GUARDAR PARTIDO'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Admin: Players Tab */}
      {activeTab === 'players' && isAdmin && (
        <section className="stats-section">
          <h2 className="section-title">Lista de Jugadores</h2>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-card">
                <AvatarImage
                  src={getPlayerPhoto(player.id)}
                  name={player.name}
                  imgClassName="player-avatar-img"
                  fallbackClassName="player-avatar"
                />
                <div className="player-card-info">
                  <h3>{player.name}</h3>
                  {player.aliases && player.aliases.length > 0 && (
                    <div className="aliases">aka: {player.aliases.join(', ')}</div>
                  )}
                </div>
                <div className="player-card-actions">
                  <button className="edit-player-btn" onClick={() => openEditPlayer(player)}>
                    Editar
                  </button>
                  <button 
                    className="delete-player-btn" 
                    onClick={() => handleDeletePlayer(player.id, player.name)}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <div className="add-player-card" onClick={() => { closePlayerModal(); setShowPlayerModal(true); }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '300' }}>+</span>
              Agregar Jugador
            </div>
          </div>
        </section>
      )}

      {/* Admin: Dashboard Tab */}
      {activeTab === 'dashboard' && isAdmin && (
        <section className="stats-section dashboard-section">
          <h2 className="section-title">Panel de Administración</h2>
          
          {/* Stats Grid */}
          <div className="dashboard-stats-grid">
            <div className="dash-stat-card">
              <div className="dash-stat-icon">👥</div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{Object.keys(userLinks).length}</span>
                <span className="dash-stat-label">Usuarios</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-icon">⚽</div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{matches.length}</span>
                <span className="dash-stat-label">Partidos</span>
              </div>
            </div>
            <div className="dash-stat-card accent">
              <div className="dash-stat-icon">⭐</div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">
                  {Object.values(ratings).reduce((sum, r) => sum + r.length, 0)}
                </span>
                <span className="dash-stat-label">Calificaciones</span>
              </div>
            </div>
            <div className="dash-stat-card warning">
              <div className="dash-stat-icon">⏳</div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{pendingUsers.length}</span>
                <span className="dash-stat-label">Pendientes</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="dashboard-quick-actions">
            <h3 className="dash-section-title">Acciones Rápidas</h3>
            <div className="quick-actions-grid">
              <button className="quick-action-btn" onClick={() => setActiveTab('new')}>
                <span className="qa-icon">+</span>
                <span>Nuevo Partido</span>
              </button>
              <button className="quick-action-btn" onClick={() => setActiveTab('players')}>
                <span className="qa-icon">👤</span>
                <span>Jugadores</span>
              </button>
              <button className="quick-action-btn" onClick={() => setActiveTab('users')}>
                <span className="qa-icon">🔗</span>
                <span>Vincular</span>
                {pendingUsers.length > 0 && <span className="qa-badge">{pendingUsers.length}</span>}
              </button>
              <button className="quick-action-btn" onClick={() => setActiveTab('tools')}>
                <span className="qa-icon">⚙️</span>
                <span>Herramientas</span>
              </button>
            </div>
          </div>

          {/* Recent Matches */}
          <div className="dashboard-recent">
            <h3 className="dash-section-title">Partidos Recientes</h3>
            <div className="recent-matches-list">
              {matches.slice(-5).reverse().map(match => {
                const matchRatingsCount = Object.values(ratings)
                  .flat()
                  .filter(r => r.matchId === match.id).length
                return (
                  <div key={match.id} className="recent-match-item">
                    <div className="recent-match-info">
                      <span className="recent-match-date">
                        {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { 
                          day: 'numeric', month: 'short' 
                        })}
                      </span>
                      <span className="recent-match-teams">
                        {match.teamWhite.length} vs {match.teamBlack.length}
                      </span>
                      <span className={`recent-match-winner ${match.winner}`}>
                        {match.winner === 'white' ? 'Blanco' : 'Negro'}
                      </span>
                    </div>
                    <div className="recent-match-stats">
                      <span className="recent-match-ratings">{matchRatingsCount} ⭐</span>
                      <span className={`recent-match-status ${match.ratingsOpen !== false ? 'open' : 'closed'}`}>
                        {match.ratingsOpen !== false ? 'Abierto' : 'Cerrado'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top Raters */}
          <div className="dashboard-top-raters">
            <h3 className="dash-section-title">Usuarios Más Activos</h3>
            <div className="top-raters-list">
              {(() => {
                const raterCounts = {}
                Object.values(ratings).flat().forEach(r => {
                  if (r.ratedBy) {
                    raterCounts[r.ratedBy] = (raterCounts[r.ratedBy] || 0) + 1
                  }
                })
                return Object.entries(raterCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([playerId, count], idx) => {
                    const userLink = Object.values(userLinks).find(l => l.playerId === playerId)
                    return (
                      <div key={playerId} className="top-rater-item">
                        <span className="top-rater-pos">{idx + 1}</span>
                        <AvatarImage
                          src={userLink?.userPhoto || getPlayerPhoto(playerId)}
                          name={getPlayerName(playerId)}
                          imgClassName="top-rater-avatar"
                          fallbackClassName="top-rater-avatar top-rater-avatar-fallback"
                        />
                        <span className="top-rater-name">{getPlayerName(playerId)}</span>
                        <span className="top-rater-count">{count} votos</span>
                      </div>
                    )
                  })
              })()}
            </div>
          </div>
        </section>
      )}

      {/* Admin: Tools Tab */}
      {activeTab === 'tools' && isAdmin && (
        <section className="stats-section tools-section">
          <h2 className="section-title">Herramientas de Admin</h2>

          <div className="tools-grid">
            {/* Gestionar Admins */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">👑</span>
                <h3 className="tool-title">Administradores</h3>
              </div>
              <p className="tool-desc">Super Admin: {SUPER_ADMIN_EMAIL}</p>
              <div className="admin-list">
                {adminEmails.map(email => (
                  <div key={email} className="admin-item">
                    <span>{email}</span>
                    <button className="remove-btn" onClick={() => handleRemoveAdmin(email)}>×</button>
                  </div>
                ))}
              </div>
              <div className="add-admin-form">
                <input
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={newAdminEmail}
                  onChange={e => setNewAdminEmail(e.target.value)}
                />
                <button onClick={handleAddAdmin} className="add-btn">Agregar</button>
              </div>
            </div>

            {/* Bloquear Usuarios */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">🚫</span>
                <h3 className="tool-title">Usuarios Bloqueados</h3>
              </div>
              <p className="tool-desc">No pueden calificar</p>
              {blockedUsers.length > 0 ? (
                <div className="blocked-list">
                  {blockedUsers.map(userId => {
                    const userLink = Object.values(userLinks).find(l => l.odedBy === userId)
                    return (
                      <div key={userId} className="blocked-item">
                        <span>{userLink?.userName || userLink?.userEmail || userId}</span>
                        <button className="unblock-btn" onClick={async () => {
                          const newList = blockedUsers.filter(id => id !== userId)
                          await setDoc(doc(db, 'settings', 'blockedUsers'), { list: newList })
                        }}>Desbloquear</button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="no-data-text">Sin bloqueados</p>
              )}
              <div className="block-user-form">
                <select 
                  className="block-user-select"
                  onChange={async e => {
                    if (e.target.value) {
                      const newList = [...blockedUsers, e.target.value]
                      await setDoc(doc(db, 'settings', 'blockedUsers'), { list: newList })
                      e.target.value = ''
                      showToast('success', 'Usuario bloqueado')
                    }
                  }}
                >
                  <option value="">Bloquear usuario...</option>
                  {Object.entries(userLinks)
                    .filter(([uid]) => !blockedUsers.includes(uid))
                    .map(([uid, data]) => (
                      <option key={uid} value={uid}>{data.userName || data.userEmail}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Gestionar Partidos */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">⚽</span>
                <h3 className="tool-title">Partidos</h3>
              </div>
              <p className="tool-desc">Abrir/cerrar calificaciones</p>
              <div className="matches-control-list">
                {matches.slice(-5).reverse().map(match => (
                  <div key={match.id} className="match-control-item">
                    <span className="match-control-date">
                      {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      className={`match-toggle-btn ${match.ratingsOpen !== false ? 'open' : 'closed'}`}
                      onClick={async () => {
                        const matchRef = doc(db, 'matches', match.id)
                        await updateDoc(matchRef, { ratingsOpen: match.ratingsOpen === false })
                        showToast('success', match.ratingsOpen === false ? 'Calificaciones abiertas' : 'Calificaciones cerradas')
                      }}
                    >
                      {match.ratingsOpen !== false ? '🔓 Abierto' : '🔒 Cerrado'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Eliminar Calificaciones */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">🗑️</span>
                <h3 className="tool-title">Eliminar Calificaciones</h3>
              </div>
              <p className="tool-desc">Borrar todas las calificaciones de un partido</p>
              <select 
                className="delete-ratings-select"
                onChange={async e => {
                  if (e.target.value && confirm('¿Eliminar TODAS las calificaciones de este partido?')) {
                    const matchId = e.target.value
                    const batch = writeBatch(db)
                    Object.values(ratings).flat()
                      .filter(r => r.matchId === matchId)
                      .forEach(r => {
                        const ratingId = `${r.ratedBy}_${r.ratedPlayerId}_${matchId}`
                        batch.delete(doc(db, 'ratings', ratingId))
                      })
                    await batch.commit()
                    showToast('success', 'Calificaciones eliminadas')
                    e.target.value = ''
                  }
                }}
              >
                <option value="">Seleccionar partido...</option>
                {matches.slice(-10).reverse().map(match => (
                  <option key={match.id} value={match.id}>
                    {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {' - '}
                    {Object.values(ratings).flat().filter(r => r.matchId === match.id).length} calificaciones
                  </option>
                ))}
              </select>
            </div>

            {/* Configuración Liga */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">⚙️</span>
                <h3 className="tool-title">Configuración</h3>
              </div>
              <div className="config-form">
                <label>
                  <span>Votos mínimos para MVP</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={leagueSettings.mvpMinVotes}
                    onChange={async e => {
                      const val = parseInt(e.target.value) || 1
                      await setDoc(doc(db, 'settings', 'league'), { ...leagueSettings, mvpMinVotes: val })
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Exportar Datos */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon">📥</span>
                <h3 className="tool-title">Exportar Datos</h3>
              </div>
              <p className="tool-desc">Descargar backup completo</p>
              <div className="export-buttons">
                <button className="export-btn" onClick={() => {
                  const data = { players, matches, ratings, userLinks, exportedAt: new Date().toISOString() }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `lukto-backup-${new Date().toISOString().split('T')[0]}.json`
                  a.click()
                  showToast('success', 'Backup descargado')
                }}>
                  JSON
                </button>
                <button className="export-btn" onClick={() => {
                  let csv = 'Jugador,Partidos,Victorias,Derrotas,Win Rate,Rating,MVPs\n'
                  stats.forEach(s => {
                    const wr = typeof s.winRate === 'number' ? s.winRate.toFixed(1) : s.winRate || 0
                    const ar = typeof s.avgRating === 'number' ? s.avgRating.toFixed(1) : (s.avgRating || '-')
                    csv += `${s.name},${s.played},${s.wins},${s.losses},${wr}%,${ar},${s.mvps}\n`
                  })
                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `lukto-stats-${new Date().toISOString().split('T')[0]}.csv`
                  a.click()
                  showToast('success', 'CSV descargado')
                }}>
                  CSV
                </button>
              </div>
            </div>

            {/* Anuncios */}
            <div className="tool-card wide">
              <div className="tool-header">
                <span className="tool-icon">📢</span>
                <h3 className="tool-title">Enviar Anuncio</h3>
              </div>
              <p className="tool-desc">Mensaje visible para todos los usuarios</p>
              <div className="announcement-form">
                <input
                  type="text"
                  placeholder="Escribe tu anuncio..."
                  id="announcement-input"
                  maxLength={200}
                />
                <button className="send-announcement-btn" onClick={async () => {
                  const input = document.getElementById('announcement-input')
                  const message = input.value.trim()
                  if (!message) return
                  await addDoc(collection(db, 'announcements'), {
                    message,
                    createdAt: new Date().toISOString(),
                    createdBy: user.email
                  })
                  input.value = ''
                  showToast('success', 'Anuncio enviado')
                }}>
                  Enviar
                </button>
              </div>
              {announcements.length > 0 && (
                <div className="current-announcements">
                  <span className="announcements-label">Anuncios activos:</span>
                  {announcements.slice(0, 3).map(a => (
                    <div key={a.id} className="announcement-item">
                      <span>{a.message}</span>
                      <button className="delete-announcement" onClick={async () => {
                        await deleteDoc(doc(db, 'announcements', a.id))
                        showToast('success', 'Anuncio eliminado')
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Admin: All Ratings Tab */}
      {activeTab === 'allRatings' && isAdmin && (
        <section className="stats-section history-section">
          <h2 className="section-title">Historial de Calificaciones</h2>
          <p className="section-subtitle">Detalle de quién calificó a quién en cada partido</p>
          
          <div className="ratings-history">
            {[...matches].reverse().map(match => {
              const matchRatings = []
              Object.entries(ratings).forEach(([playerId, playerRatings]) => {
                playerRatings.filter(r => r.matchId === match.id).forEach(r => {
                  const raterLink = Object.values(userLinks).find(l => l.playerId === r.ratedBy)
                  matchRatings.push({
                    ...r,
                    ratedPlayerName: getPlayerName(playerId),
                    raterName: getPlayerName(r.ratedBy),
                    raterEmail: raterLink?.userEmail || 'Desconocido',
                    raterPhoto: raterLink?.userPhoto
                  })
                })
              })

              if (matchRatings.length === 0) return null

              // Group by rater
              const groupedByRater = {}
              matchRatings.forEach(r => {
                if (!groupedByRater[r.ratedBy]) {
                  groupedByRater[r.ratedBy] = {
                    raterName: r.raterName,
                    raterEmail: r.raterEmail,
                    raterPhoto: r.raterPhoto,
                    ratings: []
                  }
                }
                groupedByRater[r.ratedBy].ratings.push(r)
              })

              return (
                <div key={match.id} className="history-match-card">
                  <div className="history-match-header">
                    <div className="history-match-date">
                      <span className="history-day">
                        {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric' })}
                      </span>
                      <span className="history-month">
                        {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short' })}
                      </span>
                    </div>
                    <div className="history-match-info">
                      <span className="history-match-title">
                        {match.teamWhite.length} vs {match.teamBlack.length} • {match.venue}
                      </span>
                      <span className="history-match-stats">
                        {matchRatings.length} calificaciones • {Object.keys(groupedByRater).length} calificadores
                      </span>
                    </div>
                  </div>
                  
                  <div className="history-raters-list">
                    {Object.entries(groupedByRater).map(([raterId, raterData]) => (
                      <div key={raterId} className="history-rater-card">
                        <div className="history-rater-header">
                          {raterData.raterPhoto ? (
                            <img src={raterData.raterPhoto} alt="" className="history-rater-avatar" />
                          ) : (
                            <div className="history-rater-avatar-placeholder">
                              {raterData.raterName?.charAt(0) || '?'}
                            </div>
                          )}
                          <div className="history-rater-info">
                            <span className="history-rater-name">{raterData.raterName}</span>
                            <span className="history-rater-email">{raterData.raterEmail}</span>
                          </div>
                        </div>
                        <div className="history-ratings-grid">
                          {raterData.ratings.map((r, idx) => (
                            <div key={idx} className="history-rating-item">
                              <span className="history-rated-player">{r.ratedPlayerName}</span>
                              <span className={`history-rating-score ${getRatingClass(r.score)}`}>
                                {r.score}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && <AdminLoginModal onClose={() => setShowLoginModal(false)} />}

      {/* Player Profile Modal */}
      <PlayerProfileModal 
        show={showPlayerProfile}
        playerId={selectedPlayerProfile}
        onClose={() => setShowPlayerProfile(false)}
        players={players}
        stats={stats}
        matches={matches}
        ratings={ratings}
        predictions={predictions}
        userLinks={userLinks}
        getPlayerPhoto={getPlayerPhoto}
        getPlayerName={getPlayerName}
        calculateXP={calculateXP}
        getRank={getRank}
      />

      {/* Player Add/Edit Modal */}
      {showPlayerModal && (
        <div className="modal-overlay" onClick={closePlayerModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingPlayerId ? 'Editar Jugador' : 'Nuevo Jugador'}</h2>
              <button className="modal-close" onClick={closePlayerModal}>×</button>
            </div>
            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                value={newPlayerName}
                onChange={e => setNewPlayerName(e.target.value)}
                placeholder="Nombre del jugador"
                autoFocus
              />
            </div>
            <div className="form-group">
              <label>Aliases (separados por coma)</label>
              <input
                type="text"
                value={newPlayerAliases}
                onChange={e => setNewPlayerAliases(e.target.value)}
                placeholder="Apodo1, Apodo2..."
              />
            </div>
            <button className="submit-btn" onClick={handleAddPlayer}>
              {editingPlayerId ? 'Guardar Cambios' : 'Crear Jugador'}
            </button>
          </div>
        </div>
      )}

      {/* Pending User Modal */}
      {user && !userPlayer && !isAdmin && userLinksLoaded && <PendingUserModal />}

      {/* Rating Modal */}
      {showRatingModal && selectedMatch && (
        <div className="modal-overlay" onClick={closeRatingModal}>
          <div className="modal rating-modal" onClick={e => e.stopPropagation()}>
            {ratingSuccess ? (
              <div className="success-state">
                <div className="success-icon">✓</div>
                <h2>Calificaciones guardadas</h2>
                <p>Tus calificaciones se han guardado correctamente</p>
                <button className="submit-btn" onClick={closeRatingModal}>
                  Aceptar
                </button>
              </div>
            ) : (
              <>
                <div className="modal-header">
                  <h2>{hasMyRatings(selectedMatch.id) ? 'Editar' : 'Calificar'} Jugadores</h2>
                  <button className="modal-close" onClick={closeRatingModal}>
                    ×
                  </button>
                </div>
                <p className="modal-subtitle">
                  {formatDate(selectedMatch.date)} - {selectedMatch.venue}
                </p>

                <div className="rating-list">
                  {getPlayersToRate(selectedMatch).map(playerId => (
                    <div key={playerId} className="rating-item">
                      <div className="rating-player">
                        <AvatarImage
                          src={getPlayerPhoto(playerId)}
                          name={getPlayerName(playerId)}
                          imgClassName="player-avatar-img"
                          fallbackClassName="player-avatar"
                        />
                        <span>{getPlayerName(playerId)}</span>
                      </div>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                          <button
                            key={score}
                            className={`star-btn ${currentRatings[playerId] >= score ? 'active' : ''}`}
                            onClick={() => handleRatingChange(playerId, score)}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button
                    className="submit-btn"
                    onClick={submitRatings}
                    disabled={Object.keys(currentRatings).length === 0}
                  >
                    {Object.keys(currentRatings).length < getPlayersToRate(selectedMatch).length
                      ? `Faltan ${getPlayersToRate(selectedMatch).length - Object.keys(currentRatings).length} jugadores`
                      : hasMyRatings(selectedMatch.id)
                        ? 'Actualizar'
                        : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Prediction Modal */}
      {showPredictionModal && predictionMatch && (() => {
        const probability = calculateTeamProbability(predictionMatch)
        const favorite = probability.white > probability.black ? 'white' : probability.black > probability.white ? 'black' : 'tie'
        
        return (
          <div className="modal-overlay" onClick={closePredictionModal}>
            <div className="modal prediction-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Predicción del Partido</h3>
                <button className="modal-close" onClick={closePredictionModal}>×</button>
              </div>
              
              <div className="prediction-match-info">
                <span className="prediction-date">
                  {new Date(predictionMatch.date + 'T12:00:00').toLocaleDateString('es-ES', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long'
                  })}
                </span>
                <span className="prediction-venue">{predictionMatch.venue}</span>
              </div>

              {/* AI Probability Bar */}
              <div className="probability-section">
                <div className="probability-header">
                  <span>📊 Probabilidad según estadísticas</span>
                </div>
                <div className="probability-bar-container">
                  <div className="probability-bar">
                    <div 
                      className="probability-fill white" 
                      style={{ width: `${probability.white}%` }}
                    >
                      {probability.white}%
                    </div>
                    <div 
                      className="probability-fill black" 
                      style={{ width: `${probability.black}%` }}
                    >
                      {probability.black}%
                    </div>
                  </div>
                </div>
                <div className="probability-labels">
                  <span>⬜ Blanco</span>
                  <span>⬛ Negro</span>
                </div>
              </div>

              {/* Team Stats Comparison */}
              <div className="stats-comparison">
                <div className="comparison-row">
                  <span className="stat-value white">{probability.whiteStats.avgWinRate.toFixed(0)}%</span>
                  <span className="stat-name">Win Rate</span>
                  <span className="stat-value black">{probability.blackStats.avgWinRate.toFixed(0)}%</span>
                </div>
                <div className="comparison-row">
                  <span className="stat-value white">{probability.whiteStats.avgRating.toFixed(1)}</span>
                  <span className="stat-name">Rating</span>
                  <span className="stat-value black">{probability.blackStats.avgRating.toFixed(1)}</span>
                </div>
                <div className="comparison-row">
                  <span className="stat-value white">{probability.whiteStats.recentForm.toFixed(0)}%</span>
                  <span className="stat-name">Forma Reciente</span>
                  <span className="stat-value black">{probability.blackStats.recentForm.toFixed(0)}%</span>
                </div>
              </div>

              {/* Favorite Badge */}
              {favorite !== 'tie' && (
                <div className={`favorite-badge ${favorite}`}>
                  🎯 Favorito: Equipo {favorite === 'white' ? 'Blanco' : 'Negro'} ({favorite === 'white' ? probability.white : probability.black}%)
                </div>
              )}

              <div className="prediction-divider">
                <span>¿Cuál es tu predicción?</span>
              </div>

              <div className="prediction-teams">
                <button 
                  className={`prediction-team white ${selectedPrediction === 'white' ? 'selected' : ''}`}
                  onClick={() => setSelectedPrediction('white')}
                >
                  <div className="team-header">
                    <div className="team-indicator">⬜</div>
                    <div className="team-probability">{probability.white}%</div>
                  </div>
                  <div className="team-label">Equipo Blanco</div>
                  <div className="team-players">
                    {predictionMatch.teamWhite?.map(pid => (
                      <span key={pid} className="team-player-name">{getPlayerName(pid)}</span>
                    ))}
                  </div>
                  {selectedPrediction === 'white' && <div className="selected-check">✓</div>}
                </button>

                <div className="prediction-vs">VS</div>

                <button 
                  className={`prediction-team black ${selectedPrediction === 'black' ? 'selected' : ''}`}
                  onClick={() => setSelectedPrediction('black')}
                >
                  <div className="team-header">
                    <div className="team-indicator">⬛</div>
                    <div className="team-probability">{probability.black}%</div>
                  </div>
                  <div className="team-label">Equipo Negro</div>
                  <div className="team-players">
                    {predictionMatch.teamBlack?.map(pid => (
                      <span key={pid} className="team-player-name">{getPlayerName(pid)}</span>
                    ))}
                  </div>
                  {selectedPrediction === 'black' && <div className="selected-check">✓</div>}
                </button>
              </div>

              {/* LukCoins Betting */}
              <div className="xp-bet-section">
                <div className="xp-bet-header">
                  <span className="xp-bet-title">Apostar LukCoins</span>
                  <span className="xp-bet-balance">Tus LukCoins: {userPlayer ? calculateLukCoins(userPlayer) : 0}</span>
                </div>
                <div className="xp-bet-options">
                  {[5, 10, 25, 50].map(amount => (
                    <button
                      key={amount}
                      className={`xp-bet-btn ${coinBet === amount ? 'selected' : ''}`}
                      onClick={() => setCoinBet(amount)}
                      disabled={userPlayer && calculateLukCoins(userPlayer) < amount}
                    >
                      {amount} LC
                    </button>
                  ))}
                </div>
                <div className="xp-bet-potential">
                  {selectedPrediction && (
                    <span>
                      Posible ganancia: <strong className="potential-win">
                        +{Math.round(coinBet * (100 / (selectedPrediction === 'white' ? probability.white : probability.black) - 1))} LC
                      </strong>
                    </span>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  className="submit-btn"
                  onClick={submitPrediction}
                  disabled={!selectedPrediction}
                >
                  {selectedPrediction 
                    ? `Apostar ${coinBet} LC al Equipo ${selectedPrediction === 'white' ? 'Blanco' : 'Negro'}` 
                    : 'Selecciona un equipo'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Bottom Navigation */}
      {/* Floating Action Button - Admin Only */}
      {isAdmin && (
        <FloatingActionButton
          menuItems={[
            { 
              label: 'Nuevo Partido', 
              icon: '⚽',
              onClick: () => setActiveTab('new')
            },
            { 
              label: 'Agregar Jugador', 
              icon: '👤',
              onClick: () => openAddEditPlayerModal()
            },
            { 
              label: 'Ver Dashboard', 
              icon: '📊',
              onClick: () => setActiveTab('dashboard')
            },
          ]}
          ariaLabel="Acciones rápidas"
        />
      )}

      <BottomNav
        showPlayerProfile={showPlayerProfile}
        selectedPlayerProfile={selectedPlayerProfile}
        onShowProfile={showProfile}
      />

      {/* Premium Toast Notification */}
      {toast && (
        <div className="toast-premium">
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default App
