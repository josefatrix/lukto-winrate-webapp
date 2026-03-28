/**
 * LUKTO Stats - Main App Component
 * Premium version with Apple-style interactions
 */
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useApp, SUPER_ADMIN_EMAIL } from './contexts'
import { useStats, useHaptic, useMatchBuilder } from './hooks'
import { doc, setDoc, collection, writeBatch, updateDoc, getDoc, query, where, getDocs, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'
import confetti from 'canvas-confetti'
import LiquidGlass from 'liquid-glass-react'

// Import components
import { Header, BottomNav } from './components/layout'
import { StatsTab, MatchesTab, MatchBuilderTab, RatingsTab, StoreTab } from './components/tabs'
import { getPositionGroup } from './utils/matchConstants'
import {
  formatDate,
  getPredictionBet,
  getPredictionWin,
  getRank,
  getRankIcon,
  getRatingClass,
  getWinRateClass,
} from './utils/ranks'
import { AdminLoginModal, PendingUserModal } from './components/modals'
import { AvatarImage, AvatarFigure, AvatarFigure3D, AppIcon, FloatingActionButton, SkeletonPage, SkeletonTable, SkeletonMatchesList, Onboarding, useOnboarding, EmptyState, AnimatedCounter, PendingRatingsNotification, createAvatarState, PlayerProfileModal } from './components/common'

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
              <AppIcon name="check" size={14} />
            </button>
            <button 
              className="delete-user-btn" 
              onClick={() => onDelete(pending.odedBy, pending.userName || pending.userEmail)}
              title="Eliminar cuenta"
            >
              <AppIcon name="trash" size={14} />
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
    ratingRestrictions,
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
  const { stats, filteredStats, getPlayerOfMonth, getMonthlyWinners, getPlayerOfWeek, getWeeklyWinners } = useStats()

  // Onboarding hook
  const { showOnboarding, completeOnboarding } = useOnboarding()

  // Match builder hook
  const matchBuilder = useMatchBuilder({ showToast, logActivity })

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
  const [adminExportStart, setAdminExportStart] = useState('')
  const [adminExportEnd, setAdminExportEnd] = useState('')
  const [moderationUserId, setModerationUserId] = useState('')
  const [lcAdjustUserId, setLcAdjustUserId] = useState('')
  const [lcAdjustAmount, setLcAdjustAmount] = useState('')
  const [lcAdjustReason, setLcAdjustReason] = useState('')
  const [ratingBlockUserId, setRatingBlockUserId] = useState('')
  const [ratingBlockMatchId, setRatingBlockMatchId] = useState('')
  const [expandedLcUserId, setExpandedLcUserId] = useState(null)
  const [allRatingsSearch, setAllRatingsSearch] = useState('')
  const [showGlobalSearch, setShowGlobalSearch] = useState(false)
  const [globalSearchQuery, setGlobalSearchQuery] = useState('')
  const globalSearchInputRef = useRef(null)
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    tone: 'danger',
    resolve: null,
  })

  // Analytics state
  const [h2hPlayer1, setH2hPlayer1] = useState(null)
  const [h2hPlayer2, setH2hPlayer2] = useState(null)
  const [analyticsView, setAnalyticsView] = useState(() => {
    try {
      const saved = localStorage.getItem('lukto_analytics_view')
      return ['teams', 'roles', 'records', 'progress', 'compare'].includes(saved) ? saved : 'teams'
    } catch {
      return 'teams'
    }
  })
  const [progressRoleFilter, setProgressRoleFilter] = useState('all')

  // Prediction state
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [predictionMatch, setPredictionMatch] = useState(null)
  const [selectedPrediction, setSelectedPrediction] = useState(null)
  const [coinBet, setCoinBet] = useState(10) // LukCoins to bet on prediction
  const [predictedMvpId, setPredictedMvpId] = useState('')
  const [predictedScoreWhite, setPredictedScoreWhite] = useState('')
  const [predictedScoreBlack, setPredictedScoreBlack] = useState('')
  const [showMatchXpModal, setShowMatchXpModal] = useState(false)
  const [matchXpData, setMatchXpData] = useState(null)

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

  useEffect(() => {
    if (!showGlobalSearch) return
    const id = setTimeout(() => {
      globalSearchInputRef.current?.focus()
    }, 10)
    return () => clearTimeout(id)
  }, [showGlobalSearch])

  useEffect(() => {
    try {
      localStorage.setItem('lukto_analytics_view', analyticsView)
    } catch {
      /* Ignore */
    }
  }, [analyticsView])

  useEffect(() => {
    if (!isAdmin && ['dashboard', 'new', 'players', 'users', 'tools', 'allRatings'].includes(activeTab)) {
      setActiveTab('stats')
    }
  }, [isAdmin, activeTab, setActiveTab])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isCmdK) {
        event.preventDefault()
        setShowGlobalSearch(true)
      }
      if (event.key === 'Escape') {
        setShowGlobalSearch(false)
        setGlobalSearchQuery('')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const askConfirmation = useCallback(({
    title = 'Confirmar acción',
    message = '¿Deseas continuar?',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    tone = 'danger',
  } = {}) => {
    return new Promise(resolve => {
      setConfirmDialog({
        open: true,
        title,
        message,
        confirmText,
        cancelText,
        tone,
        resolve,
      })
    })
  }, [])

  const resolveConfirmation = useCallback((accepted) => {
    setConfirmDialog(current => {
      if (typeof current.resolve === 'function') {
        current.resolve(accepted)
      }
      return {
        open: false,
        title: '',
        message: '',
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
        tone: 'danger',
        resolve: null,
      }
    })
  }, [])

  // ============ CONSTANTS ============

  const LOG_TYPE_LABELS = {
    match_create: 'Partido creado',
    match_update: 'Partido editado',
    match_delete: 'Partido eliminado',
    match_reopen: 'Ganador eliminado',
    match_toggle_ratings: 'Calificaciones toggled',
    rating_submit: 'Calificaciones enviadas',
    rating_delete: 'Calificaciones eliminadas',
    rating_delete_bulk: 'Calificaciones borradas (bulk)',
    prediction_submit: 'Predicción enviada',
    prediction_delete: 'Predicciones eliminadas',
    player_create: 'Jugador creado',
    player_update: 'Jugador editado',
    player_delete: 'Jugador eliminado',
    user_link: 'Usuario vinculado',
    user_unlink: 'Usuario desvinculado',
    user_delete: 'Usuario eliminado',
    admin_add: 'Admin agregado',
    admin_remove: 'Admin eliminado',
    lukcoins_adjust: 'LC ajustados',
    lukcoins_reset: 'LC ajuste reiniciado',
    rating_block: 'Calificación bloqueada',
    rating_unblock: 'Calificación desbloqueada',
    announcement_create: 'Anuncio publicado',
    announcement_delete: 'Anuncio eliminado',
    export: 'Exportación de datos',
  }

  // ============ CALCULATED VALUES ============

  const displayStats = timeFilter === 'all' ? stats : filteredStats
  const statsById = useMemo(
    () => Object.fromEntries((stats || []).map(playerStats => [playerStats.id, playerStats])),
    [stats]
  )

  const positionAnalytics = useMemo(() => {
    const byPlayer = {}
    const byPosition = {}

    const getMatchMvpId = (match) => {
      const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      let mvpId = null
      let mvpRating = -1
      allPlayers.forEach(pid => {
        const pRatings = (ratings?.[pid] || []).filter(r => r.matchId === match.id)
        if (pRatings.length > 0) {
          const avg = pRatings.reduce((s, r) => s + r.score, 0) / pRatings.length
          if (avg > mvpRating) {
            mvpRating = avg
            mvpId = pid
          }
        }
      })
      return mvpId
    }

    matches.forEach(match => {
      const positions = match.positions || {}
      const mvpId = getMatchMvpId(match)
      const decided = match.winner === 'white' || match.winner === 'black'
      const tied = match.winner === 'tie'

      const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      allPlayers.forEach(playerId => {
        const pos = positions[playerId] || ''
        const group = getPositionGroup(pos)

        if (!byPlayer[playerId]) {
          byPlayer[playerId] = {}
        }
        if (!byPlayer[playerId][group]) {
          byPlayer[playerId][group] = {
            played: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            mvps: 0,
            ratingSum: 0,
            ratingCount: 0,
          }
        }

        const entry = byPlayer[playerId][group]
        entry.played += 1
        if (decided) {
          const inWhite = match.teamWhite?.includes(playerId)
          const won = (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black')
          if (won) entry.wins += 1
          else entry.losses += 1
        } else if (tied) {
          entry.ties += 1
        }

        if (mvpId === playerId) entry.mvps += 1

        const myRatings = (ratings?.[playerId] || []).filter(r => r.matchId === match.id)
        if (myRatings.length > 0) {
          const avg = myRatings.reduce((s, r) => s + r.score, 0) / myRatings.length
          entry.ratingSum += avg
          entry.ratingCount += 1
        }
      })
    })

    Object.entries(byPlayer).forEach(([playerId, roles]) => {
      Object.entries(roles).forEach(([group, entry]) => {
        if (!byPosition[group]) byPosition[group] = []
        const avgRating = entry.ratingCount > 0 ? entry.ratingSum / entry.ratingCount : null
        const winRate = entry.played > 0
          ? ((entry.wins + 0.5 * entry.ties) / entry.played) * 100
          : 0
        const score = (avgRating ? avgRating * 10 : 50) * 0.5 + winRate * 0.5
        byPosition[group].push({
          playerId,
          played: entry.played,
          wins: entry.wins,
          losses: entry.losses,
          ties: entry.ties,
          mvps: entry.mvps,
          avgRating: avgRating ? avgRating.toFixed(1) : null,
          winRate: Math.round(winRate),
          score,
        })
      })
    })

    Object.values(byPosition).forEach(list => {
      list.sort((a, b) => b.score - a.score || b.winRate - a.winRate || b.played - a.played)
    })

    return { byPlayer, byPosition }
  }, [matches, ratings, getPositionGroup])

  const roleRatingRankings = useMemo(() => {
    const rankings = {}
    Object.entries(positionAnalytics.byPosition || {}).forEach(([role, list]) => {
      rankings[role] = (list || [])
        .filter(entry => entry.avgRating)
        .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating) || b.played - a.played)
        .map(entry => ({
          playerId: entry.playerId,
          avgRating: entry.avgRating,
          played: entry.played,
          winRate: entry.winRate,
        }))
    })
    return { rankings }
  }, [positionAnalytics])

  const historicalRecords = useMemo(() => {
    const minGames = 5
    const records = []
    if (!stats || stats.length === 0) return records

    const getLeaders = (items, getValue, filterFn = null) => {
      const list = filterFn ? items.filter(filterFn) : items
      if (!list.length) return null
      const maxVal = Math.max(...list.map(getValue))
      if (!isFinite(maxVal)) return null
      const leaders = list.filter(item => getValue(item) === maxVal)
      return { maxVal, leaders }
    }

    const mostWins = getLeaders(stats, s => s.wins || 0)
    const mostMvps = getLeaders(stats, s => s.mvps || 0)
    const mostPlayed = getLeaders(stats, s => s.played || 0)
    const mostTies = getLeaders(stats, s => s.ties || 0)
    const bestWinRate = getLeaders(
      stats,
      s => Math.round(s.winRate || 0),
      s => (s.played || 0) >= minGames
    )
    const bestRating = getLeaders(
      stats,
      s => s.avgRating ? parseFloat(s.avgRating) : -Infinity,
      s => s.avgRating && (s.played || 0) >= minGames
    )

    if (mostWins) records.push({ title: 'Más victorias', value: `${mostWins.maxVal} V`, playerIds: mostWins.leaders.map(l => l.id) })
    if (mostMvps) records.push({ title: 'Más MVPs', value: `${mostMvps.maxVal} MVP`, playerIds: mostMvps.leaders.map(l => l.id) })
    if (mostPlayed) records.push({ title: 'Más partidos', value: `${mostPlayed.maxVal} PJ`, playerIds: mostPlayed.leaders.map(l => l.id) })
    if (mostTies) records.push({ title: 'Más empates', value: `${mostTies.maxVal} E`, playerIds: mostTies.leaders.map(l => l.id) })
    if (bestWinRate) records.push({ title: 'Mejor Win Rate', value: `${bestWinRate.maxVal}%`, playerIds: bestWinRate.leaders.map(l => l.id) })
    if (bestRating) records.push({ title: 'Mejor Rating', value: `${bestRating.maxVal.toFixed(1)} pts`, playerIds: bestRating.leaders.map(l => l.id) })

    const roleRatingLeaders = Object.entries(roleRatingRankings.rankings || {}).map(([role, list]) => {
      if (!list?.length) return null
      const maxVal = Math.max(...list.map(l => parseFloat(l.avgRating)))
      const leaders = list.filter(l => parseFloat(l.avgRating) === maxVal)
      return { role, maxVal, leaders }
    }).filter(Boolean)
    roleRatingLeaders.forEach(entry => {
      records.push({
        title: `Top Rating ${entry.role}`,
        value: `${entry.maxVal.toFixed(1)} pts`,
        playerIds: entry.leaders.map(l => l.playerId),
      })
    })

    return records
  }, [stats, roleRatingRankings])

  // Last-5 form per player: 'v' (win) | 'e' (draw) | 'd' (loss)
  const playerFormMap = useMemo(() => {
    const map = {}
    const sorted = [...matches]
      .filter(m => m.winner === 'white' || m.winner === 'black' || m.winner === 'tie')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    sorted.forEach(match => {
      const all = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      all.forEach(pid => {
        if (!map[pid]) map[pid] = []
        const inWhite = match.teamWhite?.includes(pid)
        let r = 'e'
        if (match.winner !== 'tie') {
          r = (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black') ? 'v' : 'd'
        }
        map[pid].push(r)
      })
    })
    Object.keys(map).forEach(id => { map[id] = map[id].slice(-5) })
    return map
  }, [matches])

  const analyticsOverview = useMemo(() => {
    const completedMatches = matches.filter(
      match => match.winner === 'white' || match.winner === 'black' || match.winner === 'tie'
    ).length
    const trackedRoles = Object.entries(roleRatingRankings.rankings || {}).filter(
      ([role, list]) => role !== 'Sin posición' && (list?.length || 0) > 0
    ).length
    const activePlayers = stats.filter(player => (player.played || 0) > 0).length
    return [
      { id: 'matches', label: 'Partidos analizados', value: completedMatches, icon: 'ball' },
      { id: 'roles', label: 'Posiciones activas', value: trackedRoles, icon: 'target' },
      { id: 'records', label: 'Récords detectados', value: historicalRecords.length, icon: 'trophy' },
      { id: 'players', label: 'Jugadores con datos', value: activePlayers, icon: 'profile' },
    ]
  }, [matches, roleRatingRankings, historicalRecords, stats])

  const playerProgressInsights = useMemo(() => {
    const byPlayerRole = {}
    const sortedMatches = [...(matches || [])].sort((a, b) => new Date(a.date) - new Date(b.date))

    sortedMatches.forEach(match => {
      const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      const decided = match.winner === 'white' || match.winner === 'black'
      const tied = match.winner === 'tie'

      allPlayers.forEach(playerId => {
        const role = getPositionGroup(match.positions?.[playerId] || '')
        if (role === 'Sin posición') return

        const key = `${playerId}__${role}`
        if (!byPlayerRole[key]) byPlayerRole[key] = []

        const myRatings = (ratings?.[playerId] || []).filter(r => r.matchId === match.id)
        const ratingAvg = myRatings.length > 0
          ? myRatings.reduce((sum, rating) => sum + rating.score, 0) / myRatings.length
          : null

        const inWhite = match.teamWhite?.includes(playerId)
        let resultScore = 0.5
        if (decided) {
          const won = (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black')
          resultScore = won ? 1 : 0
        } else if (tied) {
          resultScore = 0.5
        }

        byPlayerRole[key].push({
          date: match.date,
          resultScore,
          ratingAvg,
        })
      })
    })

    const summarizeWindow = (entries) => {
      if (!entries.length) {
        return {
          matches: 0,
          winRate: null,
          ratingAvg: null,
        }
      }

      const winRate = (entries.reduce((sum, entry) => sum + entry.resultScore, 0) / entries.length) * 100
      const ratingValues = entries.map(entry => entry.ratingAvg).filter(value => typeof value === 'number')
      const ratingAvg = ratingValues.length > 0
        ? ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length
        : null

      return {
        matches: entries.length,
        winRate,
        ratingAvg,
      }
    }

    const rows = Object.entries(byPlayerRole).map(([key, entries]) => {
      const [playerId, role] = key.split('__')
      const last5 = entries.slice(-5)
      const prev5 = entries.slice(-10, -5)
      const last10 = entries.slice(-10)

      const last5Stats = summarizeWindow(last5)
      const prev5Stats = summarizeWindow(prev5)
      const last10Stats = summarizeWindow(last10)

      const ratingDelta5 = (last5Stats.ratingAvg !== null && prev5Stats.ratingAvg !== null)
        ? last5Stats.ratingAvg - prev5Stats.ratingAvg
        : null
      const winDelta5 = (last5Stats.winRate !== null && prev5Stats.winRate !== null)
        ? last5Stats.winRate - prev5Stats.winRate
        : null

      const trendScore = ((ratingDelta5 || 0) * 9) + ((winDelta5 || 0) * 0.55) + (Math.min(last10Stats.matches, 10) * 0.4)

      return {
        playerId,
        role,
        matches: entries.length,
        trendScore,
        last5: last5Stats,
        prev5: prev5Stats,
        last10: last10Stats,
        ratingDelta5,
        winDelta5,
      }
    }).filter(row => row.matches >= 3)
      .sort((a, b) => b.trendScore - a.trendScore || b.matches - a.matches)

    const roles = ['all', ...Array.from(new Set(rows.map(row => row.role))).sort()]

    return {
      rows,
      roles,
    }
  }, [matches, ratings, getPositionGroup])

  const getMatchXpBreakdown = (playerId, match) => {
    const base = { participation: 10, win: 0, rating: 0, mvp: 0, ratingAvg: null }
    if (!match?.id) return { ...base, total: base.participation }

    const inWhite = match.teamWhite?.includes(playerId)
    const won = match.winner
      ? (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black')
      : false
    base.win = won ? 25 : 0

    const playerRatings = (ratings?.[playerId] || []).filter(r => r.matchId === match.id)
    if (playerRatings.length > 0) {
      const avg = playerRatings.reduce((sum, r) => sum + r.score, 0) / playerRatings.length
      base.ratingAvg = avg
      base.rating = Math.round(avg * 5)
    }

    // MVP: highest average rating in match
    const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
    let mvpId = null
    let mvpRating = -1
    allPlayers.forEach(pid => {
      const pRatings = (ratings?.[pid] || []).filter(r => r.matchId === match.id)
      if (pRatings.length > 0) {
        const avg = pRatings.reduce((sum, r) => sum + r.score, 0) / pRatings.length
        if (avg > mvpRating) {
          mvpRating = avg
          mvpId = pid
        }
      }
    })
    base.mvp = mvpId === playerId ? 50 : 0

    const total = base.participation + base.win + base.rating + base.mvp
    return { ...base, total }
  }

  const getMatchXP = (playerId, match) => getMatchXpBreakdown(playerId, match).total

  const calculateXP = playerId => {
    const playerMatches = matches
      .filter(m => m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    if (playerMatches.length === 0) return 0

    let xp = 0
    playerMatches.forEach(match => {
      xp += getMatchXP(playerId, match)
    })

    const linkedUserId = Object.entries(userLinks || {}).find(
      ([, linkData]) => linkData?.playerId === playerId
    )?.[0]
    if (linkedUserId) {
      const appliedMatchId = userLinks?.[linkedUserId]?.xpBoostAppliedMatchId
      const appliedMultiplier = userLinks?.[linkedUserId]?.xpBoostAppliedMultiplier || 1
      if (appliedMatchId && appliedMultiplier > 1) {
        const match = matches.find(m => m.id === appliedMatchId)
        if (match) {
          xp += getMatchXP(playerId, match) * (appliedMultiplier - 1)
        }
      }
    }

    return xp
  }

  const getPoolTotalsForMatch = matchId => {
    const matchPreds = predictions?.[matchId] || {}
    let totalWhite = 0
    let totalBlack = 0
    Object.values(matchPreds).forEach(pred => {
      const bet = getPredictionBet(pred)
      if (pred?.prediction === 'white') totalWhite += bet
      if (pred?.prediction === 'black') totalBlack += bet
    })
    return { totalWhite, totalBlack }
  }

  const getPoolPotentialWin = (matchId, selectedTeam, bet) => {
    if (!matchId || !selectedTeam || bet <= 0) return 0
    const { totalWhite, totalBlack } = getPoolTotalsForMatch(matchId)
    const totalWinSide = selectedTeam === 'white' ? totalWhite + bet : totalBlack + bet
    const totalLoseSide = selectedTeam === 'white' ? totalBlack : totalWhite
    if (totalWinSide <= 0 || totalLoseSide <= 0) return 0
    return Math.round((bet / totalWinSide) * totalLoseSide)
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

        if (!match?.winner) {
          coins -= bet
          return
        }

        if (pred.prediction === match.winner) {
          const { totalWhite, totalBlack } = getPoolTotalsForMatch(match.id || matchId)
          const totalWinSide = match.winner === 'white' ? totalWhite : totalBlack
          const totalLoseSide = match.winner === 'white' ? totalBlack : totalWhite
          const poolWin = totalWinSide > 0 && totalLoseSide > 0
            ? Math.round((bet / totalWinSide) * totalLoseSide)
            : 0
          coins += bet + poolWin
        }
      })
      const spent = userLinks?.[userId]?.lukcoinsSpent || 0
      coins -= spent
      const adjustment = userLinks?.[userId]?.lukcoinsAdjustment || 0
      coins += adjustment
    }

    return Math.max(0, Math.round(coins))
  }

  const getLCBreakdown = (playerId) => {
    const playerStats = stats.find(s => s.id === playerId)
    if (!playerStats) return null
    const COIN_REWARDS = { played: 5, win: 8, mvp: 12, ratedMatch: 4 }
    const playedLC = playerStats.played * COIN_REWARDS.played
    const winLC = playerStats.wins * COIN_REWARDS.win
    const mvpLC = (playerStats.mvps || 0) * COIN_REWARDS.mvp
    const ratedMatches = new Set()
    Object.values(ratings || {}).forEach(pRatings => {
      pRatings.forEach(r => { if (r.ratedBy === playerId && r.matchId) ratedMatches.add(r.matchId) })
    })
    const ratedLC = ratedMatches.size * COIN_REWARDS.ratedMatch
    const userId = Object.entries(userLinks || {}).find(([, d]) => d?.playerId === playerId)?.[0]
    let predWon = 0, predLost = 0, predPending = 0, spent = 0
    if (userId) {
      Object.entries(predictions || {}).forEach(([matchId, matchPreds]) => {
        const pred = matchPreds?.[userId]
        if (!pred) return
        const match = matches.find(m => m.id === (pred.matchId || matchId))
        const bet = getPredictionBet(pred)
        if (!match?.winner) { predPending += bet; return }
        if (pred.prediction === match.winner) {
          const { totalWhite, totalBlack } = getPoolTotalsForMatch(match.id || matchId)
          const totalWinSide = match.winner === 'white' ? totalWhite : totalBlack
          const totalLoseSide = match.winner === 'white' ? totalBlack : totalWhite
          const poolWin = totalWinSide > 0 && totalLoseSide > 0 ? Math.round((bet / totalWinSide) * totalLoseSide) : 0
          predWon += poolWin
        } else { predLost += bet }
      })
      spent = userLinks?.[userId]?.lukcoinsSpent || 0
    }
    const userId2 = Object.entries(userLinks || {}).find(([, d]) => d?.playerId === playerId)?.[0]
    const adjustment = userId2 ? (userLinks?.[userId2]?.lukcoinsAdjustment || 0) : 0
    return { played: playerStats.played, playedLC, wins: playerStats.wins, winLC, mvps: playerStats.mvps || 0, mvpLC, ratedCount: ratedMatches.size, ratedLC, predWon, predLost, predPending, spent, adjustment }
  }

  const getXPBreakdown = (playerId) => {
    const playerMatches = matches.filter(m => m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId))
    let participationXP = 0, winXP = 0, mvpXP = 0, ratingXP = 0
    playerMatches.forEach(match => {
      const br = getMatchXpBreakdown(playerId, match)
      participationXP += br.participation
      winXP += br.win
      mvpXP += br.mvp
      ratingXP += br.rating
    })
    const linkedUserId = Object.entries(userLinks || {}).find(([, d]) => d?.playerId === playerId)?.[0]
    let boostXP = 0
    if (linkedUserId) {
      const appliedMatchId = userLinks?.[linkedUserId]?.xpBoostAppliedMatchId
      const multiplier = userLinks?.[linkedUserId]?.xpBoostAppliedMultiplier || 1
      if (appliedMatchId && multiplier > 1) {
        const match = matches.find(m => m.id === appliedMatchId)
        if (match) boostXP = Math.round(getMatchXP(playerId, match) * (multiplier - 1))
      }
    }
    return { played: playerMatches.length, participationXP, wins: Math.round(winXP / 25), winXP, mvps: Math.round(mvpXP / 50), mvpXP, ratingXP, boostXP, total: participationXP + winXP + mvpXP + ratingXP + boostXP }
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
      await logActivity('admin_add', { email: newAdminEmail.trim().toLowerCase() })
      setNewAdminEmail('')
      showToast('success', 'Admin agregado')
    } catch (error) {
      console.error('Error adding admin:', error)
      showToast('error', 'Error al agregar admin')
    }
  }

  // Remove admin email
  const handleRemoveAdmin = async email => {
    const confirmed = await askConfirmation({
      title: 'Quitar permisos de admin',
      message: `¿Quitar permisos de admin a ${email}?`,
      confirmText: 'Quitar permisos',
    })
    if (!confirmed) return
    try {
      const newList = adminEmails.filter(e => e !== email)
      await setDoc(doc(db, 'settings', 'admins'), { emails: newList })
      await logActivity('admin_remove', { email })
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
        const prevPlayer = players.find(p => p.id === editingPlayerId)
        await updateDoc(doc(db, 'players', editingPlayerId), playerData)
        await logActivity('player_edit', { playerId: editingPlayerId, before: prevPlayer, after: playerData })
        showToast('success', 'Jugador actualizado')
      } else {
        const newPlayerId = Date.now().toString()
        await setDoc(doc(db, 'players', newPlayerId), playerData)
        await logActivity('player_create', { playerId: newPlayerId, data: playerData })
        showToast('success', 'Jugador creado')
      }
      closePlayerModal()
    } catch (error) {
      console.error('Error:', error)
      showToast('error', 'Error al guardar')
    }
  }

  const handleDeletePlayer = async (playerId, playerName) => {
    const confirmed = await askConfirmation({
      title: 'Eliminar jugador',
      message: `¿Eliminar a "${playerName}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar',
    })
    if (!confirmed) return
    try {
      await setDoc(doc(db, 'players', playerId), { deleted: true }, { merge: true })
      // Actually delete
      const batch = writeBatch(db)
      batch.delete(doc(db, 'players', playerId))
      await batch.commit()
      await logActivity('player_delete', { playerId, playerName })
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

  const openAddEditPlayerModal = () => {
    closePlayerModal()
    setShowPlayerModal(true)
  }

  const getMatchStartDate = (match) => {
    if (!match?.date) return null
    const timeValue = match.time || match.matchTime || match.startTime || '23:59'
    const start = new Date(`${match.date}T${timeValue}:00`)
    return isNaN(start) ? null : start
  }

  const canPredictMatch = (match) => {
    const start = getMatchStartDate(match)
    if (!start) return true
    const cutoff = new Date(start.getTime() - 10 * 60 * 1000)
    return new Date() < cutoff
  }

  // ============ PREDICTION HANDLERS ============
  
  const { calculateTeamProbability } = matchBuilder

  const openPredictionModal = (match) => {
    if (!user || !userPlayer) {
      showToast('error', 'Debes iniciar sesión para predecir')
      return
    }
    if (match.winner) {
      showToast('error', 'Este partido ya terminó')
      return
    }
    if (!canPredictMatch(match)) {
      showToast('error', 'Predicciones cerradas (10 min antes del partido)')
      return
    }
    if (predictions[match.id]?.[user.uid]) {
      showToast('error', 'Ya hiciste tu predicción para este partido')
      return
    }
    setPredictionMatch(match)
    setSelectedPrediction(null)
    setPredictedMvpId('')
    setPredictedScoreWhite('')
    setPredictedScoreBlack('')
    setShowPredictionModal(true)
  }

  const closePredictionModal = () => {
    setShowPredictionModal(false)
    setPredictionMatch(null)
    setSelectedPrediction(null)
    setCoinBet(10)
    setPredictedMvpId('')
    setPredictedScoreWhite('')
    setPredictedScoreBlack('')
  }

  const spendLukCoins = async (
    amount,
    {
      cosmeticsUpdate = null,
      boostUpdate = null,
      avatarUpdate = null,
      purchaseMeta = null,
      successMessage = null,
      errorMessage = 'No se pudo completar la compra',
    } = {}
  ) => {
    if (!user || !userPlayer) return { ok: false, reason: 'auth_required' }
    if (amount < 0) return { ok: false, reason: 'invalid_amount' }
    const hasAnyChange = !!(
      cosmeticsUpdate ||
      boostUpdate ||
      avatarUpdate ||
      purchaseMeta ||
      amount > 0
    )
    if (!hasAnyChange) return { ok: false, reason: 'no_changes' }

    const currentCoins = calculateLukCoins(userPlayer)
    if (amount > currentCoins) {
      showToast('error', 'No tienes suficientes LukCoins')
      return { ok: false, reason: 'insufficient_funds' }
    }
    const currentLink = userLinks?.[user.uid] || {}
    const newSpent = (currentLink.lukcoinsSpent || 0) + amount
    const newCosmetics = cosmeticsUpdate
      ? { ...(currentLink.cosmetics || {}), ...cosmeticsUpdate }
      : currentLink.cosmetics || {}
    const nextBoost = boostUpdate
      ? {
          multiplier: boostUpdate.multiplier,
          purchasedAt: new Date().toISOString(),
        }
      : currentLink.xpBoostPending || null
    const currentHistory = Array.isArray(currentLink.purchaseHistory)
      ? currentLink.purchaseHistory
      : []
    const nowIso = new Date().toISOString()

    const currentAvatar = createAvatarState(currentLink.avatar || {})
    let nextAvatar = currentAvatar
    if (avatarUpdate) {
      const inventoryAdd = avatarUpdate.inventoryAdd || {}
      const loadoutPatch = avatarUpdate.loadoutPatch || {}
      const clonedInventory = Object.entries(currentAvatar.inventory || {}).reduce((acc, [slot, values]) => {
        acc[slot] = { ...(values || {}) }
        return acc
      }, {})
      nextAvatar = {
        loadout: { ...currentAvatar.loadout },
        inventory: clonedInventory,
      }

      Object.entries(inventoryAdd).forEach(([slot, values]) => {
        if (!nextAvatar.inventory[slot]) nextAvatar.inventory[slot] = {}
        const slotValues = Array.isArray(values) ? values : [values]
        slotValues.forEach(value => {
          if (typeof value === 'string' && value.trim()) {
            nextAvatar.inventory[slot][value] = true
          }
        })
      })

      Object.entries(loadoutPatch).forEach(([slot, value]) => {
        if (typeof value !== 'string' || !value.trim()) return
        if (!nextAvatar.inventory[slot]) nextAvatar.inventory[slot] = {}
        nextAvatar.inventory[slot][value] = true
        nextAvatar.loadout[slot] = value
      })
    }

    const purchaseEntry = purchaseMeta
      ? {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          title: purchaseMeta.title || 'Compra',
          itemId: purchaseMeta.itemId || null,
          kind: purchaseMeta.kind || 'item',
          category: purchaseMeta.category || 'general',
          rarity: purchaseMeta.rarity || 'common',
          source: purchaseMeta.source || 'store',
          price: amount,
          createdAt: nowIso,
        }
      : null

    try {
      const updatePayload = {
        lukcoinsSpent: newSpent,
        cosmetics: newCosmetics,
        xpBoostPending: nextBoost,
        updatedAt: nowIso,
      }
      if (avatarUpdate) {
        updatePayload.avatar = nextAvatar
      }
      if (purchaseEntry) {
        updatePayload.purchaseHistory = [purchaseEntry, ...currentHistory].slice(0, 20)
      }

      await setDoc(
        doc(db, 'userLinks', user.uid),
        updatePayload,
        { merge: true }
      )
      showToast('success', successMessage || (amount > 0 ? 'Compra realizada' : 'Actualizacion guardada'))
      return { ok: true }
    } catch (error) {
      console.error('Error saving LukCoins purchase:', error)
      showToast('error', errorMessage)
      return { ok: false, reason: 'save_error' }
    }
  }

  useEffect(() => {
    if (!user || !userPlayer || !dataLoaded) return
    const link = userLinks?.[user.uid]
    const shownMap = link?.xpMatchShown || {}
    const eligibleMatches = matches
      .filter(m => m.winner && (m.teamWhite?.includes(userPlayer) || m.teamBlack?.includes(userPlayer)))
      .sort((a, b) => new Date(b.date) - new Date(a.date))

    const nextMatch = eligibleMatches.find(m => {
      if (shownMap[m.id]) return false
      const totalRatings = Object.values(ratings || {}).reduce((count, playerRatings) => {
        return count + playerRatings.filter(r => r.matchId === m.id).length
      }, 0)
      return totalRatings >= 5
    })
    if (!nextMatch) return

    const breakdown = getMatchXpBreakdown(userPlayer, nextMatch)
    const baseXp = breakdown.total
    let bonusXp = 0
    if (link?.xpBoostAppliedMatchId === nextMatch.id && link?.xpBoostAppliedMultiplier > 1) {
      bonusXp = baseXp * (link.xpBoostAppliedMultiplier - 1)
    }

    setMatchXpData({
      match: nextMatch,
      baseXp,
      bonusXp,
      totalXp: baseXp + bonusXp,
      multiplier: link?.xpBoostAppliedMultiplier || 1,
      breakdown,
    })
    setShowMatchXpModal(true)
  }, [user, userPlayer, dataLoaded, matches, ratings, userLinks])

  const closeMatchXpModal = async () => {
    setShowMatchXpModal(false)
    if (!user || !matchXpData?.match?.id) return
    try {
      const currentShown = userLinks?.[user.uid]?.xpMatchShown || {}
      await setDoc(
        doc(db, 'userLinks', user.uid),
        {
          xpMatchShown: {
            ...currentShown,
            [matchXpData.match.id]: true,
          },
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    } catch (error) {
      console.error('Error saving XP modal state:', error)
    } finally {
      setMatchXpData(null)
    }
  }

  useEffect(() => {
    if (!user || !userPlayer) return
    const link = userLinks?.[user.uid]
    if (!link?.xpBoostPending || link?.xpBoostAppliedMatchId) return

    const purchasedAt = new Date(link.xpBoostPending.purchasedAt || 0)
    const playerMatches = matches
      .filter(m => m.teamWhite?.includes(userPlayer) || m.teamBlack?.includes(userPlayer))
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    const nextMatch = playerMatches.find(m => new Date(m.date) >= purchasedAt)
    if (!nextMatch) return

    const applyBoost = async () => {
      try {
        await setDoc(
          doc(db, 'userLinks', user.uid),
          {
            xpBoostAppliedMatchId: nextMatch.id,
            xpBoostAppliedMultiplier: link.xpBoostPending.multiplier,
            xpBoostPending: null,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      } catch (error) {
        console.error('Error applying XP boost:', error)
      }
    }
    applyBoost()
  }, [user, userPlayer, userLinks, matches])

  const submitPrediction = async () => {
    if (!selectedPrediction || !predictionMatch || !user) {
      showToast('error', 'Selecciona un equipo')
      return
    }
    if (!canPredictMatch(predictionMatch)) {
      showToast('error', 'Predicciones cerradas (10 min antes del partido)')
      return
    }
    
    // Check if user has enough LukCoins
    const currentCoins = userPlayer ? calculateLukCoins(userPlayer) : 0
    if (coinBet > currentCoins) {
      showToast('error', `No tienes suficientes LukCoins (tienes ${currentCoins})`)
      return
    }

    const normalizedScoreWhite = predictedScoreWhite === '' ? null : Number(predictedScoreWhite)
    const normalizedScoreBlack = predictedScoreBlack === '' ? null : Number(predictedScoreBlack)
    const hasScorePrediction = normalizedScoreWhite !== null || normalizedScoreBlack !== null
    if (hasScorePrediction && (normalizedScoreWhite === null || normalizedScoreBlack === null)) {
      showToast('error', 'Si predices marcador, completa ambos goles')
      return
    }
    if (hasScorePrediction) {
      const invalidScore = !Number.isInteger(normalizedScoreWhite)
        || !Number.isInteger(normalizedScoreBlack)
        || normalizedScoreWhite < 0
        || normalizedScoreBlack < 0
        || normalizedScoreWhite > 30
        || normalizedScoreBlack > 30
      if (invalidScore) {
        showToast('error', 'Marcador inválido. Usa números enteros entre 0 y 30')
        return
      }
      const winnerFromScore = normalizedScoreWhite === normalizedScoreBlack
        ? 'tie'
        : normalizedScoreWhite > normalizedScoreBlack
          ? 'white'
          : 'black'
      if (winnerFromScore === 'tie') {
        showToast('error', 'El marcador no puede ser empate porque solo se predice ganador')
        return
      }
      if (winnerFromScore !== selectedPrediction) {
        showToast('error', 'Tu marcador no coincide con el equipo seleccionado')
        return
      }
    }

    const allMatchPlayers = [...(predictionMatch.teamWhite || []), ...(predictionMatch.teamBlack || [])]
    if (predictedMvpId && !allMatchPlayers.includes(predictedMvpId)) {
      showToast('error', 'El MVP probable seleccionado no es válido')
      return
    }
    
    try {
      const predictionId = `${user.uid}_${predictionMatch.id}`
      const probability = calculateTeamProbability(predictionMatch)
      const winningOdds = selectedPrediction === 'white' ? probability.white : probability.black
      const potentialWin = getPoolPotentialWin(predictionMatch.id, selectedPrediction, coinBet)
      const userLink = userLinks?.[user.uid]
      const displayName = userLink?.userName || user?.displayName || user?.email?.split('@')[0] || 'Usuario'
      const userEmail = userLink?.userEmail || user?.email || ''
      const userPhoto = userLink?.userPhoto || user?.photoURL || ''
      
      await setDoc(doc(db, 'predictions', predictionId), {
        odedBy: user.uid,
        matchId: predictionMatch.id,
        prediction: selectedPrediction,
        xpBet: coinBet,
        potentialWin: potentialWin,
        lukCoinsBet: coinBet,
        lukCoinsWin: potentialWin,
        probability: winningOdds,
        predictedMvpId: predictedMvpId || '',
        predictedScoreWhite: hasScorePrediction ? normalizedScoreWhite : null,
        predictedScoreBlack: hasScorePrediction ? normalizedScoreBlack : null,
        userName: displayName,
        userEmail: userEmail,
        userPhoto: userPhoto,
        timestamp: new Date().toISOString(),
        resolved: false
      })
      await logActivity('prediction_create', {
        matchId: predictionMatch.id,
        prediction: selectedPrediction,
        bet: coinBet,
        predictedMvpId: predictedMvpId || null,
        predictedScoreWhite: hasScorePrediction ? normalizedScoreWhite : null,
        predictedScoreBlack: hasScorePrediction ? normalizedScoreBlack : null,
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

    // Check rating restrictions before opening the modal
    if (blockedUsers.includes(user?.uid)) {
      showToast('error', 'Tu cuenta ha sido bloqueada para calificar')
      return
    }
    if (ratingRestrictions?.users?.includes(user?.uid)) {
      showToast('error', 'No tienes permiso para calificar')
      return
    }
    const matchRatingBlocked = ratingRestrictions?.perMatch?.[match.id] || []
    if (matchRatingBlocked.includes(user?.uid)) {
      showToast('error', 'No tienes permiso para calificar este partido')
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

    const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
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

  const handleRatingChange = async (playerId, score) => {
    if (score <= 3) {
      const confirmed = await askConfirmation({
        title: 'Calificación muy baja',
        message: '¿Seguro que deseas poner una nota tan baja?',
        confirmText: 'Sí, continuar',
        cancelText: 'Revisar nota',
        tone: 'warning',
      })
      if (!confirmed) {
        return
      }
    }
    setCurrentRatings({ ...currentRatings, [playerId]: score })
  }

  const submitRatings = async () => {
    if (!selectedMatch || !userPlayer) return

    try {
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

      if (ratingRestrictions?.users?.includes(user?.uid)) {
        showToast('error', 'No tienes permiso para calificar')
        return
      }

      const matchRatingBlocked = ratingRestrictions?.perMatch?.[selectedMatch.id] || []
      if (matchRatingBlocked.includes(user?.uid)) {
        showToast('error', 'No tienes permiso para calificar este partido')
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
    } catch (error) {
      console.error('Error submitting ratings:', error)
      showToast('error', 'Error al guardar calificaciones. Intenta de nuevo.')
    }
  }

  const closeRatingModal = () => {
    setShowRatingModal(false)
    setSelectedMatch(null)
    setCurrentRatings({})
    setRatingSuccess(false)
  }

  const getPlayersToRate = match => {
    const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
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


  const handleDeleteMatch = async matchId => {
    const confirmed = await askConfirmation({
      title: 'Eliminar partido',
      message: '¿Eliminar este partido y todas sus calificaciones? Esta acción no se puede deshacer.',
      confirmText: 'Eliminar partido',
    })
    if (!confirmed) return

    try {
      const matchToDelete = matches.find(m => m.id === matchId)
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
      await logActivity('match_delete', {
        matchId,
        matchDate: matchToDelete?.date,
        predictionsDeleted: predictionsSnapshot.docs.length
      })
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
      await logActivity('ratings_toggle', { matchId, open: newState })
      showToast('success', newState ? 'Calificaciones abiertas' : 'Calificaciones cerradas')
    } catch (error) {
      console.error('Error toggling ratings:', error)
      showToast('error', 'Error al cambiar estado')
    }
  }

  const blockUser = async userId => {
    if (!userId) return
    const newList = [...blockedUsers, userId]
    await setDoc(doc(db, 'settings', 'blockedUsers'), { list: newList })
    await logActivity('user_block', { userId })
    showToast('success', 'Usuario bloqueado')
  }

  const unblockUser = async userId => {
    if (!userId) return
    const newList = blockedUsers.filter(id => id !== userId)
    await setDoc(doc(db, 'settings', 'blockedUsers'), { list: newList })
    await logActivity('user_unblock', { userId })
    showToast('success', 'Usuario desbloqueado')
  }

  const adjustLukCoins = async (userId, amount, reason) => {
    if (!userId || !amount) return
    const linkRef = doc(db, 'userLinks', userId)
    const current = userLinks?.[userId]?.lukcoinsAdjustment || 0
    const newAdjustment = current + parseInt(amount)
    await updateDoc(linkRef, { lukcoinsAdjustment: newAdjustment })
    await logActivity('lukcoins_adjust', { userId, amount: parseInt(amount), reason, newTotal: newAdjustment })
    showToast('success', `${parseInt(amount) >= 0 ? '+' : ''}${amount} LC ajustados`)
  }

  const blockRating = async (userId, matchId) => {
    if (!userId) return
    const current = ratingRestrictions || { users: [], perMatch: {} }
    if (matchId) {
      const matchList = current.perMatch?.[matchId] || []
      if (matchList.includes(userId)) return
      const newPerMatch = { ...current.perMatch, [matchId]: [...matchList, userId] }
      await setDoc(doc(db, 'settings', 'ratingRestrictions'), { ...current, perMatch: newPerMatch })
      await logActivity('rating_block_match', { userId, matchId })
      showToast('success', 'Bloqueado para este partido')
    } else {
      if (current.users?.includes(userId)) return
      const newUsers = [...(current.users || []), userId]
      await setDoc(doc(db, 'settings', 'ratingRestrictions'), { ...current, users: newUsers })
      await logActivity('rating_block_global', { userId })
      showToast('success', 'Bloqueado de calificar')
    }
  }

  const unblockRating = async (userId, matchId) => {
    if (!userId) return
    const current = ratingRestrictions || { users: [], perMatch: {} }
    if (matchId) {
      const matchList = (current.perMatch?.[matchId] || []).filter(id => id !== userId)
      const newPerMatch = { ...current.perMatch, [matchId]: matchList }
      await setDoc(doc(db, 'settings', 'ratingRestrictions'), { ...current, perMatch: newPerMatch })
      await logActivity('rating_unblock_match', { userId, matchId })
      showToast('success', 'Acceso restaurado para este partido')
    } else {
      const newUsers = (current.users || []).filter(id => id !== userId)
      await setDoc(doc(db, 'settings', 'ratingRestrictions'), { ...current, users: newUsers })
      await logActivity('rating_unblock_global', { userId })
      showToast('success', 'Acceso a calificaciones restaurado')
    }
  }

  const removeUserPredictions = async userId => {
    if (!userId) return
    const confirmed = await askConfirmation({
      title: 'Borrar predicciones',
      message: '¿Eliminar todas las predicciones de este usuario?',
      confirmText: 'Borrar predicciones',
    })
    if (!confirmed) return
    const predsQuery = query(collection(db, 'predictions'), where('odedBy', '==', userId))
    const snapshot = await getDocs(predsQuery)
    if (snapshot.empty) {
      showToast('info', 'No hay predicciones para borrar')
      return
    }
    const batch = writeBatch(db)
    snapshot.docs.forEach(docSnap => batch.delete(doc(db, 'predictions', docSnap.id)))
    await batch.commit()
    await logActivity('prediction_bulk_delete', { userId, count: snapshot.docs.length })
    showToast('success', 'Predicciones eliminadas')
  }

  const unlinkUser = async userId => {
    if (!userId) return
    const confirmed = await askConfirmation({
      title: 'Desvincular usuario',
      message: '¿Desvincular este usuario del jugador?',
      confirmText: 'Desvincular',
      tone: 'warning',
    })
    if (!confirmed) return
    const linkRef = doc(db, 'userLinks', userId)
    await updateDoc(linkRef, { playerId: '' })
    await logActivity('user_unlink', { userId })
    showToast('success', 'Usuario desvinculado')
  }

  const handleBulkDeleteRatings = async (matchId) => {
    if (!matchId) return false
    const confirmed = await askConfirmation({
      title: 'Eliminar calificaciones',
      message: '¿Eliminar TODAS las calificaciones de este partido?',
      confirmText: 'Eliminar todas',
    })
    if (!confirmed) return false

    const batch = writeBatch(db)
    const ratingsToDelete = Object.values(ratings).flat().filter(r => r.matchId === matchId)
    ratingsToDelete.forEach(r => {
      const ratingId = `${r.ratedBy}_${r.ratedPlayerId}_${matchId}`
      batch.delete(doc(db, 'ratings', ratingId))
    })
    await batch.commit()
    await logActivity('ratings_bulk_delete', { matchId, count: ratingsToDelete.length })
    showToast('success', 'Calificaciones eliminadas')
    return true
  }

  const deleteRaterRatingsForMatch = async (raterId, raterName, matchId) => {
    const confirmed = await askConfirmation({
      title: 'Eliminar calificaciones',
      message: `¿Eliminar todas las calificaciones de ${raterName} en este partido?`,
      confirmText: 'Eliminar',
    })
    if (!confirmed) return

    const batch = writeBatch(db)
    const ratingsToDelete = Object.values(ratings).flat().filter(
      r => r.matchId === matchId && r.ratedBy === raterId
    )
    ratingsToDelete.forEach(r => {
      const ratingId = `${r.ratedBy}_${r.ratedPlayerId}_${matchId}`
      batch.delete(doc(db, 'ratings', ratingId))
    })
    await batch.commit()
    await logActivity('ratings_rater_delete', { raterId, raterName, matchId, count: ratingsToDelete.length })
    showToast('success', `Calificaciones de ${raterName} eliminadas`)
  }

  const getExportRange = () => {
    const start = adminExportStart ? new Date(adminExportStart) : null
    const end = adminExportEnd ? new Date(adminExportEnd) : null
    if (end) {
      end.setHours(23, 59, 59, 999)
    }
    return { start, end }
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
    const confirmed = await askConfirmation({
      title: 'Desvincular usuario',
      message: '¿Estás seguro de desvincular este usuario?',
      confirmText: 'Desvincular',
      tone: 'warning',
    })
    if (!confirmed) return

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
    const confirmed = await askConfirmation({
      title: 'Eliminar cuenta',
      message: `¿Eliminar completamente a "${userName}"? Esta acción no se puede deshacer.`,
      confirmText: 'Eliminar cuenta',
    })
    if (!confirmed) return

    try {
      const batch = writeBatch(db)
      batch.delete(doc(db, 'userLinks', userId))
      await batch.commit()
      await logActivity('user_delete', { userId, userName })
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

  const showProfile = useCallback((playerId) => {
    setSelectedPlayerProfile(playerId)
    setShowPlayerProfile(true)
  }, [])

  const closeGlobalSearch = useCallback(() => {
    setShowGlobalSearch(false)
    setGlobalSearchQuery('')
  }, [])

  const lukCoins = userPlayer ? calculateLukCoins(userPlayer) : 0
  const userXP = userPlayer ? calculateXP(userPlayer) : 0
  const lcBreakdown = userPlayer ? getLCBreakdown(userPlayer) : null
  const xpBreakdown = userPlayer ? getXPBreakdown(userPlayer) : null
  const matchById = new Map(matches.map(m => [m.id, m]))
  const ratingsList = Object.values(ratings || {}).flat()
  const predictionsList = Object.values(predictions || {}).flatMap(matchPreds => Object.values(matchPreds || {}))

  const isWithinDays = (dateValue, days) => {
    if (!dateValue) return false
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return false
    const now = new Date()
    return now.getTime() - d.getTime() <= days * 24 * 60 * 60 * 1000
  }

  const matchesLast7 = matches.filter(m => isWithinDays(m.date, 7))
  const ratingsLast7 = ratingsList.filter(r => {
    const match = matchById.get(r.matchId)
    return match ? isWithinDays(match.date, 7) : isWithinDays(r.timestamp, 7)
  })
  const predictionsLast7 = predictionsList.filter(p => isWithinDays(p.timestamp, 7))

  const activeUsersLast7 = new Set([
    ...ratingsLast7.map(r => r.ratedBy),
    ...predictionsLast7.map(p => p.odedBy),
  ])

  const alerts = []
  const lowRatings = ratingsLast7.filter(r => r.score <= 2)
  if (lowRatings.length >= 3) {
    alerts.push({ level: 'warning', message: `Ratings muy bajos esta semana: ${lowRatings.length}` })
  }
  const highRatings = ratingsLast7.filter(r => r.score >= 9.5)
  if (highRatings.length >= 5) {
    alerts.push({ level: 'info', message: `Ratings muy altos esta semana: ${highRatings.length}` })
  }
  const predictionSpikes = matches
    .map(m => ({ matchId: m.id, count: Object.keys(predictions?.[m.id] || {}).length }))
    .filter(item => item.count >= 10)
  predictionSpikes.slice(0, 3).forEach(spike => {
    alerts.push({ level: 'warning', message: `Pico de predicciones en partido ${spike.matchId}: ${spike.count}` })
  })

  const globalSearchResults = useMemo(() => {
    const queryText = globalSearchQuery.trim().toLowerCase()
    const tabs = [
      { id: 'tab-stats', type: 'tab', tab: 'stats', title: 'Ranking', subtitle: 'Abrir ranking general', search: 'ranking stats jugadores' },
      { id: 'tab-ratings', type: 'tab', tab: 'ratings', title: 'Calificaciones', subtitle: 'Abrir ranking de ratings', search: 'ratings calificaciones votos' },
      { id: 'tab-matches', type: 'tab', tab: 'matches', title: 'Partidos', subtitle: 'Ver historial y próximos partidos', search: 'partidos matches calendario predicciones' },
      { id: 'tab-analytics', type: 'tab', tab: 'analytics', title: 'Análisis', subtitle: 'Ver analítica avanzada', search: 'analytics analisis records roles comparar' },
      { id: 'tab-store', type: 'tab', tab: 'store', title: 'Tienda', subtitle: 'Abrir tienda', search: 'store tienda lukcoins' },
    ]
    const adminTabs = isAdmin ? [
      { id: 'tab-dashboard', type: 'tab', tab: 'dashboard', title: 'Dashboard Admin', subtitle: 'Panel de control', search: 'admin dashboard panel alertas' },
      { id: 'tab-new', type: 'tab', tab: 'new', title: 'Nuevo Partido', subtitle: 'Registrar o editar partido', search: 'nuevo partido crear editar match' },
      { id: 'tab-tools', type: 'tab', tab: 'tools', title: 'Operaciones', subtitle: 'Moderación y ajustes', search: 'tools operaciones moderacion config' },
      { id: 'tab-users', type: 'tab', tab: 'users', title: 'Vincular Usuarios', subtitle: `${pendingUsers.length} pendientes`, search: 'usuarios vincular pendientes' },
      { id: 'tab-players', type: 'tab', tab: 'players', title: 'Jugadores', subtitle: 'Administrar jugadores', search: 'players jugadores editar eliminar' },
    ] : []

    const playerResults = players.map(player => ({
      id: `player-${player.id}`,
      type: 'player',
      playerId: player.id,
      title: player.name,
      subtitle: 'Abrir perfil del jugador',
      search: `${player.name} ${(player.aliases || []).join(' ')} jugador perfil`,
    }))

    const recentMatches = [...matches]
      .reverse()
      .slice(0, 25)
      .map(match => {
        const whiteNames = (match.teamWhite || []).map(pid => getPlayerName(pid)).join(' ')
        const blackNames = (match.teamBlack || []).map(pid => getPlayerName(pid)).join(' ')
        return {
          id: `match-${match.id}`,
          type: 'match',
          matchId: match.id,
          title: `${match.venue || 'Partido'} · ${match.date || ''}`,
          subtitle: `${(match.teamWhite || []).length} vs ${(match.teamBlack || []).length}`,
          search: `${match.venue || ''} ${match.date || ''} ${whiteNames} ${blackNames} partido`,
        }
      })

    const all = [...tabs, ...adminTabs, ...playerResults, ...recentMatches]
    if (!queryText) return all.slice(0, 14)
    return all.filter(item => item.search.toLowerCase().includes(queryText)).slice(0, 24)
  }, [globalSearchQuery, isAdmin, matches, pendingUsers.length, players, getPlayerName])

  const handleGlobalSearchSelect = useCallback((item) => {
    closeGlobalSearch()
    if (item.type === 'tab') {
      setActiveTab(item.tab)
      return
    }
    if (item.type === 'player') {
      setActiveTab('stats')
      showProfile(item.playerId)
      return
    }
    if (item.type === 'match') {
      setActiveTab('matches')
    }
  }, [closeGlobalSearch, setActiveTab, showProfile])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [activeTab])

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
        onOpenSearch={() => setShowGlobalSearch(true)}
        onShowProfile={showProfile}
        lukCoins={lukCoins}
        userXP={userXP}
        lcBreakdown={lcBreakdown}
        xpBreakdown={xpBreakdown}
      />
      {/* Nav — fixed bottom on mobile, top tabs on desktop */}
      <BottomNav
        showPlayerProfile={showPlayerProfile}
        selectedPlayerProfile={selectedPlayerProfile}
        onShowProfile={showProfile}
      />

      {/* Time Filter Pills — only shown for ratings (stats has its own inline filter) */}
      {activeTab === 'ratings' && (
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

      {/* Admin Bar */}
      {isAdmin && (
        <nav className="admin-bar">
          {[
            { id: 'dashboard', label: 'Panel', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
            { id: 'new', label: '+Partido', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg> },
            { id: 'players', label: 'Jugadores', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg> },
            { id: 'users', label: 'Vincular', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>, badge: pendingUsers.length },
            { id: 'tools', label: 'Ops', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 005 19.07M21 12a9 9 0 01-9 9M12 3a9 9 0 019 9"/></svg> },
            { id: 'allRatings', label: 'Historial', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
          ].map(item => (
            <button
              key={item.id}
              className={`admin-bar-btn ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge > 0 && <span className="admin-menu-badge">{item.badge}</span>}
            </button>
          ))}
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
          weeklyHistory={getWeeklyWinners(8)}
          monthlyHistory={getMonthlyWinners()}
          announcements={announcements}
          playerFormMap={playerFormMap}
        />
      )}

      {/* Ratings Tab */}
      {activeTab === 'ratings' && <RatingsTab getRatingClass={getRatingClass} />}

      {/* Matches Tab */}
      {activeTab === 'matches' && (
        <MatchesTab
          onOpenRatingModal={openRatingModal}
          onOpenEditMatch={(match) => { matchBuilder.openEditMatch(match); setActiveTab('new') }}
          onDeleteMatch={handleDeleteMatch}
          onToggleRatings={toggleMatchRatings}
          onOpenPrediction={openPredictionModal}
          canPredictMatch={canPredictMatch}
          triggerMVPConfetti={triggerMVPConfetti}
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <section className="stats-section analytics-section">
          <div className="analytics-header">
            <h2 className="section-title">Análisis Avanzado</h2>
            <div className="analytics-stats-strip">
              {analyticsOverview.map(item => (
                <div key={item.id} className="ast-pill" onClick={() => {
                  if (item.id === 'records') setAnalyticsView('records')
                  if (item.id === 'roles') setAnalyticsView('roles')
                }}>
                  <span className="ast-icon"><AppIcon name={item.icon} size={13} /></span>
                  <span className="ast-value">{item.value}</span>
                  <span className="ast-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="analytics-subtabs">
            {[
              { id: 'teams', label: 'Equipos', icon: 'users' },
              { id: 'roles', label: 'Roles', icon: 'target' },
              { id: 'records', label: 'Récords', icon: 'trophy' },
              { id: 'progress', label: 'Forma', icon: 'arrowUp' },
              { id: 'compare', label: 'Comparar', icon: 'profile' },
            ].map(item => (
              <button
                key={item.id}
                className={`analytics-subtab ${analyticsView === item.id ? 'active' : ''}`}
                onClick={() => setAnalyticsView(item.id)}
              >
                <AppIcon name={item.icon} size={13} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
          
          {/* Best Duos & Trios */}
          {analyticsView === 'teams' && (() => {
            // Calculate duo and trio stats
            const duoStats = {}
            const trioStats = {}
            
            matches.forEach(m => {
              if (m.winner !== 'white' && m.winner !== 'black' && m.winner !== 'tie') return
              
              const processTeam = (team, won) => {
                if (!team || team.length < 2) return
                
                // Duos
                for (let i = 0; i < team.length; i++) {
                  for (let j = i + 1; j < team.length; j++) {
                    const key = [team[i], team[j]].sort().join('_')
                    if (!duoStats[key]) duoStats[key] = { ids: [team[i], team[j]], wins: 0, ties: 0, games: 0 }
                    duoStats[key].games++
                    if (won) duoStats[key].wins++
                    if (m.winner === 'tie') duoStats[key].ties++
                  }
                }
                
                // Trios
                if (team.length >= 3) {
                  for (let i = 0; i < team.length; i++) {
                    for (let j = i + 1; j < team.length; j++) {
                      for (let k = j + 1; k < team.length; k++) {
                        const key = [team[i], team[j], team[k]].sort().join('_')
                        if (!trioStats[key]) trioStats[key] = { ids: [team[i], team[j], team[k]], wins: 0, ties: 0, games: 0 }
                        trioStats[key].games++
                        if (won) trioStats[key].wins++
                        if (m.winner === 'tie') trioStats[key].ties++
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
              .map(d => {
                const decidedGames = d.games - (d.ties || 0)
                const winRate = decidedGames > 0 ? Math.round((d.wins / decidedGames) * 100) : 0
                return { ...d, winRate }
              })
              .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
              .slice(0, 5)

            const topTrios = Object.values(trioStats)
              .filter(t => t.games >= 2)
              .map(t => {
                const decidedGames = t.games - (t.ties || 0)
                const winRate = decidedGames > 0 ? Math.round((t.wins / decidedGames) * 100) : 0
                return { ...t, winRate }
              })
              .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
              .slice(0, 5)
            
            if (topDuos.length === 0 && topTrios.length === 0) {
              return (
                <div className="analytics-pane">
                  <div className="analytics-empty">
                    <AppIcon name="users" size={18} />
                    <span>Aún no hay suficientes partidos para calcular duplas o tríos.</span>
                  </div>
                </div>
              )
            }
            
            return (
              <div className="analytics-pane">
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
                            <span className="games">{duo.wins}V-{duo.ties || 0}E-{duo.games - duo.wins - (duo.ties || 0)}D</span>
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
                            <span className="games">{trio.wins}V-{trio.ties || 0}E-{trio.games - trio.wins - (trio.ties || 0)}D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </div>
              </div>
            )
          })()}

          {/* Position Rankings */}
          {analyticsView === 'roles' && (() => {
            const roles = Object.keys(roleRatingRankings.rankings || {})
              .filter(r => r !== 'Sin posición')
              .sort((a, b) => a.localeCompare(b))
            if (roles.length === 0) {
              return (
                <div className="analytics-pane">
                  <div className="analytics-empty">
                    <AppIcon name="target" size={18} />
                    <span>Sin suficientes datos por posición todavía.</span>
                  </div>
                </div>
              )
            }
            return (
              <div className="position-rankings analytics-pane">
                <h3 className="position-title">Ranking por Rol/Posición</h3>
                <div className="position-grid">
                  {roles.map(role => {
                    const top = roleRatingRankings.rankings[role]?.slice(0, 5) || []
                    if (top.length === 0) return null
                    return (
                      <div key={role} className="position-card">
                        <div className="position-card-title">{role}</div>
                        {top.map((entry, idx) => (
                          <div key={entry.playerId} className="position-card-row">
                            <span className="position-rank">#{idx + 1}</span>
                            <span className="position-name">{getPlayerName(entry.playerId)}</span>
                            <span className="position-metrics">
                              <AppIcon name="star" size={12} /> {entry.avgRating} · {entry.played} PJ · {entry.winRate}% WR
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {analyticsView === 'records' && (() => {
            // Compute current win streaks
            const streaks = stats.map(player => {
              const playerMatches = matches
                .filter(m => (m.teamWhite?.includes(player.id) || m.teamBlack?.includes(player.id)) && m.winner)
                .sort((a, b) => new Date(a.date) - new Date(b.date))
              let count = 0, type = null
              for (let i = playerMatches.length - 1; i >= 0; i--) {
                const m = playerMatches[i]
                const inWhite = m.teamWhite?.includes(player.id)
                const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
                const result = m.winner === 'tie' ? 'tie' : won ? 'win' : 'loss'
                if (i === playerMatches.length - 1) { type = result; count = 1 }
                else if (result === type) count++
                else break
              }
              return { id: player.id, name: player.name, count, type }
            }).filter(s => s.count >= 2).sort((a, b) => b.count - a.count)

            // Prediction accuracy
            const predAccuracy = Object.entries(userLinks)
              .filter(([, d]) => d?.playerId)
              .map(([uid, data]) => {
                let won = 0, lost = 0
                Object.entries(predictions || {}).forEach(([matchId, matchPreds]) => {
                  const pred = matchPreds?.[uid]
                  if (!pred) return
                  const match = matches.find(m => m.id === (pred.matchId || matchId))
                  if (!match?.winner) return
                  if (pred.prediction === match.winner) won++
                  else lost++
                })
                const total = won + lost
                return { playerId: data.playerId, name: getPlayerName(data.playerId), won, lost, total, pct: total > 0 ? Math.round((won / total) * 100) : null }
              })
              .filter(p => p.total >= 2)
              .sort((a, b) => (b.pct || 0) - (a.pct || 0))

            return (
              <div className="analytics-pane">
                {/* Win Streaks */}
                {streaks.length > 0 && (
                  <div className="records-section-block">
                    <h4 className="records-block-title">
                      <AppIcon name="arrowUp" size={13} /> Rachas Actuales
                    </h4>
                    <div className="streaks-list">
                      {streaks.slice(0, 6).map(s => (
                        <div key={s.id} className={`streak-item ${s.type}`}>
                          <AvatarImage
                            src={getPlayerPhoto(s.id)}
                            name={s.name}
                            imgClassName="streak-avatar"
                            fallbackClassName="streak-avatar-ph"
                          />
                          <span className="streak-name">{s.name.split(' ')[0]}</span>
                          <span className={`streak-badge ${s.type}`}>
                            {s.count} {s.type === 'win' ? 'victorias' : s.type === 'loss' ? 'derrotas' : 'empates'} seguidas
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prediction Accuracy */}
                {predAccuracy.length > 0 && (
                  <div className="records-section-block">
                    <h4 className="records-block-title">
                      <AppIcon name="coins" size={13} /> Precisión de Predicciones
                    </h4>
                    <div className="pred-accuracy-list">
                      {predAccuracy.map((p, idx) => (
                        <div key={p.playerId} className="pred-acc-row">
                          <span className="pred-acc-pos">#{idx + 1}</span>
                          <AvatarImage
                            src={getPlayerPhoto(p.playerId)}
                            name={p.name}
                            imgClassName="pred-acc-avatar"
                            fallbackClassName="pred-acc-avatar-ph"
                          />
                          <span className="pred-acc-name">{p.name.split(' ')[0]}</span>
                          <div className="pred-acc-bar-wrap">
                            <div className="pred-acc-bar" style={{ width: `${p.pct}%` }} />
                          </div>
                          <span className="pred-acc-pct">{p.pct}%</span>
                          <span className="pred-acc-record">{p.won}V-{p.lost}D</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Historical Records */}
                <div className="records-section-block">
                  <h4 className="records-block-title">
                    <AppIcon name="trophy" size={13} /> Récords Históricos
                  </h4>
                  {historicalRecords.length > 0 ? (
                    <div className="records-grid">
                      {historicalRecords.map((record, idx) => (
                        <div key={`${record.title}-${idx}`} className="record-card">
                          <div className="record-title">{record.title}</div>
                          <div className="record-value">{record.value}</div>
                          <div className="record-player">
                            {(record.playerIds || []).map(id => getPlayerName(id)).filter(Boolean).join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="analytics-empty">
                      <AppIcon name="trophy" size={18} />
                      <span>Cuando haya más historial aparecerán récords aquí.</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {analyticsView === 'progress' && (() => {
            // Build form data for every player with ≥3 played matches
            const playerForms = stats
              .filter(p => (p.played || 0) >= 3)
              .map(player => {
                const playerMatches = matches
                  .filter(m => (m.teamWhite?.includes(player.id) || m.teamBlack?.includes(player.id)) && m.winner)
                  .sort((a, b) => new Date(a.date) - new Date(b.date))

                // Last 5 results as form badges
                const last5 = playerMatches.slice(-5).map(m => {
                  const inWhite = m.teamWhite?.includes(player.id)
                  const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
                  return m.winner === 'tie' ? 'e' : won ? 'v' : 'd'
                })

                // Current win streak
                let streak = 0, streakType = null
                for (let i = playerMatches.length - 1; i >= 0; i--) {
                  const m = playerMatches[i]
                  const inWhite = m.teamWhite?.includes(player.id)
                  const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
                  const r = m.winner === 'tie' ? 'tie' : won ? 'win' : 'loss'
                  if (i === playerMatches.length - 1) { streakType = r; streak = 1 }
                  else if (r === streakType) streak++
                  else break
                }

                // Rating: avg of last 3 rated matches vs avg of previous 3
                const ratedMatches = playerMatches.filter(m =>
                  (ratings?.[player.id] || []).some(r => r.matchId === m.id)
                )
                const getAvg = (slice) => {
                  const scores = slice.flatMap(m =>
                    (ratings?.[player.id] || []).filter(r => r.matchId === m.id).map(r => r.score)
                  )
                  return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
                }
                const recentAvg = getAvg(ratedMatches.slice(-3))
                const prevAvg = getAvg(ratedMatches.slice(-6, -3))
                const ratingDelta = recentAvg !== null && prevAvg !== null ? recentAvg - prevAvg : null

                // Career average rating
                const allScores = (ratings?.[player.id] || []).map(r => r.score)
                const careerAvg = allScores.length > 0
                  ? allScores.reduce((a, b) => a + b, 0) / allScores.length
                  : null

                // Matches this month
                const now = new Date()
                const thisMonth = now.getMonth()
                const thisYear = now.getFullYear()
                const matchesThisMonth = playerMatches.filter(m => {
                  const d = new Date(m.date)
                  return d.getMonth() === thisMonth && d.getFullYear() === thisYear
                }).length

                // Category
                let category
                if (streak >= 2 && streakType === 'win') category = 'racha'
                else if (ratingDelta !== null && ratingDelta > 0.3) category = 'mejorando'
                else if (ratingDelta !== null && ratingDelta < -0.3) category = 'bajando'
                else category = 'estable'

                return { ...player, last5, streak, streakType, recentAvg, prevAvg, ratingDelta, category, careerAvg, matchesThisMonth }
              })

            const categoryOrder = { racha: 0, mejorando: 1, estable: 2, bajando: 3 }
            const grouped = {
              racha:     playerForms.filter(p => p.category === 'racha').sort((a, b) => b.streak - a.streak),
              mejorando: playerForms.filter(p => p.category === 'mejorando').sort((a, b) => (b.ratingDelta || 0) - (a.ratingDelta || 0)),
              bajando:   playerForms.filter(p => p.category === 'bajando').sort((a, b) => (a.ratingDelta || 0) - (b.ratingDelta || 0)),
              estable:   playerForms.filter(p => p.category === 'estable'),
            }

            const catConfig = {
              racha:     { emoji: '🔥', label: 'En racha', desc: 'Racha activa de victorias consecutivas', cls: 'racha' },
              mejorando: { emoji: '📈', label: 'Mejorando', desc: 'Rating subiendo vs partidos anteriores', cls: 'mejorando' },
              bajando:   { emoji: '📉', label: 'Bajando', desc: 'Rating cayendo vs partidos anteriores', cls: 'bajando' },
              estable:   { emoji: '➡️', label: 'Estable', desc: 'Rendimiento constante', cls: 'estable' },
            }

            // Summary stats
            const topStreak = playerForms.reduce((best, p) => (!best || p.streak > best.streak) ? p : best, null)

            const streakLabel = (p) => {
              if (!p.streak || !p.streakType) return null
              const typeMap = { win: 'victoria', loss: 'derrota', tie: 'empate' }
              const plural = { win: 'victorias', loss: 'derrotas', tie: 'empates' }
              const label = p.streak === 1 ? typeMap[p.streakType] : plural[p.streakType]
              return `${p.streak} ${label} seguida${p.streak === 1 ? '' : 's'}`
            }

            return (
              <div className="analytics-pane forma-pane">
                {/* Summary strip */}
                {playerForms.length > 0 && (
                  <div className="forma-summary-strip">
                    <div className="forma-sum-item">
                      <span className="forma-sum-val">{grouped.racha.length}</span>
                      <span className="forma-sum-lbl">🔥 En racha</span>
                    </div>
                    <div className="forma-sum-item">
                      <span className="forma-sum-val">{grouped.mejorando.length}</span>
                      <span className="forma-sum-lbl">📈 Mejorando</span>
                    </div>
                    <div className="forma-sum-item">
                      <span className="forma-sum-val">{grouped.bajando.length}</span>
                      <span className="forma-sum-lbl">📉 Bajando</span>
                    </div>
                    {topStreak && topStreak.streak >= 2 && (
                      <div className="forma-sum-item accent">
                        <span className="forma-sum-val">{topStreak.streak}</span>
                        <span className="forma-sum-lbl">Mejor racha ({topStreak.name.split(' ')[0]})</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Legend */}
                <div className="forma-legend">
                  <span className="forma-legend-title">Últimos 5 partidos:</span>
                  <span className="forma-legend-item"><span className="form-badge v">V</span> Victoria</span>
                  <span className="forma-legend-item"><span className="form-badge e">E</span> Empate</span>
                  <span className="forma-legend-item"><span className="form-badge d">D</span> Derrota</span>
                </div>

                {playerForms.length === 0 ? (
                  <div className="analytics-empty">
                    <AppIcon name="note" size={18} />
                    <span>Se necesitan al menos 3 partidos para calcular la forma.</span>
                  </div>
                ) : (
                  ['racha', 'mejorando', 'bajando', 'estable'].map(cat => {
                    const group = grouped[cat]
                    if (group.length === 0) return null
                    const cfg = catConfig[cat]
                    return (
                      <div key={cat} className={`forma-group ${cfg.cls}`}>
                        <div className="forma-group-header">
                          <span className="forma-group-emoji">{cfg.emoji}</span>
                          <span className="forma-group-label">{cfg.label}</span>
                          <span className="forma-group-desc">{cfg.desc}</span>
                          <span className="forma-group-count">{group.length}</span>
                        </div>
                        <div className="forma-list">
                          {group.map(player => (
                            <div key={player.id} className={`forma-row ${cfg.cls}`}>
                              <AvatarImage
                                src={getPlayerPhoto(player.id)}
                                name={player.name}
                                imgClassName="forma-avatar"
                                fallbackClassName="forma-avatar-ph"
                              />
                              <div className="forma-info">
                                <span className="forma-name">{player.name}</span>
                                <span className="forma-streak-label">{streakLabel(player)}</span>
                              </div>
                              <div className="forma-badges">
                                {player.last5.map((r, i) => (
                                  <span key={i} className={`form-badge ${r}`}>
                                    {r === 'v' ? 'V' : r === 'e' ? 'E' : 'D'}
                                  </span>
                                ))}
                              </div>
                              <div className="forma-extra">
                                {player.recentAvg !== null && (
                                  <div className="forma-rating">
                                    <span className="forma-rating-lbl">Cal. reciente</span>
                                    <span className={`forma-now ${(player.ratingDelta || 0) > 0.3 ? 'up' : (player.ratingDelta || 0) < -0.3 ? 'down' : ''}`}>
                                      {player.recentAvg.toFixed(1)}
                                      {player.ratingDelta !== null && (
                                        <span className="forma-delta">
                                          {player.ratingDelta > 0.1 ? ` ▲${player.ratingDelta.toFixed(1)}` : player.ratingDelta < -0.1 ? ` ▼${Math.abs(player.ratingDelta).toFixed(1)}` : ''}
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                )}
                                {player.careerAvg !== null && (
                                  <span className="forma-best-rating">Promedio: {player.careerAvg.toFixed(1)}</span>
                                )}
                                {player.matchesThisMonth > 0 && (
                                  <span className="forma-month-badge">{player.matchesThisMonth} este mes</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )
          })()}
          
          {/* Player Selection */}
          {analyticsView === 'compare' && (
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
          )}

          {analyticsView === 'compare' && !h2hPlayer1 && (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.5 }}>
                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
              </svg>
              <h3>Selecciona un jugador</h3>
              <p>Elige un jugador para ver su análisis o compara dos jugadores</p>
            </div>
          )}
          
          {/* H2H Comparison when both players selected */}
          {analyticsView === 'compare' && h2hPlayer1 && h2hPlayer2 && (() => {
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
            
            let sameTeamWins = 0, sameTeamTies = 0, sameTeamGames = 0
            let p1WinsAgainst = 0, p2WinsAgainst = 0, vsTies = 0, vsGames = 0
            
            h2hMatches.forEach(m => {
              const p1InWhite = m.teamWhite?.includes(h2hPlayer1)
              const p2InWhite = m.teamWhite?.includes(h2hPlayer2)
              const sameTeam = p1InWhite === p2InWhite
              const decided = m.winner === 'white' || m.winner === 'black'
              const tied = m.winner === 'tie'
              
              if (!decided && !tied) return

              if (sameTeam) {
                sameTeamGames++
                if (tied) {
                  sameTeamTies++
                } else {
                  const won = (p1InWhite && m.winner === 'white') || (!p1InWhite && m.winner === 'black')
                  if (won) sameTeamWins++
                }
              } else {
                vsGames++
                if (tied) {
                  vsTies++
                } else if (p1InWhite && m.winner === 'white') {
                  p1WinsAgainst++
                } else if (!p1InWhite && m.winner === 'black') {
                  p1WinsAgainst++
                } else {
                  p2WinsAgainst++
                }
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
                    <span className="h2h-name">{p1.name.split(' ')[0]}</span>
                  </div>

                  <div className="h2h-stats">
                    {[
                      { label: 'Win Rate', v1: p1.winRate || 0, v2: p2.winRate || 0, fmt: v => `${Math.round(v)}%`, max: 100 },
                      { label: 'Rating ★', v1: parseFloat(p1.avgRating) || 0, v2: parseFloat(p2.avgRating) || 0, fmt: v => v > 0 ? v.toFixed(1) : '-', max: 10 },
                      { label: 'MVPs', v1: p1.mvps || 0, v2: p2.mvps || 0, fmt: v => v, max: Math.max(p1.mvps || 0, p2.mvps || 0) || 1 },
                      { label: 'Partidos', v1: p1.played || 0, v2: p2.played || 0, fmt: v => v, max: Math.max(p1.played || 0, p2.played || 0) || 1 },
                    ].map(({ label, v1, v2, fmt, max }) => {
                      const total = v1 + v2
                      const pct1 = total > 0 ? Math.round((v1 / total) * 100) : 50
                      const pct2 = 100 - pct1
                      const w1 = v1 > v2
                      const w2 = v2 > v1
                      return (
                        <div key={label} className="h2h-bar-row">
                          <span className={`h2h-bar-val left ${w1 ? 'winner' : ''}`}>{fmt(v1)}</span>
                          <div className="h2h-bar-track">
                            <div className={`h2h-bar-fill left ${w1 ? 'win' : ''}`} style={{ width: `${pct1}%` }} />
                            <span className="h2h-bar-label">{label}</span>
                            <div className={`h2h-bar-fill right ${w2 ? 'win' : ''}`} style={{ width: `${pct2}%` }} />
                          </div>
                          <span className={`h2h-bar-val right ${w2 ? 'winner' : ''}`}>{fmt(v2)}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="h2h-player">
                    <div className="h2h-avatar">
                      <AvatarImage src={getPlayerPhoto(h2hPlayer2)} name={p2.name} />
                    </div>
                    <span className="h2h-name">{p2.name.split(' ')[0]}</span>
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
                          <span className="hrc-value">{sameTeamWins}V - {sameTeamTies}E - {sameTeamGames - sameTeamWins - sameTeamTies}D</span>
                          <span className="hrc-percent">{Math.round((sameTeamWins / Math.max(1, sameTeamGames - sameTeamTies)) * 100)}% WR</span>
                        </div>
                      )}
                      {vsGames > 0 && (
                        <div className="h2h-record-card versus">
                          <span className="hrc-title">Enfrentados</span>
                          <span className="hrc-value">{p1.name?.split(' ')[0]}: {p1WinsAgainst} | {p2.name?.split(' ')[0]}: {p2WinsAgainst}</span>
                          <span className="hrc-percent">{vsGames} partidos · {vsTies} Empates</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {analyticsView === 'compare' && h2hPlayer1 && (() => {
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
                const result = m.winner === 'tie' ? 'tie' : won ? 'win' : 'loss'
                return {
                  date: m.date,
                  avgScore: typeof avgScore === 'number' ? avgScore.toFixed(1) : '0.0',
                  result,
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
                        <div key={idx} className={`match-history-item ${m.result}`}>
                          <div className="mhi-left">
                            <span className={`mhi-result ${m.result}`}>
                              {m.result === 'win' ? 'V' : m.result === 'tie' ? 'E' : 'D'}
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
        <StoreTab
          lukCoins={lukCoins}
          onSpendLukCoins={spendLukCoins}
        />
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
                          <AppIcon name="close" size={14} />
                        </button>
                        <button 
                          className="delete-user-btn" 
                          onClick={() => adminDeleteUser(odedBy, data.userName || data.userEmail)}
                          title="Eliminar cuenta"
                        >
                          <AppIcon name="trash" size={14} />
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
        <MatchBuilderTab mb={matchBuilder} />
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
              <div className="dash-stat-icon"><AppIcon name="users" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{Object.keys(userLinks).length}</span>
                <span className="dash-stat-label">Usuarios</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-icon"><AppIcon name="ball" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{matches.length}</span>
                <span className="dash-stat-label">Partidos</span>
              </div>
            </div>
            <div className="dash-stat-card accent">
              <div className="dash-stat-icon"><AppIcon name="star" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">
                  {Object.values(ratings).reduce((sum, r) => sum + r.length, 0)}
                </span>
                <span className="dash-stat-label">Calificaciones</span>
              </div>
            </div>
            <div className="dash-stat-card warning">
              <div className="dash-stat-icon"><AppIcon name="info" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{pendingUsers.length}</span>
                <span className="dash-stat-label">Pendientes</span>
              </div>
            </div>
          </div>

          {/* Ops Metrics */}
          <div className="dashboard-ops-grid">
            <div className="dash-stat-card">
              <div className="dash-stat-icon"><AppIcon name="calendar" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{matchesLast7.length}</span>
                <span className="dash-stat-label">Partidos (7 días)</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-icon"><AppIcon name="note" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{ratingsLast7.length}</span>
                <span className="dash-stat-label">Ratings (7 días)</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-icon"><AppIcon name="coins" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{predictionsLast7.length}</span>
                <span className="dash-stat-label">Predicciones (7 días)</span>
              </div>
            </div>
            <div className="dash-stat-card">
              <div className="dash-stat-icon"><AppIcon name="check" size={18} /></div>
              <div className="dash-stat-info">
                <span className="dash-stat-value">{activeUsersLast7.size}</span>
                <span className="dash-stat-label">Usuarios activos</span>
              </div>
            </div>
          </div>

          <div className="dashboard-layout">
            <div className="dashboard-main-column">
              {/* Alerts */}
              <div className="dashboard-alerts">
                <h3 className="dash-section-title">Alertas Operativas</h3>
                {alerts.length === 0 ? (
                  <p className="no-data-text">Sin alertas recientes</p>
                ) : (
                  <div className="alert-list">
                    {alerts.map((alert, idx) => (
                      <div key={idx} className={`alert-item ${alert.level}`}>
                        <span>{alert.message}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                            {match.teamWhite?.length || 0} vs {match.teamBlack?.length || 0}
                          </span>
                          <span className={`recent-match-winner ${match.winner || 'pending'}`}>
                            {match.winner === 'white'
                              ? 'Blanco'
                              : match.winner === 'black'
                                ? 'Negro'
                                : match.winner === 'tie'
                                  ? 'Empate'
                                  : 'Por jugar'}
                          </span>
                        </div>
                        <div className="recent-match-stats">
                          <span className="recent-match-ratings"><AppIcon name="star" size={12} /> {matchRatingsCount}</span>
                          <span className={`recent-match-status ${match.ratingsOpen !== false ? 'open' : 'closed'}`}>
                            {match.ratingsOpen !== false ? 'Abierto' : 'Cerrado'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Activity Logs */}
              <div className="dashboard-activity">
                <h3 className="dash-section-title">Actividad Reciente</h3>
                <div className="activity-list compact">
                  {activityLogs.slice(0, 12).map(log => (
                    <div key={log.id} className="activity-item">
                      <span className="activity-type">{LOG_TYPE_LABELS[log.type] || log.type}</span>
                      <span className="activity-meta">{log.userEmail?.split('@')[0] || log.userName || 'Sistema'}</span>
                      <span className="activity-time">
                        {new Date(log.timestamp).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <aside className="dashboard-side-column">
              {/* Quick Actions */}
              <div className="dashboard-quick-actions">
                <h3 className="dash-section-title">Acciones Rápidas</h3>
                <div className="quick-actions-grid">
                  <button className="quick-action-btn" onClick={() => setActiveTab('new')}>
                    <span className="qa-icon"><AppIcon name="plus" size={14} /></span>
                    <span>Nuevo Partido</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('players')}>
                    <span className="qa-icon"><AppIcon name="profile" size={14} /></span>
                    <span>Jugadores</span>
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('users')}>
                    <span className="qa-icon"><AppIcon name="link" size={14} /></span>
                    <span>Vincular</span>
                    {pendingUsers.length > 0 && <span className="qa-badge">{pendingUsers.length}</span>}
                  </button>
                  <button className="quick-action-btn" onClick={() => setActiveTab('tools')}>
                    <span className="qa-icon"><AppIcon name="settings" size={14} /></span>
                    <span>Herramientas</span>
                  </button>
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
            </aside>
          </div>
        </section>
      )}

      {/* Admin: Tools Tab */}
      {activeTab === 'tools' && isAdmin && (
        <section className="stats-section tools-section">
          <h2 className="section-title">Operaciones y Moderación</h2>

          <div className="tools-grid">

            <div className="tools-category-header">
              <span className="tools-cat-icon"><AppIcon name="users" size={14} /></span>
              Usuarios &amp; Acceso
            </div>

            {/* Gestionar Admins */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="crown" size={16} /></span>
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

            {/* Moderación Rápida */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="shield" size={16} /></span>
                <h3 className="tool-title">Moderación Rápida</h3>
              </div>
              <p className="tool-desc">Bloquear, desvincular o limpiar predicciones</p>
              <div className="moderation-form">
                <select
                  className="block-user-select"
                  value={moderationUserId}
                  onChange={e => setModerationUserId(e.target.value)}
                >
                  <option value="">Seleccionar usuario...</option>
                  {Object.entries(userLinks).map(([uid, data]) => (
                    <option key={uid} value={uid}>{data.userName || data.userEmail}</option>
                  ))}
                </select>
                <div className="moderation-actions">
                  <button
                    className="block-btn"
                    onClick={() => {
                      if (!moderationUserId) return
                      if (blockedUsers.includes(moderationUserId)) {
                        unblockUser(moderationUserId)
                      } else {
                        blockUser(moderationUserId)
                      }
                    }}
                  >
                    {blockedUsers.includes(moderationUserId) ? 'Desbloquear' : 'Bloquear'}
                  </button>
                  <button
                    className="block-btn secondary"
                    onClick={() => removeUserPredictions(moderationUserId)}
                  >
                    Borrar predicciones
                  </button>
                  <button
                    className="block-btn secondary"
                    onClick={() => unlinkUser(moderationUserId)}
                  >
                    Desvincular
                  </button>
                </div>
              </div>
              {blockedUsers.length > 0 ? (
                <div className="blocked-list">
                  {blockedUsers.map(userId => {
                    const userLink = Object.values(userLinks).find(l => l.odedBy === userId)
                    return (
                      <div key={userId} className="blocked-item">
                        <span>{userLink?.userName || userLink?.userEmail || userId}</span>
                        <button className="unblock-btn" onClick={() => unblockUser(userId)}>Desbloquear</button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="no-data-text">Sin bloqueados</p>
              )}
            </div>

            {/* LukCoins Management — Super Admin only */}
            {SUPER_ADMIN_EMAIL && user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
              <div className="tool-card wide">
                <div className="tool-header">
                  <span className="tool-icon">🪙</span>
                  <h3 className="tool-title">Gestión de LukCoins</h3>
                </div>
                <p className="tool-desc">Ajustar saldo de cualquier jugador vinculado</p>

                {/* Balance overview */}
                <div className="lc-balance-list lc-balance-list-grid">
                  {Object.entries(userLinks)
                    .filter(([, d]) => d?.playerId)
                    .sort((a, b) => calculateLukCoins(b[1].playerId) - calculateLukCoins(a[1].playerId))
                    .map(([uid, data]) => {
                      const pid = data.playerId
                      const pStats = stats.find(s => s.id === pid)
                      if (!pStats) return null
                      const balance = calculateLukCoins(pid)
                      const adj = data.lukcoinsAdjustment || 0
                      const isExpanded = expandedLcUserId === uid
                      const breakdown = isExpanded ? getLCBreakdown(pid) : null
                      return (
                        <div key={uid} className="lc-bal-row-wrap">
                          <button
                            className={`lc-bal-row ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => setExpandedLcUserId(isExpanded ? null : uid)}
                          >
                            <div className="lc-bal-info">
                              {data.userPhoto && <img src={data.userPhoto} alt="" className="lc-bal-avatar" />}
                              <div>
                                <span className="lc-bal-name">{data.userName || data.userEmail?.split('@')[0]}</span>
                                <span className="lc-bal-player">{getPlayerName(pid)}</span>
                              </div>
                            </div>
                            <div className="lc-bal-right">
                              {adj !== 0 && <span className={`lc-bal-adj ${adj > 0 ? 'pos' : 'neg'}`}>{adj > 0 ? '+' : ''}{adj}</span>}
                              <span className="lc-bal-total">{balance} LC</span>
                              <span className="lc-bal-chevron">{isExpanded ? '▲' : '▼'}</span>
                            </div>
                          </button>
                          {isExpanded && breakdown && (
                            <div className="lc-bal-breakdown">
                              <div className="lc-bd-row">
                                <span>Participar ({breakdown.played} partidos)</span>
                                <span className="lc-bd-val pos">+{breakdown.playedLC}</span>
                              </div>
                              <div className="lc-bd-row">
                                <span>Victorias ({breakdown.wins})</span>
                                <span className="lc-bd-val pos">+{breakdown.winLC}</span>
                              </div>
                              <div className="lc-bd-row">
                                <span>MVPs ({breakdown.mvps})</span>
                                <span className="lc-bd-val pos">+{breakdown.mvpLC}</span>
                              </div>
                              {breakdown.ratedCount > 0 && (
                                <div className="lc-bd-row">
                                  <span>Calificar ({breakdown.ratedCount} partidos)</span>
                                  <span className="lc-bd-val pos">+{breakdown.ratedLC}</span>
                                </div>
                              )}
                              {breakdown.predWon > 0 && (
                                <div className="lc-bd-row">
                                  <span>Predicciones ganadas</span>
                                  <span className="lc-bd-val pos">+{breakdown.predWon}</span>
                                </div>
                              )}
                              {breakdown.predLost > 0 && (
                                <div className="lc-bd-row">
                                  <span>Predicciones perdidas</span>
                                  <span className="lc-bd-val neg">-{breakdown.predLost}</span>
                                </div>
                              )}
                              {breakdown.predPending > 0 && (
                                <div className="lc-bd-row">
                                  <span>En espera (apostado)</span>
                                  <span className="lc-bd-val neg">-{breakdown.predPending}</span>
                                </div>
                              )}
                              {breakdown.spent > 0 && (
                                <div className="lc-bd-row">
                                  <span>Gastado en tienda</span>
                                  <span className="lc-bd-val neg">-{breakdown.spent}</span>
                                </div>
                              )}
                              {breakdown.adjustment !== 0 && (
                                <div className="lc-bd-row">
                                  <span>Ajuste admin</span>
                                  <span className={`lc-bd-val ${breakdown.adjustment > 0 ? 'pos' : 'neg'}`}>{breakdown.adjustment > 0 ? '+' : ''}{breakdown.adjustment}</span>
                                </div>
                              )}
                              <div className="lc-bd-total">
                                <span>Total disponible</span>
                                <span>{balance} LC</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })
                    .filter(Boolean)
                  }
                </div>

                {/* Adjust form */}
                <div className="lc-adjust-form">
                  <select
                    value={lcAdjustUserId}
                    onChange={e => setLcAdjustUserId(e.target.value)}
                    className="block-user-select"
                  >
                    <option value="">Seleccionar usuario...</option>
                    {Object.entries(userLinks)
                      .filter(([, d]) => d?.playerId)
                      .map(([uid, data]) => (
                        <option key={uid} value={uid}>
                          {data.userName || data.userEmail} — {getPlayerName(data.playerId)}
                        </option>
                      ))
                    }
                  </select>
                  <div className="lc-adjust-inputs">
                    <input
                      type="number"
                      placeholder="Cantidad (+ o -)"
                      value={lcAdjustAmount}
                      onChange={e => setLcAdjustAmount(e.target.value)}
                      className="lc-amount-input"
                    />
                    <input
                      type="text"
                      placeholder="Motivo (opcional)"
                      value={lcAdjustReason}
                      onChange={e => setLcAdjustReason(e.target.value)}
                      className="lc-reason-input"
                    />
                  </div>
                  <div className="lc-adjust-actions">
                    <button
                      className="block-btn"
                      disabled={!lcAdjustUserId || !lcAdjustAmount}
                      onClick={async () => {
                        await adjustLukCoins(lcAdjustUserId, lcAdjustAmount, lcAdjustReason)
                        setLcAdjustAmount('')
                        setLcAdjustReason('')
                      }}
                    >
                      Aplicar ajuste
                    </button>
                    {lcAdjustUserId && (userLinks[lcAdjustUserId]?.lukcoinsAdjustment || 0) !== 0 && (
                      <button
                        className="block-btn secondary"
                        onClick={async () => {
                          const linkRef = doc(db, 'userLinks', lcAdjustUserId)
                          await updateDoc(linkRef, { lukcoinsAdjustment: 0 })
                          await logActivity('lukcoins_reset', { userId: lcAdjustUserId })
                          showToast('success', 'Ajuste reiniciado a 0')
                        }}
                      >
                        Resetear ajuste
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Rating Restrictions */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="star" size={16} /></span>
                <h3 className="tool-title">Restricciones de Calificación</h3>
              </div>
              <p className="tool-desc">Impedir que un usuario califique en general o en un partido específico</p>

              <div className="rating-restrict-form">
                <select
                  value={ratingBlockUserId}
                  onChange={e => setRatingBlockUserId(e.target.value)}
                  className="block-user-select"
                >
                  <option value="">Seleccionar usuario...</option>
                  {Object.entries(userLinks).map(([uid, data]) => (
                    <option key={uid} value={uid}>{data.userName || data.userEmail}</option>
                  ))}
                </select>

                <select
                  value={ratingBlockMatchId}
                  onChange={e => setRatingBlockMatchId(e.target.value)}
                  className="block-user-select"
                >
                  <option value="">Bloquear en todos los partidos</option>
                  {matches.slice(-10).reverse().map(match => (
                    <option key={match.id} value={match.id}>
                      {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      {' — '}
                      {match.teamWhite?.length ?? 0}v{match.teamBlack?.length ?? 0}
                    </option>
                  ))}
                </select>

                <div className="moderation-actions">
                  <button
                    className="block-btn"
                    disabled={!ratingBlockUserId}
                    onClick={() => blockRating(ratingBlockUserId, ratingBlockMatchId || null)}
                  >
                    Bloquear calificación
                  </button>
                  <button
                    className="block-btn secondary"
                    disabled={!ratingBlockUserId}
                    onClick={() => unblockRating(ratingBlockUserId, ratingBlockMatchId || null)}
                  >
                    Restaurar acceso
                  </button>
                </div>
              </div>

              {/* Currently restricted users */}
              {(ratingRestrictions?.users?.length > 0 || Object.values(ratingRestrictions?.perMatch || {}).some(arr => arr.length > 0)) && (
                <div className="blocked-list">
                  {(ratingRestrictions?.users || []).map(uid => {
                    const data = userLinks[uid]
                    return (
                      <div key={uid} className="blocked-item">
                        <span>{data?.userName || data?.userEmail || uid}</span>
                        <span className="blocked-tag">General</span>
                        <button className="unblock-btn" onClick={() => unblockRating(uid, null)}>Restaurar</button>
                      </div>
                    )
                  })}
                  {Object.entries(ratingRestrictions?.perMatch || {}).flatMap(([matchId, uids]) =>
                    uids.map(uid => {
                      const data = userLinks[uid]
                      const match = matches.find(m => m.id === matchId)
                      return (
                        <div key={`${matchId}-${uid}`} className="blocked-item">
                          <span>{data?.userName || uid}</span>
                          <span className="blocked-tag">
                            {match ? new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : matchId.slice(-4)}
                          </span>
                          <button className="unblock-btn" onClick={() => unblockRating(uid, matchId)}>Restaurar</button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>

            <div className="tools-category-header">
              <span className="tools-cat-icon"><AppIcon name="ball" size={14} /></span>
              Partidos &amp; Calificaciones
            </div>

            {/* Gestionar Partidos */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="ball" size={16} /></span>
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
                      onClick={() => toggleMatchRatings(match.id, match.ratingsOpen !== false)}
                    >
                      {match.ratingsOpen !== false ? 'Abierto' : 'Cerrado'}
                    </button>
                    {match.winner && (
                      <button
                        className="match-toggle-btn"
                        onClick={async () => {
                          const confirmed = await askConfirmation({
                            title: 'Quitar ganador',
                            message: '¿Quitar el ganador para reabrir predicciones de este partido?',
                            confirmText: 'Quitar ganador',
                            tone: 'warning',
                          })
                          if (!confirmed) return
                          await updateDoc(doc(db, 'matches', match.id), { winner: '' })
                          await logActivity('match_reopen', { matchId: match.id })
                          showToast('success', 'Ganador eliminado')
                        }}
                      >
                        Quitar ganador
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Eliminar Calificaciones */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="trash" size={16} /></span>
                <h3 className="tool-title">Eliminar Calificaciones</h3>
              </div>
              <p className="tool-desc">Borrar todas las calificaciones de un partido</p>
              <select
                className="delete-ratings-select"
                onChange={async e => {
                  const matchId = e.target.value
                  if (!matchId) return
                  const match = matches.find(m => m.id === matchId)
                  const dateStr = match ? new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : matchId
                  const ratingCount = Object.values(ratings).flat().filter(r => r.matchId === matchId).length
                  const confirmed = await askConfirmation({
                    title: 'Eliminar calificaciones',
                    message: `¿Eliminar las ${ratingCount} calificaciones del partido del ${dateStr}? Esta acción no se puede deshacer.`,
                    confirmText: 'Eliminar',
                    tone: 'danger',
                  })
                  if (confirmed) await handleBulkDeleteRatings(matchId)
                  e.target.value = ''
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

            <div className="tools-category-header">
              <span className="tools-cat-icon"><AppIcon name="settings" size={14} /></span>
              Sistema &amp; Configuración
            </div>

            {/* Configuración Liga */}
            <div className="tool-card">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="settings" size={16} /></span>
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
                <span className="tool-icon"><AppIcon name="download" size={16} /></span>
                <h3 className="tool-title">Exportar Datos</h3>
              </div>
              <p className="tool-desc">Exporta por rango de fechas</p>
              <div className="export-range">
                <label>
                  <span>Desde</span>
                  <input
                    type="date"
                    value={adminExportStart}
                    onChange={e => setAdminExportStart(e.target.value)}
                  />
                </label>
                <label>
                  <span>Hasta</span>
                  <input
                    type="date"
                    value={adminExportEnd}
                    onChange={e => setAdminExportEnd(e.target.value)}
                  />
                </label>
              </div>
              <div className="export-buttons">
                <button className="export-btn" onClick={async () => {
                  const { start, end } = getExportRange()
                  const filteredMatches = matches.filter(m => {
                    const d = new Date(m.date)
                    return (!start || d >= start) && (!end || d <= end)
                  })
                  const data = { players, matches: filteredMatches, userLinks, exportedAt: new Date().toISOString() }
                  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `lukto-matches-${new Date().toISOString().split('T')[0]}.json`
                  a.click()
                  await logActivity('export', { type: 'matches', start: adminExportStart, end: adminExportEnd })
                  showToast('success', 'Partidos exportados')
                }}>
                  Partidos
                </button>
                <button className="export-btn" onClick={async () => {
                  const { start, end } = getExportRange()
                  const filteredRatings = ratingsList.filter(r => {
                    const match = matchById.get(r.matchId)
                    const d = match ? new Date(match.date) : new Date(r.timestamp)
                    return (!start || d >= start) && (!end || d <= end)
                  })
                  const blob = new Blob([JSON.stringify(filteredRatings, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `lukto-ratings-${new Date().toISOString().split('T')[0]}.json`
                  a.click()
                  await logActivity('export', { type: 'ratings', start: adminExportStart, end: adminExportEnd })
                  showToast('success', 'Ratings exportados')
                }}>
                  Ratings
                </button>
                <button className="export-btn" onClick={async () => {
                  const { start, end } = getExportRange()
                  const filteredPredictions = predictionsList.filter(p => {
                    const d = p.timestamp ? new Date(p.timestamp) : new Date()
                    return (!start || d >= start) && (!end || d <= end)
                  })
                  const blob = new Blob([JSON.stringify(filteredPredictions, null, 2)], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `lukto-predictions-${new Date().toISOString().split('T')[0]}.json`
                  a.click()
                  await logActivity('export', { type: 'predictions', start: adminExportStart, end: adminExportEnd })
                  showToast('success', 'Predicciones exportadas')
                }}>
                  Predicciones
                </button>
              </div>
            </div>

            {/* Logs de actividad */}
            <div className="tool-card wide">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="receipt" size={16} /></span>
                <h3 className="tool-title">Logs de Actividad</h3>
              </div>
              <p className="tool-desc">Últimos eventos del sistema</p>
              <div className="activity-list compact">
                {activityLogs.slice(0, 20).map(log => (
                  <div key={log.id} className="activity-item">
                    <span className="activity-type">{LOG_TYPE_LABELS[log.type] || log.type}</span>
                    <span className="activity-meta">{log.userEmail?.split('@')[0] || log.userName || 'Sistema'}</span>
                    <span className="activity-time">
                      {new Date(log.timestamp).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Anuncios */}
            <div className="tool-card wide">
              <div className="tool-header">
                <span className="tool-icon"><AppIcon name="megaphone" size={16} /></span>
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
                  await logActivity('announcement_create', { message })
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
                        await logActivity('announcement_delete', { id: a.id, message: a.message })
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

          <div className="all-ratings-search-bar">
            <AppIcon name="search" size={15} />
            <input
              className="all-ratings-search-input"
              placeholder="Buscar por jugador o calificador..."
              value={allRatingsSearch}
              onChange={e => setAllRatingsSearch(e.target.value)}
            />
            {allRatingsSearch && (
              <button className="all-ratings-search-clear" onClick={() => setAllRatingsSearch('')}>×</button>
            )}
          </div>

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

              // Filter by search
              const q = allRatingsSearch.toLowerCase()
              if (q) {
                const matchesQuery = matchRatings.some(r =>
                  r.raterName?.toLowerCase().includes(q) ||
                  r.ratedPlayerName?.toLowerCase().includes(q) ||
                  r.raterEmail?.toLowerCase().includes(q)
                )
                if (!matchesQuery) return null
              }

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
                        {match.teamWhite?.length || 0} vs {match.teamBlack?.length || 0} • {match.venue}
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
                          {user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
                            <button
                              className="btn-icon btn-danger-ghost history-rater-delete"
                              title="Eliminar calificaciones de este usuario en este partido"
                              onClick={() => deleteRaterRatingsForMatch(raterId, raterData.raterName, match.id)}
                            >
                              <AppIcon name="trash" size={14} />
                            </button>
                          )}
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

      {/* Global Search Modal */}
      {showGlobalSearch && (
        <div className="modal-overlay" onClick={closeGlobalSearch}>
          <LiquidGlass
            className="modal global-search-modal modal-glass"
            displacementScale={35}
            blurAmount={0.04}
            saturation={150}
            aberrationIntensity={1.5}
            elasticity={0.1}
            cornerRadius={20}
            onClick={e => e.stopPropagation()}
          >
            <div className="global-search-input-wrap">
              <AppIcon name="search" size={16} className="global-search-icon" />
              <input
                ref={globalSearchInputRef}
                className="global-search-input"
                placeholder="Buscar jugador, partido o sección..."
                value={globalSearchQuery}
                onChange={e => setGlobalSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && globalSearchResults[0]) {
                    handleGlobalSearchSelect(globalSearchResults[0])
                  }
                }}
              />
              <button className="global-search-close" onClick={closeGlobalSearch}>
                <AppIcon name="close" size={14} />
              </button>
            </div>
            <p className="global-search-hint">Tip: usa Cmd/Ctrl + K para abrir esta búsqueda</p>
            <div className="global-search-results">
              {globalSearchResults.length > 0 ? globalSearchResults.map(item => (
                <button
                  key={item.id}
                  className={`global-search-item ${item.type}`}
                  onClick={() => handleGlobalSearchSelect(item)}
                >
                  <span className="global-search-item-icon">
                    <AppIcon
                      name={item.type === 'player' ? 'profile' : item.type === 'match' ? 'ball' : 'note'}
                      size={14}
                    />
                  </span>
                  <span className="global-search-item-text">
                    <span className="global-search-item-title">{item.title}</span>
                    <span className="global-search-item-subtitle">{item.subtitle}</span>
                  </span>
                </button>
              )) : (
                <div className="global-search-empty">Sin resultados para "{globalSearchQuery}"</div>
              )}
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog.open && (
        <div className="modal-overlay" onClick={() => resolveConfirmation(false)}>
          <div className="modal confirm-action-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{confirmDialog.title}</h2>
              <button className="modal-close" onClick={() => resolveConfirmation(false)}>×</button>
            </div>
            <p className="confirm-action-message">{confirmDialog.message}</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => resolveConfirmation(false)}>
                {confirmDialog.cancelText}
              </button>
              <button
                className={`submit-btn confirm-action-btn ${confirmDialog.tone === 'warning' ? 'warning' : 'danger'}`}
                onClick={() => resolveConfirmation(true)}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
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
        positionAnalytics={positionAnalytics}
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
            <div className="modal-actions">
              <button className="cancel-btn" onClick={closePlayerModal}>Cancelar</button>
              <button className="submit-btn" onClick={handleAddPlayer}>
                {editingPlayerId ? 'Guardar Cambios' : 'Crear Jugador'}
              </button>
            </div>
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
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                          const rated = currentRatings[playerId] !== undefined
                          const isActive = rated && (score === 0 ? currentRatings[playerId] === 0 : currentRatings[playerId] >= score)
                          return (
                            <button
                              key={score}
                              className={`star-btn ${isActive ? 'active' : ''} ${score === 0 ? 'zero' : ''}`}
                              onClick={() => handleRatingChange(playerId, score)}
                            >
                              {score}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button className="cancel-btn" onClick={closeRatingModal}>
                    Cancelar
                  </button>
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

      {showMatchXpModal && matchXpData && (
        <div className="modal-overlay" onClick={closeMatchXpModal}>
          <div className="modal xp-reward-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>XP del Partido</h2>
              <button className="modal-close" onClick={closeMatchXpModal}>×</button>
            </div>
            <p className="modal-subtitle">
              {formatDate(matchXpData.match.date)} - {matchXpData.match.venue || 'LUKTO'}
            </p>
            <div className="xp-reward-summary">
              <div className="xp-reward-row">
                <span>Participación</span>
                <strong>+{matchXpData.breakdown.participation}</strong>
              </div>
              <div className="xp-reward-row">
                <span>Victoria</span>
                <strong>+{matchXpData.breakdown.win}</strong>
              </div>
              <div className="xp-reward-row">
                <span>
                  Rating{matchXpData.breakdown.ratingAvg === null ? ' (sin calificaciones)' : ` (${matchXpData.breakdown.ratingAvg.toFixed(1)})`}
                </span>
                <strong>+{matchXpData.breakdown.rating}</strong>
              </div>
              <div className="xp-reward-row">
                <span>MVP</span>
                <strong>+{matchXpData.breakdown.mvp}</strong>
              </div>
              <div className="xp-reward-row">
                <span>XP base</span>
                <strong>+{matchXpData.baseXp}</strong>
              </div>
              {matchXpData.bonusXp > 0 && (
                <div className="xp-reward-row bonus">
                  <span>Bonus x{matchXpData.multiplier}</span>
                  <strong>+{matchXpData.bonusXp}</strong>
                </div>
              )}
              <div className="xp-reward-total">
                <span>Total</span>
                <strong>+{matchXpData.totalXp} XP</strong>
              </div>
            </div>
            <button className="submit-btn" onClick={closeMatchXpModal}>
              OK
            </button>
          </div>
        </div>
      )}


      {/* Prediction Modal */}
      {showPredictionModal && predictionMatch && (() => {
        const probability = calculateTeamProbability(predictionMatch)
        const favorite = probability.white > probability.black ? 'white' : probability.black > probability.white ? 'black' : 'tie'
        const poolTotals = getPoolTotalsForMatch(predictionMatch.id)
        const totalWhite = poolTotals.totalWhite
        const totalBlack = poolTotals.totalBlack
        const selectedPool = selectedPrediction === 'white' ? totalWhite + coinBet : selectedPrediction === 'black' ? totalBlack + coinBet : 0
        const rivalPool = selectedPrediction === 'white' ? totalBlack : selectedPrediction === 'black' ? totalWhite : 0
        const potentialWin = selectedPrediction ? getPoolPotentialWin(predictionMatch.id, selectedPrediction, coinBet) : 0
        const allPredictionPlayers = [...(predictionMatch.teamWhite || []), ...(predictionMatch.teamBlack || [])]
        
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

              {/* Context Card: Probability + Stats + Favorite */}
              <div className="pm-context-card">
                <div className="pm-prob-bar-wrap">
                  <div className="pm-prob-bar">
                    <div className="pm-prob-fill white" style={{ width: `${probability.white}%` }}>
                      <span className="pm-prob-label">Blanco · {probability.white}%</span>
                    </div>
                    <div className="pm-prob-fill black" style={{ width: `${probability.black}%` }}>
                      <span className="pm-prob-label">{probability.black}% · Negro</span>
                    </div>
                  </div>
                  {favorite !== 'tie' && (
                    <span className={`pm-fav-chip ${favorite}`}>
                      ★ Favorito: Equipo {favorite === 'white' ? 'Blanco' : 'Negro'}
                    </span>
                  )}
                </div>
                <div className="pm-stats-row">
                  <div className="pm-stat">
                    <span className="pm-stat-left">{probability.whiteStats.avgWinRate.toFixed(0)}%</span>
                    <span className="pm-stat-name">Win Rate</span>
                    <span className="pm-stat-right">{probability.blackStats.avgWinRate.toFixed(0)}%</span>
                  </div>
                  <div className="pm-stat">
                    <span className="pm-stat-left">{probability.whiteStats.avgRating.toFixed(1)}</span>
                    <span className="pm-stat-name">Rating</span>
                    <span className="pm-stat-right">{probability.blackStats.avgRating.toFixed(1)}</span>
                  </div>
                  <div className="pm-stat">
                    <span className="pm-stat-left">{probability.whiteStats.recentForm.toFixed(0)}%</span>
                    <span className="pm-stat-name">Forma</span>
                    <span className="pm-stat-right">{probability.blackStats.recentForm.toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="prediction-divider">
                <span>¿Con quién vas?</span>
              </div>

              <div className="prediction-teams">
                <button
                  className={`prediction-team white ${selectedPrediction === 'white' ? 'selected' : ''}`}
                  onClick={() => setSelectedPrediction('white')}
                >
                  {selectedPrediction === 'white' && <div className="pt-check">✓</div>}
                  <div className="pt-pct">{probability.white}%</div>
                  <div className="pt-name">Equipo Blanco</div>
                  <div className="pt-players">
                    {predictionMatch.teamWhite?.map(pid => (
                      <span key={pid} className="pt-player">{getPlayerName(pid)}</span>
                    ))}
                  </div>
                </button>

                <button
                  className={`prediction-team black ${selectedPrediction === 'black' ? 'selected' : ''}`}
                  onClick={() => setSelectedPrediction('black')}
                >
                  {selectedPrediction === 'black' && <div className="pt-check">✓</div>}
                  <div className="pt-pct">{probability.black}%</div>
                  <div className="pt-name">Equipo Negro</div>
                  <div className="pt-players">
                    {predictionMatch.teamBlack?.map(pid => (
                      <span key={pid} className="pt-player">{getPlayerName(pid)}</span>
                    ))}
                  </div>
                </button>
              </div>

              <div className="prediction-advanced-section">
                <div className="prediction-advanced-title">
                  <AppIcon name="target" size={14} />
                  <span>Predicción avanzada (opcional)</span>
                </div>
                <div className="prediction-advanced-grid">
                  <div className="prediction-advanced-item">
                    <label>MVP probable</label>
                    <select
                      value={predictedMvpId}
                      onChange={e => setPredictedMvpId(e.target.value)}
                    >
                      <option value="">Sin MVP</option>
                      {allPredictionPlayers.map(playerId => (
                        <option key={`pmvp-${playerId}`} value={playerId}>
                          {getPlayerName(playerId)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="prediction-advanced-item">
                    <label>Marcador estimado</label>
                    <div className="prediction-score-inputs">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={predictedScoreWhite}
                        onChange={e => setPredictedScoreWhite(e.target.value)}
                        placeholder="Blanco"
                      />
                      <span>-</span>
                      <input
                        type="number"
                        min="0"
                        max="30"
                        value={predictedScoreBlack}
                        onChange={e => setPredictedScoreBlack(e.target.value)}
                        placeholder="Negro"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* LukCoins Betting */}
              <div className="xp-bet-section">
                <div className="xp-bet-header">
                  <span className="xp-bet-title">Apostar LukCoins</span>
                  <span className="xp-bet-balance">Tus LukCoins: {userPlayer ? calculateLukCoins(userPlayer) : 0}</span>
                </div>
                <div className="pool-info">
                  <div className="pool-row">
                    <span>Pozo Blanco</span>
                    <strong>{totalWhite} LC</strong>
                  </div>
                  <div className="pool-row">
                    <span>Pozo Negro</span>
                    <strong>{totalBlack} LC</strong>
                  </div>
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
                      Pozo rival: <strong>{rivalPool} LC</strong> ·
                      Retorno estimado: <strong className="potential-win">
                        +{potentialWin} LC
                      </strong> · Total: <strong>{coinBet + potentialWin} LC</strong>
                    </span>
                  )}
                </div>
                {selectedPrediction && (
                  <div className="pool-hint">
                    Tu apuesta entra al pozo de tu equipo ({selectedPool} LC).
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={closePredictionModal}>
                  Cancelar
                </button>
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
              icon: <AppIcon name="ball" size={14} />,
              onClick: () => setActiveTab('new')
            },
            { 
              label: 'Agregar Jugador', 
              icon: <AppIcon name="profile" size={14} />,
              onClick: () => openAddEditPlayerModal()
            },
            { 
              label: 'Ver Dashboard', 
              icon: <AppIcon name="note" size={14} />,
              onClick: () => setActiveTab('dashboard')
            },
          ]}
          ariaLabel="Acciones rápidas"
        />
      )}

      {/* Premium Toast Notification */}
      {toast && (
        <div className="toast-premium">
          <div className="toast-content">
            <span className="toast-icon">
              {toast.type === 'success' ? <AppIcon name="check" size={14} /> : toast.type === 'error' ? <AppIcon name="close" size={14} /> : <AppIcon name="info" size={14} />}
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
