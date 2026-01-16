import { useState, useEffect } from 'react'
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

// ⚠️ CAMBIA ESTA CONTRASEÑA por una que solo tú conozcas
const ADMIN_PASSWORD = 'lukto2026'

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

function App() {
  const [activeTab, setActiveTab] = useState('stats')
  const [players, setPlayers] = useState(initialPlayers)
  const [matches, setMatches] = useState(initialMatches)
  const [ratings, setRatings] = useState({})
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerAliases, setNewPlayerAliases] = useState('')
  
  // Auth state
  const [user, setUser] = useState(null)
  const [userPlayer, setUserPlayer] = useState(null)
  const [showLinkPlayerModal, setShowLinkPlayerModal] = useState(false)
  const [userLinks, setUserLinks] = useState({}) // {odedBy: { odedBy, odedByName, odedByPhoto, playerId }}
  const [pendingUsers, setPendingUsers] = useState([]) // Users waiting to be linked
  
  // Admin mode
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  
  // Rating modal
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState(null)
  const [currentRatings, setCurrentRatings] = useState({})
  
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

  // Load user links from Firebase and check current user's link
  useEffect(() => {
    const unsubLinks = onSnapshot(collection(db, 'userLinks'), (snapshot) => {
      const links = {}
      const pending = []
      
      snapshot.docs.forEach(doc => {
        const data = doc.data()
        if (data.playerId) {
          links[doc.id] = data
        } else {
          // User is pending (registered but not linked)
          pending.push({ odedBy: doc.id, ...data })
        }
      })
      
      setUserLinks(links)
      setPendingUsers(pending)
      
      // Check if current user is linked
      if (user && links[user.uid]) {
        setUserPlayer(links[user.uid].playerId)
      } else if (user) {
        setUserPlayer(null)
        // Register as pending if not already
        registerPendingUser()
      }
    }, (error) => {
      console.error('Error loading user links:', error)
    })

    return () => unsubLinks()
  }, [user])

  // Register user as pending when they log in
  const registerPendingUser = async () => {
    if (!user) return
    
    try {
      const linkRef = doc(db, 'userLinks', user.uid)
      await setDoc(linkRef, {
        odedByName: user.displayName,
        odedByEmail: user.email,
        odedByPhoto: user.photoURL,
        playerId: null,
        registeredAt: new Date().toISOString()
      }, { merge: true })
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
      }, (error) => {
        console.error('Error loading matches:', error)
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
  }

  const handleLinkPlayer = (playerId) => {
    // Old function - kept for compatibility but now only admin can link
    if (user) {
      setShowLinkPlayerModal(false)
    }
  }

  // Admin function to link a user to a player
  const adminLinkUserToPlayer = async (odedBy, playerId) => {
    if (!isAdmin) return
    
    try {
      const linkRef = doc(db, 'userLinks', odedBy)
      await updateDoc(linkRef, { playerId })
    } catch (error) {
      console.error('Error linking user:', error)
      alert('Error al vincular usuario')
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
      alert('Error al desvincular usuario')
    }
  }

  // Handle admin login
  const handleAdminLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      setShowLoginModal(false)
      setPasswordInput('')
      setLoginError('')
    } else {
      setLoginError('Contraseña incorrecta')
    }
  }

  const handleAdminLogout = () => {
    setIsAdmin(false)
    setActiveTab('stats')
  }

  // Calculate stats for each player
  const calculateStats = () => {
    const stats = {}
    
    players.forEach(player => {
      stats[player.id] = { 
        wins: 0, 
        losses: 0, 
        played: 0,
        name: player.name,
        aliases: player.aliases || []
      }
    })

    matches.forEach(match => {
      const whiteWon = match.winner === 'white'
      
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
      alert('Por favor completa todos los campos')
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
    if (!confirm('¿Estás seguro de eliminar este partido? Esta acción no se puede deshacer.')) return
    
    try {
      await deleteDoc(doc(db, 'matches', matchId))
    } catch (error) {
      console.error('Error deleting match:', error)
      alert('Error al eliminar partido')
    }
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return
    
    const newPlayerId = Date.now().toString()
    const newPlayer = {
      name: newPlayerName.trim(),
      aliases: newPlayerAliases.split(',').map(a => a.trim()).filter(a => a)
    }
    
    await setDoc(doc(db, 'players', newPlayerId), newPlayer)
    
    setNewPlayerName('')
    setNewPlayerAliases('')
    setShowPlayerModal(false)
  }

  const handleDeletePlayer = async (playerId, playerName) => {
    if (!confirm(`¿Estás seguro de eliminar a "${playerName}"? Esta acción no se puede deshacer.`)) return
    
    try {
      await deleteDoc(doc(db, 'players', playerId))
    } catch (error) {
      console.error('Error deleting player:', error)
      alert('Error al eliminar jugador')
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
      alert('Error al actualizar jugador')
    }
  }

  // Rating functions
  const openRatingModal = (match) => {
    if (!userPlayer) {
      alert('Primero debes vincular tu cuenta con un jugador')
      return
    }
    
    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    if (!allPlayers.includes(userPlayer)) {
      alert('Solo puedes calificar partidos en los que jugaste')
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
    setShowRatingModal(false)
    setSelectedMatch(null)
    setCurrentRatings({})
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
    <div className="app-container">
      <header className="header">
        <h1>LUKTO STATS</h1>
        <p className="subtitle">Win Rate & Ratings Tracker</p>
        
        {/* User auth section */}
        <div className="auth-section">
          {user ? (
            <div className="user-info">
              <img src={user.photoURL} alt="" className="user-avatar" />
              <span className="user-name">{user.displayName}</span>
              {userPlayer && (
                <span className="linked-player">
                  ({getPlayerName(userPlayer)})
                </span>
              )}
              <button className="auth-btn logout" onClick={handleLogout}>
                Salir
              </button>
            </div>
          ) : (
            <button className="auth-btn google" onClick={handleGoogleLogin}>
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar con Google
            </button>
          )}
        </div>
        
        {/* Admin button */}
        <div className="admin-toggle">
          {isAdmin ? (
            <button className="admin-btn active" onClick={handleAdminLogout}>
              🔓 Modo Admin
            </button>
          ) : (
            <button className="admin-btn" onClick={() => setShowLoginModal(true)}>
              🔒 Admin
            </button>
          )}
        </div>
      </header>

      <nav className="nav-tabs">
        <button 
          className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          📊 Estadísticas
        </button>
        <button 
          className={`nav-tab ${activeTab === 'ratings' ? 'active' : ''}`}
          onClick={() => setActiveTab('ratings')}
        >
          ⭐ Calificaciones
        </button>
        <button 
          className={`nav-tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          ⚽ Partidos
        </button>
        {isAdmin && (
          <>
            <button 
              className={`nav-tab ${activeTab === 'new' ? 'active' : ''}`}
              onClick={() => setActiveTab('new')}
            >
              ➕ Nuevo Partido
            </button>
            <button 
              className={`nav-tab ${activeTab === 'players' ? 'active' : ''}`}
              onClick={() => setActiveTab('players')}
            >
              👥 Jugadores
            </button>
            <button 
              className={`nav-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              🔗 Vincular Usuarios {pendingUsers.length > 0 && <span className="badge">{pendingUsers.length}</span>}
            </button>
          </>
        )}
      </nav>

      {activeTab === 'stats' && (
        <section className="stats-section">
          <h2 className="section-title">Ranking de Jugadores</h2>
          {stats.length > 0 ? (
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Win Rate</th>
                  <th></th>
                  <th>V</th>
                  <th>D</th>
                  <th>PJ</th>
                  <th>⭐ Rating</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((player, index) => (
                  <tr key={player.id}>
                    <td>
                      <span className={`rank rank-${index + 1}`}>
                        {index + 1}
                      </span>
                    </td>
                    <td>
                      <div className="player-name">
                        <div className="player-avatar">
                          {getInitials(player.name)}
                        </div>
                        {player.name}
                      </div>
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
                    <td><span className="stat-value">{player.played}</span></td>
                    <td>
                      {player.avgRating ? (
                        <span className={`rating-value ${getRatingClass(parseFloat(player.avgRating))}`}>
                          ⭐ {player.avgRating}
                        </span>
                      ) : (
                        <span className="no-rating">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="icon">📊</div>
              <h3>Sin estadísticas</h3>
              <p>Agrega partidos para ver las estadísticas</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'ratings' && (
        <section className="stats-section">
          <h2 className="section-title">Ranking por Calificaciones</h2>
          <p className="section-subtitle">
            {user ? (
              userPlayer ? 
                'Califica a tus compañeros después de cada partido' :
                'Vincula tu cuenta con un jugador para calificar'
            ) : (
              'Inicia sesión con Google para calificar jugadores'
            )}
          </p>
          
          {stats.filter(p => p.avgRating).length > 0 ? (
            <div className="ratings-grid">
              {stats
                .filter(p => p.avgRating)
                .sort((a, b) => parseFloat(b.avgRating) - parseFloat(a.avgRating))
                .map((player, index) => (
                  <div key={player.id} className="rating-card">
                    <div className="rating-rank">#{index + 1}</div>
                    <div className="player-avatar large">
                      {getInitials(player.name)}
                    </div>
                    <h3>{player.name}</h3>
                    <div className={`big-rating ${getRatingClass(parseFloat(player.avgRating))}`}>
                      ⭐ {player.avgRating}
                    </div>
                    <div className="rating-votes">
                      {ratings[player.id]?.length || 0} calificaciones
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="icon">⭐</div>
              <h3>Sin calificaciones aún</h3>
              <p>Ve a la pestaña de Partidos y califica a tus compañeros</p>
            </div>
          )}
        </section>
      )}

      {activeTab === 'matches' && (
        <section className="stats-section">
          <h2 className="section-title">Historial de Partidos</h2>
          {matches.length > 0 ? (
            [...matches].reverse().map(match => (
              <div key={match.id} className="match-card">
                <div className="match-header">
                  <div>
                    <div className="match-date">{formatDate(match.date)}</div>
                    <div className="match-venue">{match.venue}</div>
                  </div>
                  <div className="match-actions">
                    {user && userPlayer && (
                      <button 
                        className="rate-match-btn"
                        onClick={() => openRatingModal(match)}
                      >
                        ⭐ Calificar
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button 
                          className="edit-match-btn"
                          onClick={() => openEditMatch(match)}
                        >
                          ✏️ Editar
                        </button>
                        <button 
                          className="delete-match-btn"
                          onClick={() => handleDeleteMatch(match.id)}
                        >
                          🗑️
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
                      {match.winner === 'white' && ' 🏆'}
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
                      {match.winner === 'black' && ' 🏆'}
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
              </div>
            ))
          ) : (
            <div className="empty-state">
              <div className="icon">⚽</div>
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
                <div className="player-avatar">
                  {getInitials(player.name)}
                </div>
                <div className="player-card-info">
                  <h3>{player.name}</h3>
                  {player.aliases && player.aliases.length > 0 && (
                    <div className="aliases">
                      aka: {player.aliases.join(', ')}
                    </div>
                  )}
                </div>
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
            ))}
            <div className="add-player-card" onClick={() => setShowPlayerModal(true)}>
              <span style={{ fontSize: '1.5rem' }}>➕</span>
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
              <h3 className="subsection-title">⏳ Usuarios Pendientes ({pendingUsers.length})</h3>
              <div className="user-links-list">
                {pendingUsers.map(pending => (
                  <div key={pending.odedBy} className="user-link-card pending">
                    <div className="user-link-info">
                      <img src={pending.odedByPhoto} alt="" className="user-link-avatar" />
                      <div>
                        <div className="user-link-name">{pending.odedByName}</div>
                        <div className="user-link-email">{pending.odedByEmail}</div>
                      </div>
                    </div>
                    <div className="user-link-action">
                      <select 
                        className="player-select-dropdown"
                        onChange={(e) => {
                          if (e.target.value) {
                            adminLinkUserToPlayer(pending.odedBy, e.target.value)
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="">Selecciona jugador...</option>
                        {players.map(player => (
                          <option key={player.id} value={player.id}>
                            {player.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="linked-users-section">
            <h3 className="subsection-title">✅ Usuarios Vinculados</h3>
            <div className="user-links-list">
              {Object.entries(userLinks).filter(([_, data]) => data.playerId).length > 0 ? (
                Object.entries(userLinks)
                  .filter(([_, data]) => data.playerId)
                  .map(([odedBy, data]) => (
                    <div key={odedBy} className="user-link-card linked">
                      <div className="user-link-info">
                        <img src={data.odedByPhoto} alt="" className="user-link-avatar" />
                        <div>
                          <div className="user-link-name">{data.odedByName}</div>
                          <div className="user-link-email">{data.odedByEmail}</div>
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
        </section>
      )}

      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🔐 Acceso Admin</h2>
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

      {/* Pending User Modal - shown when user is not linked */}
      {user && !userPlayer && !isAdmin && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>⏳ Esperando Aprobación</h2>
            </div>
            <div className="pending-message">
              <img src={user.photoURL} alt="" className="pending-avatar" />
              <p><strong>{user.displayName}</strong></p>
              <p>Tu cuenta ha sido registrada.</p>
              <p>El administrador debe vincularte con tu jugador para que puedas calificar.</p>
              <p className="pending-hint">Avísale al admin que te vincule 😉</p>
            </div>
            <button className="submit-btn" onClick={handleLogout}>
              CERRAR SESIÓN
            </button>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {showRatingModal && selectedMatch && (
        <div className="modal-overlay" onClick={() => setShowRatingModal(false)}>
          <div className="modal rating-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⭐ {hasMyRatings(selectedMatch.id) ? 'Editar' : 'Calificar'} Jugadores</h2>
              <button className="modal-close" onClick={() => setShowRatingModal(false)}>×</button>
            </div>
            <p className="modal-subtitle">
              {formatDate(selectedMatch.date)} - {selectedMatch.venue}
            </p>
            
            <div className="rating-list">
              {getPlayersToRate(selectedMatch).map(playerId => (
                <div key={playerId} className="rating-item">
                  <div className="rating-player">
                    <div className="player-avatar small">
                      {getInitials(getPlayerName(playerId))}
                    </div>
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
                  🗑️ BORRAR MIS CALIFICACIONES
                </button>
              )}
              <button 
                className="submit-btn"
                onClick={submitRatings}
                disabled={Object.keys(currentRatings).length === 0}
              >
                {hasMyRatings(selectedMatch.id) ? 'ACTUALIZAR' : 'GUARDAR'} CALIFICACIONES
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showPlayerModal && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowPlayerModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Nuevo Jugador</h2>
              <button className="modal-close" onClick={() => setShowPlayerModal(false)}>×</button>
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
              AGREGAR JUGADOR
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
