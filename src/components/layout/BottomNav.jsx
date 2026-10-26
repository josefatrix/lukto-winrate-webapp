/**
 * Bottom Navigation Component
 * SofaScore-inspired navigation bar with refined icons
 */

import { useRef } from 'react'
import { useApp } from '../../contexts'

const RankingIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
    <path d="M3 20h18" />
    <rect x="2" y="13" width="5" height="7" rx="1" />
    <rect x="9.5" y="7" width="5" height="13" rx="1" />
    <rect x="17" y="10" width="5" height="10" rx="1" />
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

const TABS = [
  { id: 'stats', icon: <RankingIcon />, label: 'Ranking' },
  { id: 'matches', icon: <MatchesIcon />, label: 'Partidos' },
  { id: 'analytics', icon: <AnalyticsIcon />, label: 'Análisis' },
  { id: 'profile', icon: <ProfileIcon />, label: 'Perfil' },
]

export const BottomNav = () => {
  const { activeTab, setActiveTab } = useApp()
  const navRef = useRef(null)
  const dragStartX = useRef(null)
  const isDragging = useRef(false)
  const lastHapticIndex = useRef(-1)

  const total = TABS.length
  const activeIndex = TABS.findIndex(t => t.id === activeTab)

  const triggerHaptic = () => {
    if (navigator.vibrate) navigator.vibrate(5)
  }

  const handleTabClick = tab => {
    if (isDragging.current) return
    triggerHaptic()
    setActiveTab(tab)
  }

  const getIndexFromX = (clientX) => {
    if (!navRef.current) return -1
    const rect = navRef.current.getBoundingClientRect()
    const relX = clientX - rect.left
    const idx = Math.floor((relX / rect.width) * total)
    return Math.max(0, Math.min(total - 1, idx))
  }

  const handleTouchStart = (e) => {
    dragStartX.current = e.touches[0].clientX
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
      const item = TABS[idx]
      if (item) setActiveTab(item.id)
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
      data-has-active={activeIndex >= 0 ? 'true' : 'false'}
      style={{ '--nav-total': total, '--nav-index': activeIndex >= 0 ? activeIndex : 0 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="nav-slider" />

      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`bottom-nav-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => handleTabClick(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <span className="nav-icon-wrapper">
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
