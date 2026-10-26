/**
 * Application Configuration
 * Central place for all app-wide settings
 */

// Admin Configuration
// Admin access is controlled via Google Auth + authorized email list
export const SUPER_ADMIN_EMAIL = 'joseescorcia01@gmail.com'

// App Settings
export const APP_NAME = 'LUKTO'
export const APP_VERSION = '1.0.0'

// Rating Configuration
export const MIN_RATING = 1
export const MAX_RATING = 10
export const LOW_RATING_THRESHOLD = 3 // Show warning below this

// Ranking Weights
export const RANKING_WEIGHTS = {
  rating: 0.45,      // 45% - Individual performance
  mvpRate: 0.25,     // 25% - MVP achievements
  winRate: 0.20,     // 20% - Team results
  participation: 0.10 // 10% - Activity
}

// XP System
export const XP_VALUES = {
  gamePlay: 10,      // XP per game played
  gameWin: 15,       // Additional XP for winning
  mvp: 25,           // XP for being MVP
  ratingGiven: 2,    // XP for rating others
  ratingReceived: 1  // XP for receiving ratings
}

// Rank Thresholds (XP required)
export const RANK_THRESHOLDS = {
  bronce: 0,
  plata: 50,
  oro: 150,
  platino: 300,
  diamante: 500,
  maestro: 750,
  leyenda: 1000
}

// Time Filter Options
export const TIME_FILTERS = {
  all: 'Todo',
  month: 'Mes',
  week: 'Semana'
}

// Navigation Tabs
export const NAV_TABS = {
  stats: { id: 'stats', label: 'Ranking', icon: 'stats' },
  matches: { id: 'matches', label: 'Partidos', icon: 'matches' },
  ratings: { id: 'ratings', label: 'Ratings', icon: 'ratings' },
  players: { id: 'players', label: 'Jugadores', icon: 'players' },
  admin: { id: 'admin', label: 'Admin', icon: 'admin', adminOnly: true }
}

// Default League Settings
export const DEFAULT_LEAGUE_SETTINGS = {
  name: 'LUKTO',
  mvpMinVotes: 1,
  mvpMethod: 'average' // 'average' or 'total'
}
