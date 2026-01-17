/**
 * Header Component
 * Premium header with user profile, quick actions, and login
 */

import { useApp } from '../../contexts'

// Icons
const NotificationIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="22"
    height="22"
  >
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="22"
    height="22"
  >
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="22"
    height="22"
  >
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
)

const UnlockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16,17 21,12 16,7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const UserIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    width="40"
    height="40"
    className="login-icon"
  >
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
)

export const Header = ({
  onShowLoginModal,
  onAdminLogout,
  onShowProfile,
  calculateXP,
  getRank,
  getRankIcon,
  notificationPermission,
  requestNotificationPermission,
}) => {
  const {
    user,
    userPlayer,
    isAdmin,
    darkMode,
    setDarkMode,
    handleGoogleLogin,
    handleLogout,
    getPlayerName,
  } = useApp()

  return (
    <header className="header-premium">
      {/* Hero Section with Logo */}
      <div className="hero-section">
        <div className="hero-background"></div>
        <div className="hero-content">
          <img src="/lukto-logo.png" alt="LUKTO" className="hero-logo" />
          <div className="hero-text">
            <h1 className="hero-title">LUKTO</h1>
            <p className="hero-subtitle">Win Rate Tracker</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="quick-actions">
          {typeof window !== 'undefined' && 'Notification' in window && (
            <button
              className={`action-btn ${notificationPermission === 'granted' ? 'active' : ''}`}
              onClick={requestNotificationPermission}
              aria-label="Notificaciones"
            >
              <NotificationIcon />
            </button>
          )}
          <button
            className="action-btn"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </div>

      {/* User Profile Card - Logged in */}
      {user && (
        <div className="profile-card">
          <div className="profile-card-left">
            <button
              className="profile-avatar-btn"
              onClick={() => {
                if (userPlayer && onShowProfile) {
                  onShowProfile(userPlayer)
                }
              }}
            >
              <img src={user.photoURL} alt="" />
              <div className="avatar-ring"></div>
            </button>
            <div className="profile-info">
              <h3 className="profile-name">{user.displayName}</h3>
              {userPlayer && (
                <div className="profile-player">
                  <span className="player-badge">{getPlayerName(userPlayer)}</span>
                  {(() => {
                    const xp = calculateXP(userPlayer)
                    const rank = getRank(xp)
                    if (rank.tier > 0) {
                      return (
                        <span className={`rank-badge rank-${rank.name?.toLowerCase()}`}>
                          {getRankIcon(rank.key, 12)}
                          {rank.name}
                        </span>
                      )
                    }
                    return null
                  })()}
                </div>
              )}
            </div>
          </div>
          <div className="profile-card-right">
            {isAdmin ? (
              <button className="mode-btn admin-active" onClick={onAdminLogout}>
                <UnlockIcon />
                Admin
              </button>
            ) : (
              <button className="mode-btn" onClick={onShowLoginModal}>
                <LockIcon />
                Admin
              </button>
            )}
            <button className="logout-btn" onClick={handleLogout}>
              <LogoutIcon />
            </button>
          </div>
        </div>
      )}

      {/* Login Card - Not logged in */}
      {!user && (
        <div className="login-card">
          <div className="login-card-content">
            <UserIcon />
            <p className="login-text">Inicia sesión para calificar jugadores y ver tu perfil</p>
          </div>
          <button className="google-signin-btn" onClick={handleGoogleLogin}>
            <GoogleIcon />
            Continuar con Google
          </button>
        </div>
      )}
    </header>
  )
}

export default Header

