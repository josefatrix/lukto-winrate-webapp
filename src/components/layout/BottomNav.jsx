/**
 * Bottom Navigation Component
 * SofaScore-inspired navigation bar with refined icons
 */

import { useRef } from 'react'
import { useApp } from '../../contexts'
import { PendingRatingsBadge } from '../common'

const RankingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M3 20h18" />
    <rect x="2" y="13" width="5" height="7" rx="1" />
    <rect x="9.5" y="7" width="5" height="13" rx="1" />
    <rect x="17" y="10" width="5" height="10" rx="1" />
  </svg>
)

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M12 2l2.68 6.26L22 9.27l-5.36 4.73 1.62 7L12 17.77 5.74 21l1.62-7L2 9.27l7.32-1.01L12 2z" />
  </svg>
)

const MatchesIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <circle cx="12" cy="12" r="10" />
    <polygon points="12,7 14.8,9.1 13.8,12.4 10.2,12.4 9.2,9.1" />
    <line x1="12" y1="7" x2="12" y2="2" />
    <line x1="14.8" y1="9.1" x2="19.5" y2="7.5" />
    <line x1="13.8" y1="12.4" x2="17.5" y2="16.5" />
    <line x1="10.2" y1="12.4" x2="6.5" y2="16.5" />
    <line x1="9.2" y1="9.1" x2="4.5" y2="7.5" />
  </svg>
)

const AnalyticsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M3 17l4-6 4 3 4-7 4 4" />
    <path d="M3 21h18" />
  </svg>
)

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const StoreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z" />
    <path d="M3 6h18" />
    <path d="M16 10a4 4 0 01-8 0" />
  </svg>
)

export const BottomNav = ({ showPlayerProfile, selectedPlayerProfile, onShowProfile }) => {
  const { activeTab, setActiveTab, userPlayer } = useApp()
  const navRef = useRef(null)
  const dragStartX = useRef(null)
  const dragStartIndex = useRef(null)
  const isDragging = useRef(false)
  const lastHapticIndex = useRef(-1)

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(5)
  }

  const handleTabClick = tab => {
    if (isDragging.current) return
    triggerHaptic()
    setActiveTab(tab)
  }

  const handleProfileClick = () => {
    if (isDragging.current) return
    triggerHaptic()
    if (onShowProfile && userPlayer) onShowProfile(userPlayer)
  }

  const tabs = [
    { id: 'stats', icon: <RankingIcon />, label: 'Ranking' },
    { id: 'ratings', icon: <StarIcon />, label: 'Rating' },
    { id: 'matches', icon: <MatchesIcon />, label: 'Partidos' },
    { id: 'analytics', icon: <AnalyticsIcon />, label: 'Análisis' },
    { id: 'store', icon: <StoreIcon />, label: 'Store' },
  ]

  const allItems = userPlayer ? [...tabs, { id: 'profile' }] : tabs
  const total = allItems.length

  const activeIndex = showPlayerProfile && selectedPlayerProfile === userPlayer
    ? allItems.length - 1
    : allItems.findIndex(t => t.id === activeTab)

  const getIndexFromX = (clientX) => {
    if (!navRef.current) return -1
    const rect = navRef.current.getBoundingClientRect()
    const relX = clientX - rect.left
    const idx = Math.floor((relX / rect.width) * total)
    return Math.max(0, Math.min(total - 1, idx))
  }

  const handleTouchStart = (e) => {
    dragStartX.current = e.touches[0].clientX
    dragStartIndex.current = activeIndex
    isDragging.current = false
    lastHapticIndex.current = activeIndex
    
    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect()
      const relX = e.touches[0].clientX - rect.left
      navRef.current.style.setProperty('--drag-x', `${relX}px`)
    }
  }

  const handleTouchMove = (e) => {
    if (dragStartX.current === null) return
    const clientX = e.touches[0].clientX
    const dx = Math.abs(clientX - dragStartX.current)
    
    if (dx > 6) {
      isDragging.current = true
      if (navRef.current) navRef.current.setAttribute('data-dragging', 'true')
    }
    
    if (!isDragging.current) return

    if (navRef.current) {
      const rect = navRef.current.getBoundingClientRect()
      // Constrain within the nav bounds
      const relX = Math.max(0, Math.min(rect.width, clientX - rect.left))
      navRef.current.style.setProperty('--drag-x', `${relX}px`)
    }

    const idx = getIndexFromX(clientX)
    if (idx !== lastHapticIndex.current) {
      triggerHaptic()
      lastHapticIndex.current = idx
      const item = allItems[idx]
      if (!item) return
      if (item.id === 'profile') {
        if (onShowProfile && userPlayer) onShowProfile(userPlayer)
      } else {
        setActiveTab(item.id)
      }
    }
  }

  const handleTouchEnd = () => {
    if (navRef.current) {
      navRef.current.removeAttribute('data-dragging')
      navRef.current.style.removeProperty('--drag-x')
    }
    setTimeout(() => { isDragging.current = false }, 50)
    dragStartX.current = null
  }

  return (
    <nav
      ref={navRef}
      className="bottom-nav"
      style={{ '--nav-total': total, '--nav-index': activeIndex >= 0 ? activeIndex : 0 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="nav-slider" />

      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id && !showPlayerProfile ? 'active' : ''}`}
          onClick={() => handleTabClick(tab.id)}
        >
          <span className="nav-icon-wrapper">
            {tab.icon}
            {tab.id === 'matches' && <PendingRatingsBadge />}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
      {userPlayer && (
        <button
          className={`bottom-nav-item ${showPlayerProfile && selectedPlayerProfile === userPlayer ? 'active' : ''}`}
          onClick={handleProfileClick}
        >
          <ProfileIcon />
          <span>Perfil</span>
        </button>
      )}
    </nav>
  )
}

export default BottomNav
