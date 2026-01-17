import { useState, useEffect, useRef } from 'react'
import { auth, googleProvider, db } from './firebase'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc,
  getDocs, 
  onSnapshot,
  query,
  where,
  writeBatch,
  updateDoc
} from 'firebase/firestore'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import confetti from 'canvas-confetti'

// ⚠️ CAMBIA ESTA CONTRASEÑA por una que solo tú conozcas
const ADMIN_PASSWORD = 'lukto2026'

// 📧 Email del super admin (siempre tiene acceso)
const SUPER_ADMIN_EMAIL = 'joseescorcia01@gmail.com'

// Datos iniciales de jugadores con sus aliases
const initialPlayers = [
  { id: '1', name: 'Colombia Pana', aliases: ['Costaman'] },
  { id: '2', name: 'G-sus', aliases: ['Manuno'] },
  { id: '3', name: 'Jaime', aliases: ['Jotin'] },
  { id: '4', name: 'Pana Sida', aliases: ['Pana Mopri'] },
  { id: '5', name: 'Javi', aliases: ['Javinho'] },
  { id: '6', name: 'Werz', aliases: ['Werson'] },
  { id: '7', name: 'Bob', aliases: [] },
  { id: '8', name: 'Luigi', aliases: [] },
  { id: '9', name: 'Miguel', aliases: [] },
  { id: '10', name: 'Urzola', aliases: [] },
  { id: '11', name: 'Yoc', aliases: [] },
  { id: '12', name: 'Harry Potter', aliases: [] },
  { id: '13', name: 'Manuel', aliases: [] },
  { id: '14', name: 'Felao', aliases: [] },
  { id: '15', name: 'Ivan', aliases: [] },
  { id: '16', name: 'Ketrox', aliases: [] },
  { id: '17', name: 'Bohr', aliases: [] },
  { id: '18', name: 'Villa', aliases: [] },
  { id: '19', name: 'Chechinsito', aliases: [] },
]

// Partidos iniciales basados en los datos proporcionados
const initialMatches = [
  {
    id: '1',
    date: '2026-01-08',
    venue: 'LUKTO',
    teamWhite: ['2', '7', '11', '5', '19', '6'],
    teamBlack: ['1', '15', '16', '4', '17', '18'],
    winner: 'white'
  },
  {
    id: '2',
    date: '2026-01-15',
    venue: 'LUKTO - FSB',
    teamWhite: ['6', '7', '5', '8', '9', '3'],
    teamBlack: ['1', '10', '11', '12', '13', '14'],
    winner: 'black'
  }
]

// Component for pending user with proper ref handling
function PendingUserCard({ pending, players, linkingUser, onLink }) {
  const [selectedPlayer, setSelectedPlayer] = useState('')
  
  const handleLink = () => {
    console.log('Click vincular:', selectedPlayer)
    if (selectedPlayer && selectedPlayer !== '') {
      onLink(pending.odedBy, selectedPlayer)
    }
  }
  
  return (
    <div className={`user-link-card pending ${linkingUser === pending.odedBy ? 'linking' : ''}`}>
      <div className="user-link-info">
        <img src={pending.userPhoto || pending.odedByPhoto} alt="" className="user-link-avatar" />
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
              onChange={(e) => setSelectedPlayer(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {players.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <button
              className="link-btn"
              onClick={handleLink}
            >
              ✓
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('stats')
  const [players, setPlayers] = useState(initialPlayers)
  const [matches, setMatches] = useState(initialMatches)
  const [ratings, setRatings] = useState({})
  const [predictions, setPredictions] = useState({}) // {matchId: {odedBy: 'white'|'black'}}
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerAliases, setNewPlayerAliases] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  
  // Dark mode - persiste en localStorage
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('lukto_darkMode')
    return saved !== 'false' // Default to dark mode
  })
  
  // Loading states for skeleton
  const [dataLoaded, setDataLoaded] = useState(false)
  
  // Head to head modal
  const [showH2HModal, setShowH2HModal] = useState(false)
  const [h2hPlayer1, setH2hPlayer1] = useState(null)
  const [h2hPlayer2, setH2hPlayer2] = useState(null)
  
  // Prediction modal
  const [showPredictionModal, setShowPredictionModal] = useState(false)
  const [selectedMatchForPrediction, setSelectedMatchForPrediction] = useState(null)
  
  // Confetti ref
  const confettiTriggered = useRef({})
  
  // Notifications
  const [notificationPermission, setNotificationPermission] = useState(Notification?.permission || 'default')
  const previousRatingsRef = useRef({})
  
  // Player profile
  const [selectedPlayerProfile, setSelectedPlayerProfile] = useState(null)
  const [showPlayerProfile, setShowPlayerProfile] = useState(false)
  
  // Time filter for leaderboards
  const [timeFilter, setTimeFilter] = useState('all') // 'all', 'month', 'week'
  
  // Auth state
  const [user, setUser] = useState(null)
  const [userPlayer, setUserPlayer] = useState(null)
  const [showLinkPlayerModal, setShowLinkPlayerModal] = useState(false)
  const [userLinks, setUserLinks] = useState({}) // {odedBy: { odedBy, userName, userPhoto, playerId }}
  const [pendingUsers, setPendingUsers] = useState([]) // Users waiting to be linked
  const [userLinksLoaded, setUserLinksLoaded] = useState(false) // Track if initial load is complete
  
  // Admin mode - carga desde localStorage
  const [isAdmin, setIsAdmin] = useState(() => {
    const saved = localStorage.getItem('lukto_admin')
    return saved === 'true'
  })
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  const [adminEmails, setAdminEmails] = useState([]) // Lista de admins desde Firebase
  const [newAdminEmail, setNewAdminEmail] = useState('')
  
  // Rating modal
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [currentRatings, setCurrentRatings] = useState({})
  const [expandedPlayer, setExpandedPlayer] = useState(null)
  const [linkingUser, setLinkingUser] = useState(null) // Track which user is being linked
  const [ratingSuccess, setRatingSuccess] = useState(false) // Show success state in rating modal
  const [toast, setToast] = useState(null) // { type: 'success' | 'error', message: string }
  
  // Match form state
  const [matchDate, setMatchDate] = useState('')
  const [matchVenue, setMatchVenue] = useState('LUKTO')
  const [teamWhite, setTeamWhite] = useState([])
  const [teamBlack, setTeamBlack] = useState([])
  const [winner, setWinner] = useState('')
  const [editingMatchId, setEditingMatchId] = useState(null)

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        setUserPlayer(null)
      }
    })
    return () => unsubscribe()
  }, [])

  // Dark mode effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('lukto_darkMode', darkMode.toString())
  }, [darkMode])

  // Load predictions from Firebase
  useEffect(() => {
    const unsubPredictions = onSnapshot(collection(db, 'predictions'), (snapshot) => {
      const preds = {}
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data()
        if (!preds[data.matchId]) preds[data.matchId] = {}
        preds[data.matchId][data.odedBy] = data.prediction
      })
      setPredictions(preds)
    }, (error) => {
      console.log('No predictions yet:', error)
    })
    return () => unsubPredictions()
  }, [])

  // Check if user is admin when user or adminEmails change
  useEffect(() => {
    if (user && user.email) {
      const userEmail = user.email.toLowerCase()
      const isSuperAdmin = userEmail === SUPER_ADMIN_EMAIL.toLowerCase()
      const isInAdminList = adminEmails.some(email => email.toLowerCase() === userEmail)
      
      if (isSuperAdmin || isInAdminList) {
        setIsAdmin(true)
        localStorage.setItem('lukto_admin', 'true')
      } else {
        // User is logged in but NOT an admin - remove admin privileges
        setIsAdmin(false)
        localStorage.removeItem('lukto_admin')
      }
    } else if (!user) {
      // No user logged in - clear admin status
      setIsAdmin(false)
      localStorage.removeItem('lukto_admin')
    }
  }, [user, adminEmails])

  // Load admin emails from Firebase
  useEffect(() => {
    const unsubAdmins = onSnapshot(doc(db, 'settings', 'admins'), (docSnap) => {
      if (docSnap.exists()) {
        setAdminEmails(docSnap.data().emails || [])
      }
    }, (error) => {
      console.log('No admin settings yet:', error)
    })

    return () => unsubAdmins()
  }, [])

  // Load user links from Firebase and check current user's link
  useEffect(() => {
    const unsubLinks = onSnapshot(collection(db, 'userLinks'), (snapshot) => {
      const links = {}
      const pending = []
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data()
        const docId = docSnap.id
        
        // Check if playerId exists and is not null/undefined/empty
        if (data.playerId && data.playerId !== '' && data.playerId !== null) {
          links[docId] = { ...data, odedBy: docId }
        } else {
          // User is pending (registered but not linked)
          pending.push({ ...data, odedBy: docId })
        }
      })
      
      setUserLinks(links)
      setPendingUsers(pending)
      setUserLinksLoaded(true) // Mark that initial load is complete
      
      // Check if current user is linked - this updates in real-time when admin links them
      if (user) {
        const currentUserLink = links[user.uid]
        if (currentUserLink && currentUserLink.playerId) {
          // User has been linked by admin - update immediately
          setUserPlayer(currentUserLink.playerId)
        } else {
          setUserPlayer(null)
          // Register as pending if not already in the pending list
          const isAlreadyPending = pending.some(p => p.odedBy === user.uid)
          if (!isAlreadyPending) {
            registerPendingUser()
          }
        }
      }
    }, (error) => {
      console.error('Error loading user links:', error)
      setUserLinksLoaded(true) // Mark loaded even on error
    })

    return () => unsubLinks()
  }, [user])

  // Register user as pending when they log in
  const registerPendingUser = async () => {
    if (!user) return
    
    try {
      const linkRef = doc(db, 'userLinks', user.uid)
      await setDoc(linkRef, {
        userName: user.displayName,
        userEmail: user.email,
        userPhoto: user.photoURL,
        playerId: null,
        registeredAt: new Date().toISOString()
      }, { merge: true })
      console.log('Usuario registrado exitosamente:', user.email)
    } catch (error) {
      console.error('Error registering pending user:', error)
    }
  }

  // Load data from Firestore
  useEffect(() => {
    let unsubPlayers = () => {}
    let unsubMatches = () => {}
    let unsubRatings = () => {}

    try {
      // Load players
      unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
        if (!snapshot.empty) {
          const playersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          setPlayers(playersData)
        } else {
          // Initialize with default players
          initializeFirestore()
        }
      }, (error) => {
        console.error('Error loading players:', error)
      })

      // Load matches
      unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
        if (!snapshot.empty) {
          const matchesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          setMatches(matchesData.sort((a, b) => new Date(a.date) - new Date(b.date)))
        }
        setDataLoaded(true) // Mark data as loaded
      }, (error) => {
        console.error('Error loading matches:', error)
        setDataLoaded(true)
      })

      // Load ratings
      unsubRatings = onSnapshot(collection(db, 'ratings'), (snapshot) => {
        const ratingsData = {}
        snapshot.docs.forEach(doc => {
          const data = doc.data()
          if (!ratingsData[data.ratedPlayerId]) {
            ratingsData[data.ratedPlayerId] = []
          }
          ratingsData[data.ratedPlayerId].push(data)
        })
        setRatings(ratingsData)
      }, (error) => {
        console.error('Error loading ratings:', error)
      })
    } catch (error) {
      console.error('Error setting up Firestore listeners:', error)
    }

    return () => {
      unsubPlayers()
      unsubMatches()
      unsubRatings()
    }
  }, [])

  const initializeFirestore = async () => {
    const batch = writeBatch(db)
    
    // Add initial players
    initialPlayers.forEach(player => {
      const playerRef = doc(db, 'players', player.id)
      batch.set(playerRef, { name: player.name, aliases: player.aliases })
    })
    
    // Add initial matches
    initialMatches.forEach(match => {
      const matchRef = doc(db, 'matches', match.id)
      batch.set(matchRef, {
        date: match.date,
        venue: match.venue,
        teamWhite: match.teamWhite,
        teamBlack: match.teamBlack,
        winner: match.winner
      })
    })
    
    await batch.commit()
  }

  // Auth functions
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Error signing in:', error)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    setUserPlayer(null)
    setIsAdmin(false)
    localStorage.removeItem('lukto_admin')
  }

  const handleLinkPlayer = (playerId) => {
    // Old function - kept for compatibility but now only admin can link
    if (user) {
      setShowLinkPlayerModal(false)
    }
  }

  // Admin function to link a user to a player
  const adminLinkUserToPlayer = async (userId, playerId) => {
    console.log('Vinculando:', { userId, playerId })
    
    if (!isAdmin) return
    
    if (!userId || !playerId || playerId === '') return
    
    if (linkingUser === userId) return
    
    // Find the player
    const playerToLink = players.find(p => p.id === playerId)
    if (!playerToLink) {
      console.log('Jugadores disponibles:', players.map(p => ({ id: p.id, name: p.name })))
      return
    }
    
    setLinkingUser(userId)
    
    try {
      const linkRef = doc(db, 'userLinks', userId)
      
      // Use updateDoc to just change playerId without deleting
      await updateDoc(linkRef, {
        playerId: String(playerId),
        linkedAt: new Date().toISOString()
      })
      
      console.log('Vinculado a', playerToLink.name)
      
      // Force refresh after 1 second
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLinkingUser(null)
    }
  }

  // Admin function to unlink a user
  const adminUnlinkUser = async (odedBy) => {
    if (!isAdmin) return
    if (!confirm('¿Estás seguro de desvincular este usuario?')) return
    
    try {
      const linkRef = doc(db, 'userLinks', odedBy)
      await updateDoc(linkRef, { playerId: null })
    } catch (error) {
      console.error('Error unlinking user:', error)
    }
  }

  // Handle admin login
  const handleAdminLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      localStorage.setItem('lukto_admin', 'true')
      setShowLoginModal(false)
      setPasswordInput('')
      setLoginError('')
    } else {
      setLoginError('Contraseña incorrecta')
    }
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
    localStorage.removeItem('lukto_admin')
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
    } catch (error) {
      console.error('Error adding admin:', error)
      showToast('error', 'Error al agregar admin')
    }
  }

  // Remove admin email
  const handleRemoveAdmin = async (email) => {
    if (!confirm(`¿Quitar permisos de admin a ${email}?`)) return
    
    try {
      const newList = adminEmails.filter(e => e !== email)
      await setDoc(doc(db, 'settings', 'admins'), { emails: newList })
    } catch (error) {
      console.error('Error removing admin:', error)
      showToast('error', 'Error al quitar admin')
    }
  }

  // Calculate stats for each player
  const calculateStats = () => {
    const stats = {}
    
    players.forEach(player => {
      stats[player.id] = { 
        wins: 0, 
        losses: 0, 
        played: 0,
        mvps: 0,
        name: player.name,
        aliases: player.aliases || []
      }
    })

    matches.forEach(match => {
      const whiteWon = match.winner === 'white'
      const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]
      
      // Calculate MVP for this match (highest avg rating)
      let mvpId = null
      let mvpRating = -1
      
      allMatchPlayers.forEach(playerId => {
        const playerRatings = ratings[playerId] || []
        const matchRatings = playerRatings.filter(r => r.matchId === match.id)
        if (matchRatings.length > 0) {
          const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
          if (avg > mvpRating) {
            mvpRating = avg
            mvpId = playerId
          }
        }
      })
      
      // Count MVP
      if (mvpId && stats[mvpId]) {
        stats[mvpId].mvps++
      }
      
      match.teamWhite.forEach(playerId => {
        if (stats[playerId]) {
          stats[playerId].played++
          if (whiteWon) stats[playerId].wins++
          else stats[playerId].losses++
        }
      })
      
      match.teamBlack.forEach(playerId => {
        if (stats[playerId]) {
          stats[playerId].played++
          if (!whiteWon) stats[playerId].wins++
          else stats[playerId].losses++
        }
      })
    })

    return Object.entries(stats)
      .filter(([_, s]) => s.played > 0)
      .map(([id, s]) => ({
        id,
        ...s,
        winRate: s.played > 0 ? (s.wins / s.played) * 100 : 0,
        avgRating: calculatePlayerAvgRating(id)
      }))
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
  }

  const calculatePlayerAvgRating = (playerId) => {
    const playerRatings = ratings[playerId]
    if (!playerRatings || playerRatings.length === 0) return null
    const sum = playerRatings.reduce((acc, r) => acc + r.score, 0)
    return (sum / playerRatings.length).toFixed(1)
  }

  const stats = calculateStats()

  const getWinRateClass = (rate) => {
    if (rate >= 60) return 'high'
    if (rate >= 40) return 'medium'
    return 'low'
  }

  const getRatingClass = (rating) => {
    if (rating >= 8) return 'high'
    if (rating >= 6) return 'medium'
    return 'low'
  }

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getPlayerName = (id) => {
    const player = players.find(p => p.id === id)
    return player ? player.name : 'Desconocido'
  }

  // Get player photo from userLinks
  const getPlayerPhoto = (playerId) => {
    const link = Object.values(userLinks).find(data => data.playerId === playerId)
    return link?.userPhoto || null
  }

  // Show toast notification
  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  // Calculate player streaks (win/loss streaks)
  const calculateStreaks = (playerId) => {
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))
    let currentStreak = 0
    let streakType = null // 'win' or 'loss'
    let maxWinStreak = 0
    let maxLossStreak = 0
    let tempStreak = 0
    let tempType = null

    sortedMatches.forEach(match => {
      const inWhite = match.teamWhite.includes(playerId)
      const inBlack = match.teamBlack.includes(playerId)
      if (!inWhite && !inBlack) return

      const won = (inWhite && match.winner === 'white') || (inBlack && match.winner === 'black')
      
      if (won) {
        if (tempType === 'win') {
          tempStreak++
        } else {
          tempStreak = 1
          tempType = 'win'
        }
        maxWinStreak = Math.max(maxWinStreak, tempStreak)
      } else {
        if (tempType === 'loss') {
          tempStreak++
        } else {
          tempStreak = 1
          tempType = 'loss'
        }
        maxLossStreak = Math.max(maxLossStreak, tempStreak)
      }
      
      currentStreak = tempStreak
      streakType = tempType
    })

    return { currentStreak, streakType, maxWinStreak, maxLossStreak }
  }

  // Calculate head-to-head stats between two players
  const calculateH2H = (player1Id, player2Id) => {
    let sameTeamWins = 0
    let sameTeamLosses = 0
    let oppositeWins = 0 // player1 wins against player2
    let oppositeLosses = 0 // player1 loses against player2
    let totalTogether = 0
    let totalOpposite = 0

    matches.forEach(match => {
      const p1White = match.teamWhite.includes(player1Id)
      const p1Black = match.teamBlack.includes(player1Id)
      const p2White = match.teamWhite.includes(player2Id)
      const p2Black = match.teamBlack.includes(player2Id)
      
      if (!p1White && !p1Black) return
      if (!p2White && !p2Black) return

      const sameTeam = (p1White && p2White) || (p1Black && p2Black)
      
      if (sameTeam) {
        totalTogether++
        const team = p1White ? 'white' : 'black'
        if (match.winner === team) sameTeamWins++
        else sameTeamLosses++
      } else {
        totalOpposite++
        const p1Team = p1White ? 'white' : 'black'
        if (match.winner === p1Team) oppositeWins++
        else oppositeLosses++
      }
    })

    return {
      sameTeamWins,
      sameTeamLosses,
      totalTogether,
      sameTeamWinRate: totalTogether > 0 ? (sameTeamWins / totalTogether * 100).toFixed(0) : 0,
      oppositeWins,
      oppositeLosses,
      totalOpposite,
      h2hWinRate: totalOpposite > 0 ? (oppositeWins / totalOpposite * 100).toFixed(0) : 0
    }
  }

  // Calculate best teammate and worst rival
  const calculateTeammateRivalStats = (playerId) => {
    const teammateStats = {}
    const rivalStats = {}

    matches.forEach(match => {
      const inWhite = match.teamWhite.includes(playerId)
      const inBlack = match.teamBlack.includes(playerId)
      if (!inWhite && !inBlack) return

      const myTeam = inWhite ? match.teamWhite : match.teamBlack
      const opposingTeam = inWhite ? match.teamBlack : match.teamWhite
      const won = (inWhite && match.winner === 'white') || (inBlack && match.winner === 'black')

      // Teammates
      myTeam.forEach(tid => {
        if (tid === playerId) return
        if (!teammateStats[tid]) teammateStats[tid] = { wins: 0, total: 0 }
        teammateStats[tid].total++
        if (won) teammateStats[tid].wins++
      })

      // Rivals
      opposingTeam.forEach(rid => {
        if (!rivalStats[rid]) rivalStats[rid] = { wins: 0, total: 0 }
        rivalStats[rid].total++
        if (won) rivalStats[rid].wins++
      })
    })

    // Find best teammate (highest win rate with at least 2 games)
    let bestTeammate = null
    let bestTeammateRate = -1
    Object.entries(teammateStats).forEach(([id, stats]) => {
      if (stats.total >= 2) {
        const rate = stats.wins / stats.total
        if (rate > bestTeammateRate) {
          bestTeammateRate = rate
          bestTeammate = { id, ...stats, winRate: (rate * 100).toFixed(0) }
        }
      }
    })

    // Find worst rival (lowest win rate against with at least 2 games)
    let worstRival = null
    let worstRivalRate = 2
    Object.entries(rivalStats).forEach(([id, stats]) => {
      if (stats.total >= 2) {
        const rate = stats.wins / stats.total
        if (rate < worstRivalRate) {
          worstRivalRate = rate
          worstRival = { id, ...stats, winRate: (rate * 100).toFixed(0) }
        }
      }
    })

    return { bestTeammate, worstRival }
  }

  // Calculate XP for a player
  const calculateXP = (playerId) => {
    const playerStats = stats.find(s => s.id === playerId)
    if (!playerStats) return 0
    
    let xp = 0
    // XP por partidos jugados (10 XP cada uno)
    xp += playerStats.played * 10
    // XP por victorias (25 XP cada una)
    xp += playerStats.wins * 25
    // XP por MVPs (50 XP cada uno)
    xp += playerStats.mvps * 50
    // XP por rating alto (rating * 5)
    if (playerStats.avgRating) {
      xp += Math.round(parseFloat(playerStats.avgRating) * 5)
    }
    
    return xp
  }

  // Get rank based on XP
  const getRank = (xp) => {
    if (xp >= 500) return { name: 'Diamante', icon: '💎', color: '#b9f2ff', tier: 4 }
    if (xp >= 300) return { name: 'Oro', icon: '🥇', color: '#ffd700', tier: 3 }
    if (xp >= 150) return { name: 'Plata', icon: '🥈', color: '#c0c0c0', tier: 2 }
    if (xp >= 50) return { name: 'Bronce', icon: '🥉', color: '#cd7f32', tier: 1 }
    return { name: 'Sin rango', icon: '⚪', color: '#666', tier: 0 }
  }

  // Get XP progress to next rank
  const getXPProgress = (xp) => {
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

  // Filter matches by time period
  const getFilteredMatches = () => {
    const now = new Date()
    return matches.filter(match => {
      const matchDate = new Date(match.date)
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return matchDate >= weekAgo
      }
      if (timeFilter === 'month') {
        return matchDate.getMonth() === now.getMonth() && matchDate.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  // Calculate stats for filtered period
  const calculateFilteredStats = () => {
    const filteredMatches = getFilteredMatches()
    const statsMap = {}
    
    players.forEach(player => {
      statsMap[player.id] = { 
        wins: 0, 
        losses: 0, 
        played: 0,
        mvps: 0,
        name: player.name,
        aliases: player.aliases || []
      }
    })

    filteredMatches.forEach(match => {
      const whiteWon = match.winner === 'white'
      const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]
      
      // Calculate MVP for this match
      let mvpId = null
      let mvpRating = -1
      
      allMatchPlayers.forEach(playerId => {
        const playerRatings = ratings[playerId] || []
        const matchRatings = playerRatings.filter(r => r.matchId === match.id)
        if (matchRatings.length > 0) {
          const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
          if (avg > mvpRating) {
            mvpRating = avg
            mvpId = playerId
          }
        }
      })
      
      if (mvpId && statsMap[mvpId]) {
        statsMap[mvpId].mvps++
      }
      
      match.teamWhite.forEach(playerId => {
        if (statsMap[playerId]) {
          statsMap[playerId].played++
          if (whiteWon) statsMap[playerId].wins++
          else statsMap[playerId].losses++
        }
      })
      
      match.teamBlack.forEach(playerId => {
        if (statsMap[playerId]) {
          statsMap[playerId].played++
          if (!whiteWon) statsMap[playerId].wins++
          else statsMap[playerId].losses++
        }
      })
    })

    return Object.entries(statsMap)
      .filter(([_, s]) => s.played > 0)
      .map(([id, s]) => ({
        id,
        ...s,
        winRate: s.played > 0 ? (s.wins / s.played) * 100 : 0,
        avgRating: calculatePlayerAvgRating(id)
      }))
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
  }

  // Get player of the month
  const getPlayerOfTheMonth = () => {
    const now = new Date()
    const monthMatches = matches.filter(m => {
      const d = new Date(m.date)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
    
    if (monthMatches.length === 0) return null
    
    const monthStats = {}
    monthMatches.forEach(match => {
      const whiteWon = match.winner === 'white'
      const allPlayers = [...match.teamWhite, ...match.teamBlack]
      
      allPlayers.forEach(playerId => {
        if (!monthStats[playerId]) {
          monthStats[playerId] = { wins: 0, played: 0, mvps: 0, totalRating: 0, ratingCount: 0 }
        }
        monthStats[playerId].played++
        
        const inWhite = match.teamWhite.includes(playerId)
        if ((inWhite && whiteWon) || (!inWhite && !whiteWon)) {
          monthStats[playerId].wins++
        }
        
        // Check MVP
        const playerRatings = ratings[playerId] || []
        const matchRatings = playerRatings.filter(r => r.matchId === match.id)
        if (matchRatings.length > 0) {
          const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
          monthStats[playerId].totalRating += avg
          monthStats[playerId].ratingCount++
        }
      })
    })
    
    // Calculate score for each player (wins * 3 + avgRating)
    let bestPlayer = null
    let bestScore = -1
    
    Object.entries(monthStats).forEach(([playerId, stats]) => {
      if (stats.played >= 2) { // Minimum 2 games
        const avgRating = stats.ratingCount > 0 ? stats.totalRating / stats.ratingCount : 5
        const score = (stats.wins * 3) + avgRating + (stats.played * 0.5)
        if (score > bestScore) {
          bestScore = score
          bestPlayer = { 
            id: playerId, 
            ...stats, 
            avgRating: avgRating.toFixed(1),
            winRate: ((stats.wins / stats.played) * 100).toFixed(0)
          }
        }
      }
    })
    
    return bestPlayer
  }

  // Calculate achievements/badges
  const calculateAchievements = (playerId) => {
    const achievements = []
    const streaks = calculateStreaks(playerId)
    const playerStats = stats.find(s => s.id === playerId)
    const xp = calculateXP(playerId)
    const rank = getRank(xp)
    
    if (!playerStats) return achievements

    // Rank achievements
    if (rank.tier >= 1) achievements.push({ icon: '🥉', name: 'Rango Bronce', desc: '50+ XP' })
    if (rank.tier >= 2) achievements.push({ icon: '🥈', name: 'Rango Plata', desc: '150+ XP' })
    if (rank.tier >= 3) achievements.push({ icon: '🥇', name: 'Rango Oro', desc: '300+ XP' })
    if (rank.tier >= 4) achievements.push({ icon: '💎', name: 'Rango Diamante', desc: '500+ XP' })

    // Win streak achievements
    if (streaks.maxWinStreak >= 3) achievements.push({ icon: '🔥', name: 'Racha de 3', desc: '3 victorias seguidas' })
    if (streaks.maxWinStreak >= 5) achievements.push({ icon: '⚡', name: 'Imparable', desc: '5 victorias seguidas' })
    if (streaks.maxWinStreak >= 7) achievements.push({ icon: '👑', name: 'Leyenda', desc: '7 victorias seguidas' })

    // MVP achievements
    if (playerStats.mvps >= 1) achievements.push({ icon: '⭐', name: 'Primer MVP', desc: 'Tu primer MVP' })
    if (playerStats.mvps >= 3) achievements.push({ icon: '🌟', name: 'Estrella', desc: '3 MVPs' })
    if (playerStats.mvps >= 5) achievements.push({ icon: '💫', name: 'Superestrella', desc: '5 MVPs' })

    // Win rate achievements
    if (playerStats.winRate >= 60 && playerStats.played >= 5) achievements.push({ icon: '📈', name: 'Ganador', desc: '60%+ win rate' })
    if (playerStats.winRate >= 75 && playerStats.played >= 5) achievements.push({ icon: '🏆', name: 'Elite', desc: '75%+ win rate' })
    if (playerStats.winRate === 100 && playerStats.played >= 3) achievements.push({ icon: '🎯', name: 'Perfecto', desc: '100% win rate' })

    // Games played achievements
    if (playerStats.played >= 5) achievements.push({ icon: '🎮', name: 'Regular', desc: '5 partidos jugados' })
    if (playerStats.played >= 10) achievements.push({ icon: '🎲', name: 'Veterano', desc: '10 partidos jugados' })
    if (playerStats.played >= 20) achievements.push({ icon: '🏅', name: 'Leyenda LUKTO', desc: '20 partidos jugados' })

    // Rating achievements
    if (playerStats.avgRating) {
      const rating = parseFloat(playerStats.avgRating)
      if (rating >= 7) achievements.push({ icon: '👍', name: 'Buen jugador', desc: 'Rating 7+' })
      if (rating >= 8) achievements.push({ icon: '💪', name: 'Crack', desc: 'Rating 8+' })
      if (rating >= 9) achievements.push({ icon: '🌈', name: 'Fenómeno', desc: 'Rating 9+' })
    }

    // XP milestones
    if (xp >= 100) achievements.push({ icon: '💯', name: 'Centenario', desc: '100+ XP' })
    if (xp >= 250) achievements.push({ icon: '🚀', name: 'Despegue', desc: '250+ XP' })

    return achievements
  }

  // Trigger confetti for MVP
  const triggerMVPConfetti = (matchId, mvpPlayerId) => {
    if (confettiTriggered.current[matchId]) return
    if (mvpPlayerId !== userPlayer) return
    
    confettiTriggered.current[matchId] = true
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#10b981', '#ffd700', '#ffffff']
    })
  }

  // Get performance data for chart (rating and win rate over time)
  const getPerformanceData = (playerId) => {
    const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))
    let wins = 0
    let total = 0
    const data = []

    sortedMatches.forEach(match => {
      const inWhite = match.teamWhite.includes(playerId)
      const inBlack = match.teamBlack.includes(playerId)
      if (!inWhite && !inBlack) return

      total++
      const won = (inWhite && match.winner === 'white') || (inBlack && match.winner === 'black')
      if (won) wins++

      // Calculate average rating up to this match
      const playerRatings = ratings[playerId] || []
      const matchesUpToNow = sortedMatches.filter(m => new Date(m.date) <= new Date(match.date)).map(m => m.id)
      const relevantRatings = playerRatings.filter(r => matchesUpToNow.includes(r.matchId))
      const avgRating = relevantRatings.length > 0 
        ? relevantRatings.reduce((sum, r) => sum + r.score, 0) / relevantRatings.length 
        : null

      data.push({
        name: new Date(match.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        winRate: Math.round((wins / total) * 100),
        rating: avgRating ? parseFloat(avgRating.toFixed(1)) : null,
        match: match.venue
      })
    })

    return data
  }

  // Submit prediction
  const submitPrediction = async (matchId, prediction) => {
    if (!user || !userPlayer) return
    
    try {
      const predRef = doc(db, 'predictions', `${user.uid}_${matchId}`)
      await setDoc(predRef, {
        odedBy: user.uid,
        playerId: userPlayer,
        matchId,
        prediction,
        timestamp: new Date().toISOString()
      })
      setShowPredictionModal(false)
      showToast('success', 'Predicción registrada')
    } catch (error) {
      console.error('Error submitting prediction:', error)
      showToast('error', 'Error al guardar predicción')
    }
  }

  // Get prediction accuracy for a player
  const getPredictionAccuracy = (odedBy) => {
    let correct = 0
    let total = 0
    
    Object.entries(predictions).forEach(([matchId, matchPreds]) => {
      if (matchPreds[odedBy]) {
        const match = matches.find(m => m.id === matchId)
        if (match && match.winner) {
          total++
          if (matchPreds[odedBy] === match.winner) correct++
        }
      }
    })
    
    return { correct, total, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 }
  }

  // Request notification permission
  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      showToast('error', 'Tu navegador no soporta notificaciones')
      return
    }
    
    const permission = await Notification.requestPermission()
    setNotificationPermission(permission)
    
    if (permission === 'granted') {
      showToast('success', '¡Notificaciones activadas!')
      // Show test notification
      sendNotification('LUKTO Stats', {
        body: '¡Notificaciones activadas! Te avisaremos cuando te califiquen.',
        icon: '/icon-192.png'
      })
    } else {
      showToast('error', 'Notificaciones bloqueadas')
    }
  }

  // Send notification
  const sendNotification = (title, options = {}) => {
    if (notificationPermission !== 'granted') return
    if (document.hasFocus()) return // Don't show if app is focused
    
    try {
      new Notification(title, {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        ...options
      })
    } catch (error) {
      console.log('Notification error:', error)
    }
  }

  // Watch for new ratings on current user
  useEffect(() => {
    if (!userPlayer || !ratings[userPlayer]) return
    
    const currentRatingsCount = ratings[userPlayer]?.length || 0
    const previousCount = previousRatingsRef.current[userPlayer] || 0
    
    if (previousCount > 0 && currentRatingsCount > previousCount) {
      // New rating received!
      const newRatings = currentRatingsCount - previousCount
      sendNotification('Nueva calificación', {
        body: `Recibiste ${newRatings} nueva${newRatings > 1 ? 's' : ''} calificación${newRatings > 1 ? 'es' : ''}`,
        tag: 'new-rating'
      })
    }
    
    previousRatingsRef.current[userPlayer] = currentRatingsCount
  }, [ratings, userPlayer, notificationPermission])

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
      winner
    }

    if (editingMatchId) {
      // Update existing match
      await updateDoc(doc(db, 'matches', editingMatchId), matchData)
    } else {
      // Create new match
      const newMatchId = Date.now().toString()
      await setDoc(doc(db, 'matches', newMatchId), matchData)
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

  const openEditMatch = (match) => {
    setMatchDate(match.date)
    setMatchVenue(match.venue)
    setTeamWhite([...match.teamWhite])
    setTeamBlack([...match.teamBlack])
    setWinner(match.winner)
    setEditingMatchId(match.id)
    setActiveTab('new')
  }

  const handleDeleteMatch = async (matchId) => {
    if (!confirm('¿Estás seguro de eliminar este partido y todas sus calificaciones? Esta acción no se puede deshacer.')) return
    
    try {
      const batch = writeBatch(db)
      
      // Delete the match
      batch.delete(doc(db, 'matches', matchId))
      
      // Delete all ratings for this match
      const ratingsQuery = query(collection(db, 'ratings'), where('matchId', '==', matchId))
      const ratingsSnapshot = await getDocs(ratingsQuery)
      ratingsSnapshot.docs.forEach(docSnap => {
        batch.delete(doc(db, 'ratings', docSnap.id))
      })
      
      // Delete all predictions for this match
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

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    
    const playerData = {
      name: newPlayerName.trim(),
      aliases: newPlayerAliases.split(',').map(a => a.trim()).filter(a => a)
    }
    
    try {
      if (editingPlayerId) {
        await updateDoc(doc(db, 'players', editingPlayerId), playerData)
        console.log('Jugador actualizado')
      } else {
        const newPlayerId = Date.now().toString()
        await setDoc(doc(db, 'players', newPlayerId), playerData)
        console.log('Jugador creado:', newPlayerId)
      }
      closePlayerModal()
    } catch (error) {
      console.error('Error:', error)
      showToast('error', 'Error al guardar')
    }
  }

  const openEditPlayer = (player) => {
    setEditingPlayerId(player.id)
    setNewPlayerName(player.name)
    setNewPlayerAliases(player.aliases ? player.aliases.join(', ') : '')
    setShowPlayerModal(true)
  }

  const closePlayerModal = () => {
    setNewPlayerName('')
    setNewPlayerAliases('')
    setEditingPlayerId(null)
    setShowPlayerModal(false)
  }

  const handleDeletePlayer = async (playerId, playerName) => {
    if (!confirm(`¿Estás seguro de eliminar a "${playerName}"? Esta acción no se puede deshacer.`)) return
    
    try {
      await deleteDoc(doc(db, 'players', playerId))
    } catch (error) {
      console.error('Error deleting player:', error)
      showToast('error', 'Error al eliminar jugador')
    }
  }

  const handleEditPlayer = async (playerId, newName, newAliases) => {
    try {
      await updateDoc(doc(db, 'players', playerId), {
        name: newName,
        aliases: newAliases
      })
    } catch (error) {
      console.error('Error updating player:', error)
      showToast('error', 'Error al actualizar jugador')
    }
  }

  // Rating functions
  const openRatingModal = (match) => {
    if (!userPlayer) {
      showToast('error', 'Primero debes vincular tu cuenta')
      return
    }
    
    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    if (!allPlayers.includes(userPlayer)) {
      showToast('error', 'Solo puedes calificar partidos en los que jugaste')
      return
    }
    
    // Load existing ratings for this match by this user
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
    setCurrentRatings({
      ...currentRatings,
      [playerId]: score
    })
  }

  const submitRatings = async () => {
    if (!selectedMatch || !userPlayer) return
    
    // Verificar que todos los jugadores estén calificados
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
        timestamp: new Date().toISOString()
      })
    })
    
    await batch.commit()
    setRatingSuccess(true)
  }
  
  const closeRatingModal = () => {
    setShowRatingModal(false)
    setSelectedMatch(null)
    setCurrentRatings({})
    setRatingSuccess(false)
  }

  const deleteMyRatings = async (matchId) => {
    if (!userPlayer) return
    if (!confirm('¿Estás seguro de borrar tus calificaciones de este partido?')) return
    
    const batch = writeBatch(db)
    
    // Find all ratings by this user for this match
    Object.entries(ratings).forEach(([playerId, playerRatings]) => {
      const myRating = playerRatings.find(
        r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === matchId
      )
      if (myRating) {
        const ratingId = `${userPlayer}_${playerId}_${matchId}`
        const ratingRef = doc(db, 'ratings', ratingId)
        batch.delete(ratingRef)
      }
    })
    
    await batch.commit()
    setShowRatingModal(false)
    setSelectedMatch(null)
    setCurrentRatings({})
  }

  const hasMyRatings = (matchId) => {
    if (!userPlayer) return false
    return Object.values(ratings).some(playerRatings => 
      playerRatings.some(r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === matchId)
    )
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    })
  }

  const getPlayersToRate = (match) => {
    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    return allPlayers.filter(id => id !== userPlayer)
  }

  return (
    <div className={`app-container ${darkMode ? 'dark' : 'light'}`}>
      {/* Premium Header */}
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
            {'Notification' in window && (
              <button 
                className={`action-btn ${notificationPermission === 'granted' ? 'active' : ''}`}
                onClick={requestNotificationPermission}
                aria-label="Notificaciones"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </button>
            )}
            <button 
              className="action-btn"
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? 'Modo claro' : 'Modo oscuro'}
            >
              {darkMode ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
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
                  if (userPlayer) {
                    setSelectedPlayerProfile(userPlayer)
                    setShowPlayerProfile(true)
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
                      const playerStats = stats.find(s => s.id === userPlayer)
                      if (playerStats) {
                        return (
                          <span className={`rank-badge rank-${playerStats.rank?.toLowerCase()}`}>
                            {playerStats.rank}
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
                <button className="mode-btn admin-active" onClick={handleAdminLogout}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  Admin
                </button>
              ) : (
                <button className="mode-btn" onClick={() => setShowLoginModal(true)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0110 0v4"/>
                  </svg>
                  Admin
                </button>
              )}
              <button className="logout-btn" onClick={handleLogout}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16,17 21,12 16,7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Login Card - Not logged in */}
        {!user && (
          <div className="login-card">
            <div className="login-card-content">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="40" height="40" className="login-icon">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <p className="login-text">Inicia sesión para calificar jugadores y ver tu perfil</p>
            </div>
            <button className="google-signin-btn" onClick={handleGoogleLogin}>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
          </div>
        )}
      </header>

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

      {/* Admin top tabs */}
      {isAdmin && (
        <nav className="admin-tabs">
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
            className={`admin-tab ${activeTab === 'allRatings' ? 'active' : ''}`}
            onClick={() => setActiveTab('allRatings')}
          >
            Historial
          </button>
        </nav>
      )}

      {activeTab === 'stats' && !dataLoaded && (
        <section className="stats-section">
          <h2 className="section-title">Ranking de Jugadores</h2>
          <div className="skeleton-container">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="skeleton-row">
                <div className="skeleton skeleton-avatar"></div>
                <div className="skeleton skeleton-text"></div>
                <div className="skeleton skeleton-bar"></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'stats' && dataLoaded && (
        <section className="stats-section">
          {/* Player of the Month Card */}
          {(() => {
            const potm = getPlayerOfTheMonth()
            if (!potm) return null
            const potmPlayer = players.find(p => p.id === potm.id)
            return (
              <div className="potm-card">
                <div className="potm-badge">🏆 Jugador del Mes</div>
                <div className="potm-content">
                  {getPlayerPhoto(potm.id) ? (
                    <img src={getPlayerPhoto(potm.id)} alt="" className="potm-avatar" />
                  ) : (
                    <div className="potm-avatar-placeholder">
                      {getInitials(potmPlayer?.name || '')}
                    </div>
                  )}
                  <div className="potm-info">
                    <h3>{potmPlayer?.name}</h3>
                    <div className="potm-stats">
                      <span>{potm.wins}V - {potm.played - potm.wins}D</span>
                      <span>{potm.winRate}%</span>
                      <span>⭐ {potm.avgRating}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          <h2 className="section-title">
            {timeFilter === 'all' ? 'Ranking General' : 
             timeFilter === 'month' ? 'Ranking del Mes' : 'Ranking de la Semana'}
          </h2>
          
          {(() => {
            const displayStats = timeFilter === 'all' ? stats : calculateFilteredStats()
            return displayStats.length > 0 ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Rango</th>
                  <th>Win Rate</th>
                  <th></th>
                  <th>V</th>
                  <th>D</th>
                  <th>MVP</th>
                  <th>XP</th>
                </tr>
              </thead>
              <tbody>
                {displayStats.map((player, index) => {
                  const xp = calculateXP(player.id)
                  const rank = getRank(xp)
                  return (
                  <tr 
                    key={player.id} 
                    onClick={() => {
                      setSelectedPlayerProfile(player.id)
                      setShowPlayerProfile(true)
                    }}
                    className="clickable-row"
                  >
                    <td>
                      <span className={`rank rank-${index + 1}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <div className="player-name">
                        {getPlayerPhoto(player.id) ? (
                          <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                        ) : (
                          <div className="player-avatar">
                            {getInitials(player.name)}
                          </div>
                        )}
                        {player.name}
                      </div>
                    </td>
                    <td>
                      <span className="rank-badge" style={{ color: rank.color }}>
                        {rank.icon}
                      </span>
                    </td>
                    <td>
                      <span className={`win-rate ${getWinRateClass(player.winRate)}`}>
                        {player.winRate.toFixed(0)}%
                      </span>
                    </td>
                    <td>
                      <div className="winrate-bar-container">
                        <div 
                          className={`winrate-bar ${getWinRateClass(player.winRate)}`}
                          style={{ width: `${player.winRate}%` }}
                        />
                      </div>
                    </td>
                    <td><span className="stat-value wins">{player.wins}</span></td>
                    <td><span className="stat-value losses">{player.losses}</span></td>
                    <td>
                      <span className={`mvp-count ${player.mvps > 0 ? 'has-mvps' : ''}`}>
                        {player.mvps > 0 ? player.mvps : '-'}
                      </span>
                    </td>
                    <td>
                      <span className="xp-value">{xp}</span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="icon">—</div>
              <h3>Sin estadísticas</h3>
              <p>{timeFilter !== 'all' ? 'No hay partidos en este período' : 'Agrega partidos para ver las estadísticas'}</p>
            </div>
          )})()}
        </section>
      )}

      {/* Analytics Tab - Performance graphs, streaks, H2H, achievements */}
      {activeTab === 'analytics' && (
        <section className="stats-section analytics-section">
          <h2 className="section-title">Análisis Avanzado</h2>
          
          {/* Player selector for detailed analytics */}
          <div className="analytics-player-select">
            <label>Selecciona un jugador para ver su análisis:</label>
            <select 
              value={h2hPlayer1 || ''}
              onChange={(e) => setH2hPlayer1(e.target.value)}
              className="player-select-dropdown"
            >
              <option value="">Seleccionar jugador...</option>
              {stats.map(player => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </div>

          {h2hPlayer1 && (() => {
            const player = stats.find(p => p.id === h2hPlayer1)
            const streaks = calculateStreaks(h2hPlayer1)
            const { bestTeammate, worstRival } = calculateTeammateRivalStats(h2hPlayer1)
            const achievements = calculateAchievements(h2hPlayer1)
            const performanceData = getPerformanceData(h2hPlayer1)

            return (
              <div className="player-analytics">
                {/* Player header */}
                <div className="analytics-player-header">
                  {getPlayerPhoto(h2hPlayer1) ? (
                    <img src={getPlayerPhoto(h2hPlayer1)} alt="" className="analytics-avatar" />
                  ) : (
                    <div className="analytics-avatar-placeholder">
                      {getInitials(player?.name || '')}
                    </div>
                  )}
                  <div className="analytics-player-info">
                    <h3>{player?.name}</h3>
                    <p>{player?.played} partidos · {player?.winRate.toFixed(0)}% win rate</p>
                  </div>
                </div>

                {/* Streaks */}
                <div className="analytics-card">
                  <h4>Rachas</h4>
                  <div className="streaks-grid">
                    <div className="streak-item">
                      <span className="streak-label">Racha actual</span>
                      <span className={`streak-value ${streaks.streakType}`}>
                        {streaks.currentStreak} {streaks.streakType === 'win' ? 'V' : 'D'}
                      </span>
                    </div>
                    <div className="streak-item">
                      <span className="streak-label">Mejor racha de victorias</span>
                      <span className="streak-value win">{streaks.maxWinStreak}</span>
                    </div>
                    <div className="streak-item">
                      <span className="streak-label">Peor racha de derrotas</span>
                      <span className="streak-value loss">{streaks.maxLossStreak}</span>
                    </div>
                  </div>
                </div>

                {/* Best teammate / Worst rival */}
                <div className="analytics-card">
                  <h4>Compañeros y Rivales</h4>
                  <div className="teammate-rival-grid">
                    {bestTeammate ? (
                      <div className="teammate-card best">
                        <span className="tr-label">Mejor compañero</span>
                        <span className="tr-name">{getPlayerName(bestTeammate.id)}</span>
                        <span className="tr-stats">{bestTeammate.wins}V - {bestTeammate.total - bestTeammate.wins}D ({bestTeammate.winRate}%)</span>
                      </div>
                    ) : (
                      <div className="teammate-card empty">
                        <span className="tr-label">Mejor compañero</span>
                        <span className="tr-name">—</span>
                        <span className="tr-stats">Necesitas más partidos</span>
                      </div>
                    )}
                    {worstRival ? (
                      <div className="teammate-card worst">
                        <span className="tr-label">Peor rival</span>
                        <span className="tr-name">{getPlayerName(worstRival.id)}</span>
                        <span className="tr-stats">{worstRival.wins}V - {worstRival.total - worstRival.wins}D ({worstRival.winRate}%)</span>
                      </div>
                    ) : (
                      <div className="teammate-card empty">
                        <span className="tr-label">Peor rival</span>
                        <span className="tr-name">—</span>
                        <span className="tr-stats">Necesitas más partidos</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance chart */}
                {performanceData.length > 1 && (
                  <div className="analytics-card chart-card">
                    <h4>Evolución del Rendimiento</h4>
                    <div className="chart-container">
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={performanceData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#333' : '#eee'} />
                          <XAxis dataKey="name" stroke={darkMode ? '#888' : '#666'} fontSize={12} />
                          <YAxis yAxisId="left" domain={[0, 100]} stroke="#10b981" fontSize={12} />
                          <YAxis yAxisId="right" orientation="right" domain={[0, 10]} stroke="#f59e0b" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: darkMode ? '#1a1a1a' : '#fff',
                              border: `1px solid ${darkMode ? '#333' : '#eee'}`,
                              borderRadius: '8px'
                            }}
                          />
                          <Legend />
                          <Line 
                            yAxisId="left"
                            type="monotone" 
                            dataKey="winRate" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ fill: '#10b981' }}
                            name="Win Rate %"
                          />
                          <Line 
                            yAxisId="right"
                            type="monotone" 
                            dataKey="rating" 
                            stroke="#f59e0b" 
                            strokeWidth={2}
                            dot={{ fill: '#f59e0b' }}
                            name="Rating"
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Achievements */}
                <div className="analytics-card">
                  <h4>Logros Desbloqueados</h4>
                  {achievements.length > 0 ? (
                    <div className="achievements-grid">
                      {achievements.map((achievement, idx) => (
                        <div key={idx} className="achievement-badge">
                          <span className="achievement-icon">{achievement.icon}</span>
                          <span className="achievement-name">{achievement.name}</span>
                          <span className="achievement-desc">{achievement.desc}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-achievements">Juega más partidos para desbloquear logros</p>
                  )}
                </div>

                {/* Head to Head section */}
                <div className="analytics-card h2h-card">
                  <h4>Comparar con otro jugador</h4>
                  <select 
                    value={h2hPlayer2 || ''}
                    onChange={(e) => setH2hPlayer2(e.target.value)}
                    className="player-select-dropdown"
                  >
                    <option value="">Seleccionar oponente...</option>
                    {stats.filter(p => p.id !== h2hPlayer1).map(player => (
                      <option key={player.id} value={player.id}>{player.name}</option>
                    ))}
                  </select>

                  {h2hPlayer2 && (() => {
                    const h2h = calculateH2H(h2hPlayer1, h2hPlayer2)
                    return (
                      <div className="h2h-results">
                        <div className="h2h-section">
                          <h5>Cuando juegan juntos</h5>
                          <div className="h2h-stat">
                            <span>{h2h.sameTeamWins}V - {h2h.sameTeamLosses}D</span>
                            <span className="h2h-rate">{h2h.sameTeamWinRate}% win rate</span>
                          </div>
                        </div>
                        <div className="h2h-section">
                          <h5>Cuando son rivales</h5>
                          <div className="h2h-stat">
                            <span>{h2h.oppositeWins}V - {h2h.oppositeLosses}D</span>
                            <span className="h2h-rate">{h2h.h2hWinRate}% vs {getPlayerName(h2hPlayer2)}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
            )
          })()}

          {!h2hPlayer1 && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <h3>Selecciona un jugador</h3>
              <p>Elige un jugador para ver su análisis detallado</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'ratings' && (
        <section className="stats-section">
          <h2 className="section-title">
            {timeFilter === 'all' ? 'Ranking por Calificaciones' : 
             timeFilter === 'month' ? 'Calificaciones del Mes' : 'Calificaciones de la Semana'}
          </h2>
          <p className="section-subtitle">
            {user ? (
              userPlayer ? 
                'Toca un jugador para ver sus calificaciones por partido' :
                'Vincula tu cuenta con un jugador para calificar'
            ) : (
              'Toca un jugador para ver el desglose por partido'
            )}
          </p>
          
          {(() => {
            // Get filtered matches for time period
            const filteredMatches = getFilteredMatches()
            const filteredMatchIds = new Set(filteredMatches.map(m => m.id))
            
            // Calculate filtered ratings stats
            const playerRatingsFiltered = {}
            players.forEach(player => {
              const allRatings = ratings[player.id] || []
              const filtered = allRatings.filter(r => filteredMatchIds.has(r.matchId))
              if (filtered.length > 0) {
                const avg = (filtered.reduce((sum, r) => sum + r.score, 0) / filtered.length).toFixed(1)
                playerRatingsFiltered[player.id] = {
                  id: player.id,
                  name: player.name,
                  avgRating: avg,
                  ratings: filtered
                }
              }
            })
            
            const sortedPlayers = Object.values(playerRatingsFiltered)
              .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
            
            return sortedPlayers.length > 0 ? (
            <div className="ratings-accordion">
              {sortedPlayers.map((player, index) => {
                  const playerRatings = player.ratings
                  const isExpanded = expandedPlayer === player.id
                  
                  // Group ratings by match
                  const ratingsByMatch = {}
                  playerRatings.forEach(r => {
                    if (!ratingsByMatch[r.matchId]) {
                      const match = matches.find(m => m.id === r.matchId)
                      ratingsByMatch[r.matchId] = {
                        match,
                        ratings: []
                      }
                    }
                    ratingsByMatch[r.matchId].ratings.push(r)
                  })
                  
                  return (
                    <div key={player.id} className={`accordion-item ${isExpanded ? 'expanded' : ''}`}>
                      <div 
                        className="accordion-header"
                        onClick={() => setExpandedPlayer(isExpanded ? null : player.id)}
                      >
                        <span className={`rank ${index < 3 ? `rank-${index + 1}` : ''}`}>
                          {index + 1}
                        </span>
                        {getPlayerPhoto(player.id) ? (
                          <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                        ) : (
                          <div className="player-avatar">
                            {getInitials(player.name)}
                          </div>
                        )}
                        <span className="accordion-player-name">{player.name}</span>
                        <span className={`rating-value ${getRatingClass(parseFloat(player.avgRating))}`}>
                          {player.avgRating}
                        </span>
                        <span className="stat-value votes-count">{playerRatings.length} votos</span>
                        <span className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>▼</span>
                      </div>
                      
                      {isExpanded && (
                        <div className="accordion-content">
                          {Object.entries(ratingsByMatch).length > 0 ? (
                            <table className="match-ratings-table">
                              <thead>
                                <tr>
                                  <th>Partido</th>
                                  <th>Promedio</th>
                                  <th>Votos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(ratingsByMatch)
                                  .sort((a, b) => new Date(b[1].match?.date || 0) - new Date(a[1].match?.date || 0))
                                  .map(([matchId, data]) => {
                                    const matchAvg = data.ratings.length > 0
                                      ? (data.ratings.reduce((sum, r) => sum + r.score, 0) / data.ratings.length).toFixed(1)
                                      : '-'
                                    return (
                                      <tr key={matchId}>
                                        <td>
                                          <div className="match-info-cell">
                                            <span className="match-date-small">
                                              {data.match ? formatDate(data.match.date) : 'Partido eliminado'}
                                            </span>
                                            {data.match && (
                                              <span className="match-venue-small">{data.match.venue}</span>
                                            )}
                                          </div>
                                        </td>
                                        <td>
                                          <span className={`rating-value ${getRatingClass(parseFloat(matchAvg))}`}>
                                            {matchAvg}
                                          </span>
                                        </td>
                                        <td>
                                          <span className="stat-value">{data.ratings.length}</span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                              </tbody>
                            </table>
                          ) : (
                            <p className="no-data-text">Sin calificaciones detalladas</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">—</div>
              <h3>Sin calificaciones</h3>
              <p>{timeFilter !== 'all' ? 'No hay calificaciones en este período' : 'Ve a la pestaña de Partidos y califica a tus compañeros'}</p>
            </div>
          )
          })()}
        </section>
      )}

      {activeTab === 'matches' && (
        <section className="stats-section">
          <h2 className="section-title">Historial de Partidos</h2>
          {matches.length > 0 ? (
            [...matches].reverse().map(match => {
              // Calculate top 3 rated players for this match
              const matchPlayerRatings = []
              const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]
              allMatchPlayers.forEach(playerId => {
                const playerRatings = ratings[playerId] || []
                const matchRatings = playerRatings.filter(r => r.matchId === match.id)
                if (matchRatings.length > 0) {
                  const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
                  matchPlayerRatings.push({
                    playerId,
                    name: getPlayerName(playerId),
                    avgRating: avg.toFixed(1),
                    votes: matchRatings.length
                  })
                }
              })
              const top3 = matchPlayerRatings
                .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
                .slice(0, 3)
              
              return (
                <div key={match.id} className="match-card">
                  <div className="match-header">
                    <div>
                      <div className="match-date">{formatDate(match.date)}</div>
                      <div className="match-venue">{match.venue}</div>
                    </div>
                    <div className="match-actions">
                      {user && userPlayer && !predictions[match.id]?.[user.uid] && !match.winner && (
                        <button 
                          className="predict-btn"
                          onClick={() => {
                            setSelectedMatchForPrediction(match)
                            setShowPredictionModal(true)
                          }}
                        >
                          Predecir
                        </button>
                      )}
                      {user && userPlayer && (
                        <button 
                          className="rate-match-btn"
                          onClick={() => openRatingModal(match)}
                        >
                          Calificar
                        </button>
                      )}
                      {isAdmin && (
                        <>
                          <button 
                            className="edit-match-btn"
                            onClick={() => openEditMatch(match)}
                          >
                            Editar
                          </button>
                          <button 
                            className="delete-match-btn"
                            onClick={() => handleDeleteMatch(match.id)}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="match-teams">
                    <div className={`match-team ${match.winner === 'white' ? 'winner' : ''}`}>
                      <div className="match-team-header">
                        <span className="team-badge white"></span>
                        Equipo Blanco
                        {match.winner === 'white' && ' · Ganador'}
                      </div>
                      <div className="match-team-players">
                        {match.teamWhite.map(id => (
                          <span key={id} className="match-player-tag">
                            {getPlayerName(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="vs-badge">VS</div>
                    <div className={`match-team ${match.winner === 'black' ? 'winner' : ''}`}>
                      <div className="match-team-header">
                        <span className="team-badge black"></span>
                        Equipo Negro
                        {match.winner === 'black' && ' · Ganador'}
                      </div>
                      <div className="match-team-players">
                        {match.teamBlack.map(id => (
                          <span key={id} className="match-player-tag">
                            {getPlayerName(id)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {top3.length > 0 && (
                    <div className="match-leaderboard">
                      <div className="leaderboard-title">Top del partido</div>
                      <div className="leaderboard-items">
                        {top3.map((player, idx) => {
                          // Trigger confetti if current user is MVP
                          if (idx === 0 && player.playerId === userPlayer) {
                            setTimeout(() => triggerMVPConfetti(match.id, player.playerId), 500)
                          }
                          return (
                            <div key={player.playerId} className={`leaderboard-item ${idx === 0 && player.playerId === userPlayer ? 'is-me' : ''}`}>
                              <span className={`leaderboard-position ${idx === 0 ? 'gold' : idx === 1 ? 'silver' : 'bronze'}`}>
                                {idx + 1}
                              </span>
                              <span className="leaderboard-name">{player.name}</span>
                              <span className="leaderboard-score">{player.avgRating}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Show predictions for this match */}
                  {predictions[match.id] && Object.keys(predictions[match.id]).length > 0 && (
                    <div className="match-predictions">
                      <div className="predictions-title">Predicciones</div>
                      <div className="predictions-summary">
                        {Object.entries(predictions[match.id]).map(([odedBy, prediction]) => {
                          const predictionCorrect = match.winner === prediction
                          return (
                            <span 
                              key={odedBy} 
                              className={`prediction-chip ${match.winner ? (predictionCorrect ? 'correct' : 'wrong') : ''}`}
                            >
                              {prediction === 'white' ? '⬜' : '⬛'}
                              {match.winner && (predictionCorrect ? ' ✓' : ' ✗')}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="empty-state">
              <div className="icon">—</div>
              <h3>Sin partidos</h3>
              <p>Agrega tu primer partido</p>
            </div>
          )}
        </section>
      )}

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
                  onChange={(e) => setMatchDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Lugar / Evento</label>
                <input 
                  type="text" 
                  value={matchVenue}
                  onChange={(e) => setMatchVenue(e.target.value)}
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
                <button 
                  className="cancel-btn"
                  onClick={resetMatchForm}
                >
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

      {activeTab === 'players' && isAdmin && (
        <section className="stats-section">
          <h2 className="section-title">Lista de Jugadores</h2>
          <div className="players-grid">
            {players.map(player => (
              <div key={player.id} className="player-card">
                {getPlayerPhoto(player.id) ? (
                  <img src={getPlayerPhoto(player.id)} alt="" className="player-avatar-img" />
                ) : (
                  <div className="player-avatar">
                    {getInitials(player.name)}
                  </div>
                )}
                <div className="player-card-info">
                  <h3>{player.name}</h3>
                  {player.aliases && player.aliases.length > 0 && (
                    <div className="aliases">
                      aka: {player.aliases.join(', ')}
                    </div>
                  )}
                </div>
                <div className="player-card-actions">
                  <button 
                    className="edit-player-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditPlayer(player)
                    }}
                    title="Editar jugador"
                  >
                    Editar
                  </button>
                  <button 
                    className="delete-player-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeletePlayer(player.id, player.name)
                    }}
                    title="Eliminar jugador"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
            <div className="add-player-card" onClick={() => { setEditingPlayerId(null); setShowPlayerModal(true); }}>
              <span style={{ fontSize: '1.2rem', fontWeight: '300' }}>+</span>
              Agregar Jugador
            </div>
          </div>
        </section>
      )}

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
                        <img src={data.userPhoto || data.odedByPhoto} alt="" className="user-link-avatar" />
                        <div>
                          <div className="user-link-name">{data.userName || data.odedByName}</div>
                          <div className="user-link-email">{data.userEmail || data.odedByEmail}</div>
                        </div>
                      </div>
                      <div className="user-link-player">
                        → <strong>{getPlayerName(data.playerId)}</strong>
                      </div>
                      <button 
                        className="unlink-btn"
                        onClick={() => adminUnlinkUser(odedBy)}
                      >
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

          {/* Sección de gestión de admins - solo para super admin */}
          {user && user.email && user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() && (
            <div className="admin-management-section">
              <h3 className="subsection-title">Gestionar Administradores</h3>
              <p className="section-subtitle">
                Los admins pueden vincular usuarios y editar partidos
              </p>
              
              <div className="add-admin-form">
                <input 
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="email@gmail.com"
                  className="admin-email-input"
                />
                <button onClick={handleAddAdmin} className="add-admin-btn">
                  + Agregar
                </button>
              </div>

              <div className="admin-list">
                <div className="admin-item super">
                  <span>👑 {SUPER_ADMIN_EMAIL}</span>
                  <span className="admin-badge">Super Admin</span>
                </div>
                {adminEmails.map(email => (
                  <div key={email} className="admin-item">
                    <span>{email}</span>
                    <button 
                      onClick={() => handleRemoveAdmin(email)}
                      className="remove-admin-btn"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* All Ratings Tab - Admin only */}
      {activeTab === 'allRatings' && isAdmin && (
        <section className="stats-section">
          <h2 className="section-title">Historial de Calificaciones</h2>
          <p className="section-subtitle">
            Detalle de quién calificó a quién en cada partido
          </p>
          
          {/* Cleanup button for orphaned ratings */}
          {(() => {
            // Find orphaned ratings (ratings for deleted matches)
            const matchIds = new Set(matches.map(m => m.id))
            let orphanedCount = 0
            Object.values(ratings).forEach(playerRatings => {
              playerRatings.forEach(r => {
                if (!matchIds.has(r.matchId)) orphanedCount++
              })
            })
            
            const cleanupOrphanedRatings = async () => {
              if (!confirm(`¿Eliminar ${orphanedCount} calificaciones huérfanas (de partidos eliminados)?`)) return
              
              try {
                const batch = writeBatch(db)
                const ratingsSnapshot = await getDocs(collection(db, 'ratings'))
                
                ratingsSnapshot.docs.forEach(docSnap => {
                  const data = docSnap.data()
                  if (!matchIds.has(data.matchId)) {
                    batch.delete(doc(db, 'ratings', docSnap.id))
                  }
                })
                
                await batch.commit()
                showToast('success', `${orphanedCount} calificaciones eliminadas`)
              } catch (error) {
                console.error('Error cleaning up ratings:', error)
                showToast('error', 'Error al limpiar calificaciones')
              }
            }
            
            return orphanedCount > 0 && (
              <div className="cleanup-section">
                <button className="cleanup-btn" onClick={cleanupOrphanedRatings}>
                  🗑️ Limpiar {orphanedCount} calificaciones huérfanas
                </button>
              </div>
            )
          })()}
          
          {(() => {
            // Calculate total average across all ratings
            let allScores = []
            Object.values(ratings).forEach(playerRatings => {
              playerRatings.forEach(r => allScores.push(r.score))
            })
            const totalAverage = allScores.length > 0 
              ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)
              : null
            
            return matches.length > 0 ? (
              <>
                {[...matches].reverse().map(match => {
                  // Get all ratings for this match
                  const matchRatings = []
                  Object.entries(ratings).forEach(([playerId, playerRatings]) => {
                    playerRatings.forEach(rating => {
                      if (rating.matchId === match.id) {
                        // Find the email of the rater from userLinks
                        const raterLink = Object.entries(userLinks).find(([uid, data]) => data.playerId === rating.ratedBy)
                        const raterEmail = raterLink ? (raterLink[1].userEmail || raterLink[1].odedByEmail) : 'Email no encontrado'
                        const raterDisplayName = raterLink ? (raterLink[1].userName || raterLink[1].odedByName) : getPlayerName(rating.ratedBy)
                        
                        matchRatings.push({
                          ...rating,
                          ratedPlayerName: getPlayerName(playerId),
                          raterName: getPlayerName(rating.ratedBy),
                          raterEmail: raterEmail,
                          raterDisplayName: raterDisplayName
                        })
                      }
                    })
                  })
                  
                  // Calculate match average
                  const matchAvg = matchRatings.length > 0 
                    ? (matchRatings.reduce((a, r) => a + r.score, 0) / matchRatings.length).toFixed(2)
                    : null
                  
                  // Group by rater
                  const ratingsByRater = {}
                  matchRatings.forEach(r => {
                    if (!ratingsByRater[r.ratedBy]) {
                      ratingsByRater[r.ratedBy] = {
                        raterName: r.raterName,
                        raterEmail: r.raterEmail,
                        raterDisplayName: r.raterDisplayName,
                        ratings: []
                      }
                    }
                    ratingsByRater[r.ratedBy].ratings.push(r)
                  })
                  
                  return (
                    <div key={match.id} className="match-ratings-card">
                      <div className="match-ratings-header">
                        <h3>{formatDate(match.date)}</h3>
                        <span className="match-venue-tag">{match.venue}</span>
                      </div>
                      
                      {Object.keys(ratingsByRater).length > 0 ? (
                        <>
                          <div className="ratings-by-rater">
                            {Object.entries(ratingsByRater).map(([raterId, data]) => (
                              <div key={raterId} className="rater-section">
                                <div className="rater-header">
                                  <span className="rater-name">{data.raterDisplayName || data.raterName}</span>
                                  <span className="rater-email">({data.raterEmail})</span>
                                  <span className="rater-action"> calificó:</span>
                                </div>
                                <div className="rater-ratings">
                                  {data.ratings.map((r, idx) => (
                                    <div key={idx} className="rating-detail">
                                      <span className="rated-player">{r.ratedPlayerName}</span>
                                      <span className={`rating-score ${getRatingClass(r.score)}`}>
                                        {r.score}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="match-average">
                            <span className="match-average-label">Promedio del partido:</span>
                            <span className={`match-average-value ${getRatingClass(parseFloat(matchAvg))}`}>
                              {matchAvg}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="no-ratings-yet">
                          <p>Nadie ha calificado este partido aún</p>
                        </div>
                      )}
                    </div>
                  )
                })}
                
                {totalAverage && (
                  <div className="total-average-section">
                    <div className="total-average-label">Promedio Total de Todas las Calificaciones</div>
                    <div className={`total-average-value ${getRatingClass(parseFloat(totalAverage))}`}>
                      {totalAverage}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state">
                <p>No hay partidos registrados</p>
              </div>
            )
          })()}
        </section>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Acceso Admin</h2>
              <button className="modal-close" onClick={() => setShowLoginModal(false)}>×</button>
            </div>
            <div className="form-group">
              <label>Contraseña</label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value)
                  setLoginError('')
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminLogin()}
                placeholder="Ingresa la contraseña"
                autoFocus
              />
              {loginError && <p className="error-text">{loginError}</p>}
            </div>
            <button className="submit-btn" onClick={handleAdminLogin}>
              ENTRAR
            </button>
          </div>
        </div>
      )}

      {/* Pending User Modal - shown when user is not linked and data has loaded */}
      {user && !userPlayer && !isAdmin && userLinksLoaded && (
        <div className="modal-overlay">
          <div className="modal pending-modal">
            <div className="pending-content">
              <img src={user.photoURL} alt="" className="pending-avatar" />
              <h2>{user.displayName}</h2>
              <p className="pending-status">Cuenta registrada</p>
              <div className="pending-info">
                <p>El administrador debe vincularte con tu jugador para que puedas calificar.</p>
              </div>
              <button className="submit-btn" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <button className="modal-close" onClick={closeRatingModal}>×</button>
                </div>
                <p className="modal-subtitle">
                  {formatDate(selectedMatch.date)} - {selectedMatch.venue}
                </p>
                
                <div className="rating-list">
                  {getPlayersToRate(selectedMatch).map(playerId => (
                    <div key={playerId} className="rating-item">
                      <div className="rating-player">
                        {getPlayerPhoto(playerId) ? (
                          <img src={getPlayerPhoto(playerId)} alt="" className="player-avatar-img small" />
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
                  {hasMyRatings(selectedMatch.id) && (
                    <button 
                      className="delete-btn"
                      onClick={() => deleteMyRatings(selectedMatch.id)}
                    >
                      Borrar mis calificaciones
                    </button>
                  )}
                  <button 
                    className="submit-btn"
                    onClick={submitRatings}
                    disabled={Object.keys(currentRatings).length === 0}
                  >
                    {Object.keys(currentRatings).length < getPlayersToRate(selectedMatch).length 
                      ? `Faltan ${getPlayersToRate(selectedMatch).length - Object.keys(currentRatings).length} jugadores`
                      : (hasMyRatings(selectedMatch.id) ? 'Actualizar' : 'Guardar')
                    }
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Add/Edit Player Modal */}
      {showPlayerModal && isAdmin && (
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
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Nombre del jugador"
              />
            </div>
            <div className="form-group">
              <label>Aliases (separados por coma)</label>
              <input 
                type="text" 
                value={newPlayerAliases}
                onChange={(e) => setNewPlayerAliases(e.target.value)}
                placeholder="Alias1, Alias2"
              />
            </div>
            <button className="submit-btn" onClick={handleAddPlayer}>
              {editingPlayerId ? 'Guardar cambios' : 'Agregar jugador'}
            </button>
          </div>
        </div>
      )}

      {/* Prediction Modal */}
      {showPredictionModal && selectedMatchForPrediction && (
        <div className="modal-overlay" onClick={() => setShowPredictionModal(false)}>
          <div className="modal prediction-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>¿Quién ganará?</h2>
              <button className="modal-close" onClick={() => setShowPredictionModal(false)}>×</button>
            </div>
            <p className="prediction-match-info">
              {formatDate(selectedMatchForPrediction.date)} - {selectedMatchForPrediction.venue}
            </p>
            <div className="prediction-options">
              <button 
                className="prediction-btn white"
                onClick={() => submitPrediction(selectedMatchForPrediction.id, 'white')}
              >
                <span className="team-badge white"></span>
                <span>Equipo Blanco</span>
                <div className="prediction-players">
                  {selectedMatchForPrediction.teamWhite.slice(0, 3).map(id => getPlayerName(id)).join(', ')}
                  {selectedMatchForPrediction.teamWhite.length > 3 && '...'}
                </div>
              </button>
              <button 
                className="prediction-btn black"
                onClick={() => submitPrediction(selectedMatchForPrediction.id, 'black')}
              >
                <span className="team-badge black"></span>
                <span>Equipo Negro</span>
                <div className="prediction-players">
                  {selectedMatchForPrediction.teamBlack.slice(0, 3).map(id => getPlayerName(id)).join(', ')}
                  {selectedMatchForPrediction.teamBlack.length > 3 && '...'}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Player Profile Modal */}
      {showPlayerProfile && selectedPlayerProfile && (() => {
        const player = players.find(p => p.id === selectedPlayerProfile)
        const playerStats = stats.find(s => s.id === selectedPlayerProfile)
        const xp = calculateXP(selectedPlayerProfile)
        const rank = getRank(xp)
        const xpProgress = getXPProgress(xp)
        const achievements = calculateAchievements(selectedPlayerProfile)
        const streaks = calculateStreaks(selectedPlayerProfile)
        const { bestTeammate, worstRival } = calculateTeammateRivalStats(selectedPlayerProfile)
        
        return (
          <div className="modal-overlay" onClick={() => setShowPlayerProfile(false)}>
            <div className="modal profile-modal" onClick={e => e.stopPropagation()}>
              <button className="modal-close" onClick={() => setShowPlayerProfile(false)}>×</button>
              
              {/* Profile Header */}
              <div className="profile-header">
                {getPlayerPhoto(selectedPlayerProfile) ? (
                  <img src={getPlayerPhoto(selectedPlayerProfile)} alt="" className="profile-avatar" />
                ) : (
                  <div className="profile-avatar-placeholder">
                    {getInitials(player?.name || '')}
                  </div>
                )}
                <h2>{player?.name}</h2>
                <div className="profile-rank" style={{ color: rank.color }}>
                  {rank.icon} {rank.name}
                </div>
              </div>
              
              {/* XP Progress */}
              <div className="xp-progress-card">
                <div className="xp-header">
                  <span className="xp-total">{xp} XP</span>
                  <span className="xp-next">Siguiente: {xpProgress.next} XP</span>
                </div>
                <div className="xp-bar">
                  <div className="xp-fill" style={{ width: `${xpProgress.progress}%` }}></div>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="profile-stats-grid">
                <div className="profile-stat">
                  <span className="stat-number wins">{playerStats?.wins || 0}</span>
                  <span className="stat-label">Victorias</span>
                </div>
                <div className="profile-stat">
                  <span className="stat-number losses">{playerStats?.losses || 0}</span>
                  <span className="stat-label">Derrotas</span>
                </div>
                <div className="profile-stat">
                  <span className="stat-number">{playerStats?.winRate?.toFixed(0) || 0}%</span>
                  <span className="stat-label">Win Rate</span>
                </div>
                <div className="profile-stat">
                  <span className="stat-number">{playerStats?.mvps || 0}</span>
                  <span className="stat-label">MVPs</span>
                </div>
                <div className="profile-stat">
                  <span className="stat-number">{playerStats?.avgRating || '-'}</span>
                  <span className="stat-label">Rating</span>
                </div>
                <div className="profile-stat">
                  <span className="stat-number">{playerStats?.played || 0}</span>
                  <span className="stat-label">Partidos</span>
                </div>
              </div>
              
              {/* Streaks */}
              <div className="profile-section">
                <h4>Rachas</h4>
                <div className="profile-streaks">
                  <div className={`streak-badge ${streaks.streakType}`}>
                    Actual: {streaks.currentStreak} {streaks.streakType === 'win' ? 'V' : 'D'}
                  </div>
                  <div className="streak-badge win">Mejor: {streaks.maxWinStreak}V</div>
                </div>
              </div>
              
              {/* Teammate/Rival */}
              <div className="profile-section">
                <h4>Compañeros y Rivales</h4>
                <div className="profile-tr-grid">
                  <div className="profile-tr best">
                    <span className="tr-icon">🤝</span>
                    <span className="tr-title">Mejor compañero</span>
                    <span className="tr-value">{bestTeammate ? getPlayerName(bestTeammate.id) : '—'}</span>
                    {bestTeammate && <span className="tr-rate">{bestTeammate.winRate}% juntos</span>}
                  </div>
                  <div className="profile-tr worst">
                    <span className="tr-icon">⚔️</span>
                    <span className="tr-title">Peor rival</span>
                    <span className="tr-value">{worstRival ? getPlayerName(worstRival.id) : '—'}</span>
                    {worstRival && <span className="tr-rate">{worstRival.winRate}% contra él</span>}
                  </div>
                </div>
              </div>
              
              {/* Achievements */}
              <div className="profile-section">
                <h4>Logros ({achievements.length})</h4>
                <div className="profile-achievements">
                  {achievements.length > 0 ? (
                    achievements.slice(0, 8).map((a, i) => (
                      <div key={i} className="mini-achievement" title={a.desc}>
                        <span>{a.icon}</span>
                      </div>
                    ))
                  ) : (
                    <p className="no-data">Juega más para desbloquear logros</p>
                  )}
                  {achievements.length > 8 && (
                    <div className="mini-achievement more">+{achievements.length - 8}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Bottom Navigation */}
      <nav className="bottom-nav">
        <button 
          className={`bottom-nav-item ${activeTab === 'stats' && !showPlayerProfile ? 'active' : ''}`}
          onClick={() => {
            setShowPlayerProfile(false)
            setActiveTab('stats')
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h2v8H3v-8zm4-6h2v14H7V7zm4-4h2v18h-2V3zm4 8h2v10h-2V11zm4-4h2v14h-2V7z"/>
          </svg>
          <span>Ranking</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'ratings' && !showPlayerProfile ? 'active' : ''}`}
          onClick={() => {
            setShowPlayerProfile(false)
            setActiveTab('ratings')
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
          <span>Rating</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'matches' && !showPlayerProfile ? 'active' : ''}`}
          onClick={() => {
            setShowPlayerProfile(false)
            setActiveTab('matches')
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          <span>Partidos</span>
        </button>
        <button 
          className={`bottom-nav-item ${activeTab === 'analytics' && !showPlayerProfile ? 'active' : ''}`}
          onClick={() => {
            setShowPlayerProfile(false)
            setActiveTab('analytics')
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
          </svg>
          <span>Análisis</span>
        </button>
        {userPlayer && (
          <button 
            className={`bottom-nav-item ${showPlayerProfile && selectedPlayerProfile === userPlayer ? 'active' : ''}`}
            onClick={() => {
              setSelectedPlayerProfile(userPlayer)
              setShowPlayerProfile(true)
            }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            <span>Perfil</span>
          </button>
        )}
      </nav>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default App
