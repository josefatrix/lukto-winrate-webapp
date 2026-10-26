/**
 * Header Component
 * Minimal, clean header - profile details moved to Profile tab
 */

import { useState, useRef, useEffect } from 'react'
import { useApp } from '../../contexts'

// Header Icons - SofaScore-inspired refined style
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
)

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
  </svg>
)

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M12 3l7 3.5v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10v-5L12 3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4-4" />
  </svg>
)

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
)

export const Header = ({
  onShowLoginModal,
  onAdminLogout,
  onOpenSearch = () => {},
  onShowProfile = () => {},
  lukCoins = 0,
  userXP = 0,
  lcBreakdown = null,
  xpBreakdown = null,
}) => {
  const {
    user,
    userPlayer,
    isAdmin,
    setIsAdmin,
    adminEmails,
    darkMode,
    setDarkMode,
    handleGoogleLogin,
    handleLogout,
    SUPER_ADMIN_EMAIL,
    getPlayerName,
  } = useApp()

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showLCPanel, setShowLCPanel] = useState(false)
  const [showXPPanel, setShowXPPanel] = useState(false)
  const menuRef = useRef(null)
  const lcPanelRef = useRef(null)
  const xpPanelRef = useRef(null)

  useEffect(() => {
    if (!showUserMenu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [showUserMenu])

  useEffect(() => {
    if (!showLCPanel && !showXPPanel) return
    const handler = (e) => {
      if (lcPanelRef.current && !lcPanelRef.current.contains(e.target)) setShowLCPanel(false)
      if (xpPanelRef.current && !xpPanelRef.current.contains(e.target)) setShowXPPanel(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [showLCPanel, showXPPanel])

  const handleAdminClick = () => {
    if (!user) {
      onShowLoginModal()
      return
    }

    const userEmail = user.email?.toLowerCase() || ''
    const isSuperAdmin = SUPER_ADMIN_EMAIL && userEmail === SUPER_ADMIN_EMAIL.toLowerCase()
    const isInAdminList = adminEmails?.some(email => email.toLowerCase() === userEmail)

    if (isSuperAdmin || isInAdminList) {
      setIsAdmin(true)
      try {
        localStorage.setItem('lukto_admin', 'true')
      } catch { /* Ignore */ }
    } else {
      onShowLoginModal()
    }
  }

  return (
    <header className="header-minimal">
      {/* Top Bar */}
      <div className="header-bar">
        <div className="header-brand">
          <img src="/lukto-logo.png" alt="" className="brand-logo" />
          <span className="brand-name">LUKTO</span>
        </div>
        
        <div className="header-actions">
          <button
            className="header-btn header-search-btn"
            onClick={onOpenSearch}
            aria-label="Buscar"
            title="Buscar (Ctrl/Cmd + K)"
          >
            <SearchIcon />
          </button>

          <button
            className="header-btn"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
          >
            {darkMode ? <SunIcon /> : <MoonIcon />}
          </button>
          
          {user ? (
            <>
              {isAdmin ? (
                <button className="header-btn admin-active" onClick={onAdminLogout} aria-label="Salir del panel de administración">
                  <ShieldIcon />
                </button>
              ) : (
                <button className="header-btn" onClick={handleAdminClick} aria-label="Abrir panel de administración">
                  <ShieldIcon />
                </button>
              )}
              <div className="header-avatar-wrap" ref={menuRef}>
                <button
                  className="header-avatar"
                  onClick={() => setShowUserMenu(m => !m)}
                  aria-label="Abrir menú de usuario"
                  aria-expanded={showUserMenu}
                >
                  <img src={user.photoURL} alt="" />
                </button>
                {showUserMenu && (
                  <div className="header-user-menu">
                    <div className="hum-user">
                      <img src={user.photoURL} alt="" />
                      <div>
                        <span>{user.displayName?.split(' ')[0] || 'Perfil'}</span>
                        {userPlayer && <small>{getPlayerName(userPlayer)}</small>}
                      </div>
                    </div>
                    {userPlayer && (
                      <button className="hum-item" onClick={() => { onShowProfile(userPlayer); setShowUserMenu(false) }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Ver perfil
                      </button>
                    )}
                    <button className="hum-item logout" onClick={() => { handleLogout(); setShowUserMenu(false) }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button className="header-login" onClick={handleGoogleLogin}>
              <GoogleIcon />
              <span>Entrar</span>
            </button>
          )}
        </div>
      </div>

      {/* Welcome Line (only if logged in) */}
      {user && (
        <div className="header-welcome">
          <span className="welcome-text">
            Hola, <strong>{user.displayName?.split(' ')[0]}</strong>
            {userPlayer && <span className="welcome-player"> • {getPlayerName(userPlayer)}</span>}
          </span>
          <div className="header-meta">
            {/* XP pill */}
            <div className="header-pill-wrap" ref={xpPanelRef}>
              <button
                className="header-xp-pill"
                onClick={() => { setShowXPPanel(p => !p); setShowLCPanel(false) }}
                title="Ver desglose de XP"
              >
                {userXP} XP
              </button>
              {showXPPanel && xpBreakdown && (
                <div className="header-breakdown-panel xp-panel">
                  <div className="hbp-title">Experiencia (XP)</div>
                  <div className="hbp-rows">
                    <div className="hbp-row">
                      <span className="hbp-label">Participar</span>
                      <span className="hbp-detail">{xpBreakdown.played} × 10</span>
                      <span className="hbp-val">+{xpBreakdown.participationXP}</span>
                    </div>
                    <div className="hbp-row">
                      <span className="hbp-label">Victorias</span>
                      <span className="hbp-detail">{xpBreakdown.wins} × 25</span>
                      <span className="hbp-val">+{xpBreakdown.winXP}</span>
                    </div>
                    <div className="hbp-row">
                      <span className="hbp-label">MVPs</span>
                      <span className="hbp-detail">{xpBreakdown.mvps} × 50</span>
                      <span className="hbp-val">+{xpBreakdown.mvpXP}</span>
                    </div>
                    {xpBreakdown.ratingXP > 0 && (
                      <div className="hbp-row">
                      <span className="hbp-label">Calificación</span>
                      <span className="hbp-detail">prom. × 5</span>
                        <span className="hbp-val">+{xpBreakdown.ratingXP}</span>
                      </div>
                    )}
                    {xpBreakdown.boostXP > 0 && (
                      <div className="hbp-row">
                      <span className="hbp-label">Bono XP</span>
                        <span className="hbp-detail">×{((xpBreakdown.boostXP / (xpBreakdown.total - xpBreakdown.boostXP)) + 1).toFixed(1)}</span>
                        <span className="hbp-val">+{xpBreakdown.boostXP}</span>
                      </div>
                    )}
                  </div>
                  <div className="hbp-total">
                    <span>Total</span>
                    <span className="hbp-total-val xp">{xpBreakdown.total} XP</span>
                  </div>
                </div>
              )}
            </div>

            {/* LC pill */}
            <div className="header-pill-wrap" ref={lcPanelRef}>
              <button
                className="lukcoins-pill"
                onClick={() => { setShowLCPanel(p => !p); setShowXPPanel(false) }}
                title="Ver desglose de LukCoins"
              >
                LC {lukCoins}
              </button>
              {showLCPanel && lcBreakdown && (
                <div className="header-breakdown-panel lc-panel">
                  <div className="hbp-title">LukCoins</div>
                  <div className="hbp-rows">
                    <div className="hbp-row">
                      <span className="hbp-label">Participar</span>
                      <span className="hbp-detail">{lcBreakdown.played} × 5</span>
                      <span className="hbp-val lc">+{lcBreakdown.playedLC}</span>
                    </div>
                    <div className="hbp-row">
                      <span className="hbp-label">Victorias</span>
                      <span className="hbp-detail">{lcBreakdown.wins} × 8</span>
                      <span className="hbp-val lc">+{lcBreakdown.winLC}</span>
                    </div>
                    <div className="hbp-row">
                      <span className="hbp-label">MVPs</span>
                      <span className="hbp-detail">{lcBreakdown.mvps} × 12</span>
                      <span className="hbp-val lc">+{lcBreakdown.mvpLC}</span>
                    </div>
                    {lcBreakdown.ratedCount > 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">Calificar</span>
                        <span className="hbp-detail">{lcBreakdown.ratedCount} × 4</span>
                        <span className="hbp-val lc">+{lcBreakdown.ratedLC}</span>
                      </div>
                    )}
                    {lcBreakdown.predWon > 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">Predicciones</span>
                        <span className="hbp-detail">ganadas</span>
                        <span className="hbp-val lc">+{lcBreakdown.predWon}</span>
                      </div>
                    )}
                    {lcBreakdown.predLost > 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">Predicciones</span>
                        <span className="hbp-detail">perdidas</span>
                        <span className="hbp-val neg">-{lcBreakdown.predLost}</span>
                      </div>
                    )}
                    {lcBreakdown.predPending > 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">En espera</span>
                        <span className="hbp-detail">apostado</span>
                        <span className="hbp-val neg">-{lcBreakdown.predPending}</span>
                      </div>
                    )}
                    {lcBreakdown.spent > 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">Gastado</span>
                        <span className="hbp-detail">tienda</span>
                        <span className="hbp-val neg">-{lcBreakdown.spent}</span>
                      </div>
                    )}
                    {lcBreakdown.adjustment !== 0 && (
                      <div className="hbp-row">
                        <span className="hbp-label">Ajuste admin</span>
                        <span className="hbp-detail">manual</span>
                        <span className={`hbp-val ${lcBreakdown.adjustment > 0 ? 'lc' : 'neg'}`}>{lcBreakdown.adjustment > 0 ? '+' : ''}{lcBreakdown.adjustment}</span>
                      </div>
                    )}
                  </div>
                  <div className="hbp-total">
                    <span>Disponible</span>
                    <span className="hbp-total-val lc">{lukCoins} LC</span>
                  </div>
                </div>
              )}
            </div>

            {isAdmin && <span className="admin-badge">Admin</span>}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
