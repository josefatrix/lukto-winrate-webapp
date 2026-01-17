/**
 * Bottom Navigation Component
 * SofaScore-like navigation bar
 */
import React from 'react'
import { useApp } from '../../contexts'

const RankingIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4-4h2v18h-2V3zm4 8h2v10h-2V11zm4-4h2v14h-2V7z" />
  </svg>
)

const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
)

const MatchesIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
)

const AnalyticsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z" />
  </svg>
)

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
)

export const BottomNav = ({ showPlayerProfile, selectedPlayerProfile, onShowProfile }) => {
  const { activeTab, setActiveTab, userPlayer } = useApp()

  const handleTabClick = tab => {
    if (onShowProfile) {
      // Close profile modal when switching tabs
    }
    setActiveTab(tab)
  }

  return (
    <nav className="bottom-nav">
      <button
        className={`bottom-nav-item ${activeTab === 'stats' && !showPlayerProfile ? 'active' : ''}`}
        onClick={() => handleTabClick('stats')}
      >
        <RankingIcon />
        <span>Ranking</span>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'ratings' && !showPlayerProfile ? 'active' : ''}`}
        onClick={() => handleTabClick('ratings')}
      >
        <StarIcon />
        <span>Rating</span>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'matches' && !showPlayerProfile ? 'active' : ''}`}
        onClick={() => handleTabClick('matches')}
      >
        <MatchesIcon />
        <span>Partidos</span>
      </button>
      <button
        className={`bottom-nav-item ${activeTab === 'analytics' && !showPlayerProfile ? 'active' : ''}`}
        onClick={() => handleTabClick('analytics')}
      >
        <AnalyticsIcon />
        <span>Análisis</span>
      </button>
      {userPlayer && (
        <button
          className={`bottom-nav-item ${showPlayerProfile && selectedPlayerProfile === userPlayer ? 'active' : ''}`}
          onClick={() => onShowProfile && onShowProfile(userPlayer)}
        >
          <ProfileIcon />
          <span>Perfil</span>
        </button>
      )}
    </nav>
  )
}

export default BottomNav

