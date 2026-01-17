/**
 * Bottom Navigation Component
 * SofaScore-style fixed bottom navigation
 */
import React from 'react'

// Navigation icons as SVG
const NavIcons = {
  stats: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6h-6z"/>
    </svg>
  ),
  matches: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" fill="none"/>
    </svg>
  ),
  ratings: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
    </svg>
  ),
  players: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
    </svg>
  )
}

/**
 * Navigation Tab Item
 */
const NavItem = ({ id, label, icon, isActive, onClick }) => (
  <button
    className={`nav-item ${isActive ? 'active' : ''}`}
    onClick={() => onClick(id)}
    aria-label={label}
  >
    <span className="nav-icon">{NavIcons[icon] || NavIcons.stats}</span>
    <span className="nav-label">{label}</span>
  </button>
)

/**
 * Bottom Navigation Bar
 */
export const Navigation = ({ 
  activeTab, 
  onTabChange, 
  isAdmin = false,
  tabs = [
    { id: 'stats', label: 'Ranking', icon: 'stats' },
    { id: 'matches', label: 'Partidos', icon: 'matches' },
    { id: 'ratings', label: 'Ratings', icon: 'ratings' },
    { id: 'players', label: 'Jugadores', icon: 'players' }
  ]
}) => {
  // Add admin tab if user is admin
  const allTabs = isAdmin 
    ? [...tabs, { id: 'admin', label: 'Admin', icon: 'admin' }]
    : tabs

  return (
    <nav className="bottom-nav">
      {allTabs.map(tab => (
        <NavItem
          key={tab.id}
          {...tab}
          isActive={activeTab === tab.id}
          onClick={onTabChange}
        />
      ))}
    </nav>
  )
}

export default Navigation

