/**
 * LUKTO Stats - Main App Component
 * Refactored version using context and modular components
 */
import { useState } from 'react'
import { useApp, SUPER_ADMIN_EMAIL } from './contexts'
import { useStats } from './hooks'
import { doc, setDoc, collection, writeBatch, updateDoc, getDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from './firebase'
import confetti from 'canvas-confetti'

// Import components
import { Header, BottomNav } from './components/layout'
import { StatsTab, MatchesTab, RatingsTab } from './components/tabs'
import { AdminLoginModal, PendingUserModal } from './components/modals'

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

// ============ PENDING USER CARD ============

function PendingUserCard({ pending, players, linkingUser, onLink }) {
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
    getInitials,
    logActivity,
    confettiTriggered,
    handleLogout,
  } = useApp()

  // Stats hook
  const { stats, filteredStats, getPlayerOfMonth, getPlayerOfWeek } = useStats()

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

  // Notifications
  const [notificationPermission, setNotificationPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission
    }
    return 'denied'
  })

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
    return xp
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
    if (!matchDate || teamWhite.length === 0 || teamBlack.length === 0 || !winner) {
      showToast('error', 'Completa todos los campos')
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
    } catch (error) {
      console.error('Error unlinking user:', error)
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

  // ============ RENDER ============

  return (
    <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <Header
        onShowLoginModal={() => setShowLoginModal(true)}
        onAdminLogout={handleAdminLogout}
        onShowProfile={showProfile}
        calculateXP={calculateXP}
        getRank={getRank}
        getRankIcon={getRankIcon}
        notificationPermission={notificationPermission}
        requestNotificationPermission={requestNotificationPermission}
      />

      {/* Time Filter Pills */}
      {(activeTab === 'stats' || activeTab === 'ratings') && (
        <div className="filter-pills">
          <button
            className={`pill ${timeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTimeFilter('all')}
          >
            Todo
          </button>
          <button
            className={`pill ${timeFilter === 'month' ? 'active' : ''}`}
            onClick={() => setTimeFilter('month')}
          >
            Mes
          </button>
          <button
            className={`pill ${timeFilter === 'week' ? 'active' : ''}`}
            onClick={() => setTimeFilter('week')}
          >
            Semana
          </button>
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

      {/* Loading State */}
      {activeTab === 'stats' && !dataLoaded && (
        <section className="stats-section">
          <h2 className="section-title">Ranking de Jugadores</h2>
          <div className="skeleton-container">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-avatar"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-bar"></div>
              </div>
            ))}
          </div>
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
          onOpenPrediction={() => {}}
          triggerMVPConfetti={triggerMVPConfetti}
        />
      )}

      {/* Analytics Tab - Simplified placeholder */}
      {activeTab === 'analytics' && (
        <section className="stats-section analytics-section">
          <h2 className="section-title">Análisis Avanzado</h2>
          <div className="analytics-player-select">
            <label>Selecciona un jugador para ver su análisis:</label>
            <select
              value={h2hPlayer1 || ''}
              onChange={e => setH2hPlayer1(e.target.value)}
              className="player-select-dropdown"
            >
              <option value="">Seleccionar jugador...</option>
              {stats.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
          {!h2hPlayer1 && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <h3>Selecciona un jugador</h3>
              <p>Elige un jugador para ver su análisis detallado</p>
            </div>
          )}
        </section>
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
                      <button className="unlink-btn" onClick={() => adminUnlinkUser(odedBy)}>
                        ✕
                      </button>
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
              <label style={{ textAlign: 'center', display: 'block', marginBottom: '1rem' }}>
                ¿Quién Ganó?
              </label>
              <div className="winner-section">
                <button
                  className={`winner-btn ${winner === 'white' ? 'selected' : ''}`}
                  onClick={() => setWinner('white')}
                >
                  <span className="team-badge white"></span>
                  EQUIPO BLANCO
                </button>
                <button
                  className={`winner-btn ${winner === 'black' ? 'selected' : ''}`}
                  onClick={() => setWinner('black')}
                >
                  <span className="team-badge black"></span>
                  EQUIPO NEGRO
                </button>
              </div>
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
                disabled={!matchDate || teamWhite.length === 0 || teamBlack.length === 0 || !winner}
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
                {getPlayerPhoto(player.id) ? (
                  <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                ) : (
                  <div className="player-avatar">{getInitials(player.name)}</div>
                )}
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
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{Object.keys(userLinks).length}</span>
                <span className="dashboard-card-label">Usuarios Registrados</span>
              </div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{matches.length}</span>
                <span className="dashboard-card-label">Partidos Totales</span>
              </div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">
                  {Object.values(ratings).reduce((sum, r) => sum + r.length, 0)}
                </span>
                <span className="dashboard-card-label">Calificaciones Totales</span>
              </div>
            </div>
            <div className="dashboard-card">
              <div className="dashboard-card-content">
                <span className="dashboard-card-value">{pendingUsers.length}</span>
                <span className="dashboard-card-label">Usuarios Pendientes</span>
              </div>
            </div>
          </div>

          {/* Activity Logs */}
          <h3 className="subsection-title">Actividad Reciente</h3>
          <div className="activity-logs">
            {activityLogs.length > 0 ? (
              activityLogs.slice(0, 10).map(log => (
                <div key={log.id} className="activity-log-item">
                  <span className="log-type">{log.type}</span>
                  <span className="log-user">{log.userName || log.userEmail}</span>
                  <span className="log-time">
                    {new Date(log.timestamp).toLocaleString('es-ES')}
                  </span>
                </div>
              ))
            ) : (
              <p className="no-data-text">Sin actividad registrada</p>
            )}
          </div>
        </section>
      )}

      {/* Admin: Tools Tab */}
      {activeTab === 'tools' && isAdmin && (
        <section className="stats-section tools-section">
          <h2 className="section-title">Herramientas de Admin</h2>

          {/* Gestionar Admins */}
          <div className="tool-card">
            <h3 className="tool-title">Gestionar Administradores</h3>
            <p className="tool-desc">Super Admin: {SUPER_ADMIN_EMAIL}</p>
            <div className="admin-list">
              {adminEmails.map(email => (
                <div key={email} className="admin-item">
                  <span>{email}</span>
                  <button 
                    className="remove-btn"
                    onClick={() => handleRemoveAdmin(email)}
                  >
                    ×
                  </button>
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
              <button onClick={handleAddAdmin} className="add-btn">
                Agregar Admin
              </button>
            </div>
          </div>

          {/* Bloquear Usuarios */}
          <div className="tool-card">
            <h3 className="tool-title">Usuarios Bloqueados</h3>
            <p className="tool-desc">Estos usuarios no pueden calificar</p>
            <div className="blocked-list">
              {blockedUsers.length > 0 ? (
                blockedUsers.map(userId => {
                  const userLink = Object.values(userLinks).find(l => l.odedBy === userId)
                  return (
                    <div key={userId} className="blocked-item">
                      <span>{userLink?.userName || userLink?.userEmail || userId}</span>
                      <button 
                        className="unblock-btn"
                        onClick={async () => {
                          const newList = blockedUsers.filter(id => id !== userId)
                          await setDoc(doc(db, 'settings', 'blockedUsers'), { list: newList })
                        }}
                      >
                        Desbloquear
                      </button>
                    </div>
                  )
                })
              ) : (
                <p className="no-data-text">Sin usuarios bloqueados</p>
              )}
            </div>
          </div>

          {/* Exportar Datos */}
          <div className="tool-card">
            <h3 className="tool-title">Exportar Datos</h3>
            <button 
              className="export-btn"
              onClick={() => {
                const data = {
                  players: players,
                  matches: matches,
                  ratings: ratings,
                  exportedAt: new Date().toISOString()
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `lukto-backup-${new Date().toISOString().split('T')[0]}.json`
                a.click()
                showToast('success', 'Datos exportados')
              }}
            >
              Descargar Backup (JSON)
            </button>
          </div>
        </section>
      )}

      {/* Admin: All Ratings Tab */}
      {activeTab === 'allRatings' && isAdmin && (
        <section className="stats-section">
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
                    raterEmail: raterLink?.userEmail || 'Desconocido'
                  })
                })
              })

              if (matchRatings.length === 0) return null

              return (
                <div key={match.id} className="match-ratings-card">
                  <h4 className="match-ratings-header">
                    {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', {
                      weekday: 'long', day: 'numeric', month: 'long'
                    })}
                  </h4>
                  <div className="ratings-table-wrapper">
                    <table className="ratings-detail-table">
                      <thead>
                        <tr>
                          <th>Calificador</th>
                          <th>Email</th>
                          <th>Calificado</th>
                          <th>Nota</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchRatings.map((r, idx) => (
                          <tr key={idx}>
                            <td>{r.raterName}</td>
                            <td className="email-cell">{r.raterEmail}</td>
                            <td>{r.ratedPlayerName}</td>
                            <td>
                              <span className={`rating-value ${getRatingClass(r.score)}`}>
                                {r.score}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
      {showPlayerProfile && selectedPlayerProfile && (
        <div className="modal-overlay" onClick={() => setShowPlayerProfile(false)}>
          <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Perfil de Jugador</h2>
              <button className="modal-close" onClick={() => setShowPlayerProfile(false)}>×</button>
            </div>
            {(() => {
              const player = players.find(p => p.id === selectedPlayerProfile)
              if (!player) return <p>Jugador no encontrado</p>
              
              const playerStats = (timeFilter === 'all' ? stats : filteredStats).find(s => s.id === selectedPlayerProfile)
              const xp = calculateXP(selectedPlayerProfile)
              const rank = getRank(xp)
              const playerRatingsList = ratings[selectedPlayerProfile] || []
              
              // Calculate streaks
              let currentStreak = 0
              let streakType = null
              const sortedMatches = [...matches].sort((a, b) => new Date(b.date) - new Date(a.date))
              for (const match of sortedMatches) {
                const inWhite = match.teamWhite.includes(selectedPlayerProfile)
                const inBlack = match.teamBlack.includes(selectedPlayerProfile)
                if (!inWhite && !inBlack) continue
                const won = (inWhite && match.winner === 'white') || (inBlack && match.winner === 'black')
                if (streakType === null) {
                  streakType = won ? 'win' : 'loss'
                  currentStreak = 1
                } else if ((won && streakType === 'win') || (!won && streakType === 'loss')) {
                  currentStreak++
                } else {
                  break
                }
              }

              return (
                <div className="profile-content">
                  <div className="profile-header-section">
                    {getPlayerPhoto(selectedPlayerProfile) ? (
                      <img src={getPlayerPhoto(selectedPlayerProfile)} alt="" className="profile-avatar-large" />
                    ) : (
                      <div className="profile-avatar-large">{getInitials(player.name)}</div>
                    )}
                    <div className="profile-name-section">
                      <h3>{player.name}</h3>
                      {player.aliases?.length > 0 && (
                        <p className="profile-aliases">aka: {player.aliases.join(', ')}</p>
                      )}
                      <div className="profile-rank-badge" style={{ color: rank.color }}>
                        {getRankIcon(rank.key, 20)} {rank.name}
                      </div>
                    </div>
                  </div>

                  <div className="profile-stats-grid">
                    <div className="profile-stat">
                      <span className="profile-stat-value">{playerStats?.played || 0}</span>
                      <span className="profile-stat-label">Partidos</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{playerStats?.wins || 0}</span>
                      <span className="profile-stat-label">Victorias</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{playerStats?.winRate?.toFixed(0) || 0}%</span>
                      <span className="profile-stat-label">Win Rate</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{playerStats?.avgRating || '-'}</span>
                      <span className="profile-stat-label">Rating</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{playerStats?.mvps || 0}</span>
                      <span className="profile-stat-label">MVPs</span>
                    </div>
                    <div className="profile-stat">
                      <span className="profile-stat-value">{xp}</span>
                      <span className="profile-stat-label">XP</span>
                    </div>
                  </div>

                  {currentStreak > 0 && (
                    <div className={`profile-streak ${streakType}`}>
                      {streakType === 'win' ? '🔥' : '❄️'} Racha actual: {currentStreak} {streakType === 'win' ? 'victorias' : 'derrotas'}
                    </div>
                  )}

                  <div className="profile-recent-ratings">
                    <h4>Últimas Calificaciones Recibidas</h4>
                    {playerRatingsList.slice(-5).reverse().map((r, idx) => {
                      const match = matches.find(m => m.id === r.matchId)
                      return (
                        <div key={idx} className="profile-rating-item">
                          <span className="profile-rating-date">
                            {match ? new Date(match.date).toLocaleDateString('es-ES') : 'N/A'}
                          </span>
                          <span className={`rating-value ${getRatingClass(r.score)}`}>{r.score}</span>
                        </div>
                      )
                    })}
                    {playerRatingsList.length === 0 && <p className="no-data-text">Sin calificaciones</p>}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

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
                        {getPlayerPhoto(playerId) ? (
                          <img
                            src={getPlayerPhoto(playerId)}
                            alt=""
                            className="player-avatar-img small"
                          />
                        ) : (
                          <div className="player-avatar small">
                            {getInitials(getPlayerName(playerId))}
                          </div>
                        )}
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

      {/* Bottom Navigation */}
      <BottomNav
        showPlayerProfile={showPlayerProfile}
        selectedPlayerProfile={selectedPlayerProfile}
        onShowProfile={showProfile}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>{toast.message}</div>
      )}
    </div>
  )
}

export default App
