import { useState, useEffect } from 'react'

// ⚠️ CAMBIA ESTA CONTRASEÑA por una que solo tú conozcas
const ADMIN_PASSWORD = 'lukto2026'

// Datos iniciales de jugadores con sus aliases
const initialPlayers = [
  { id: 1, name: 'Colombia Pana', aliases: ['Costaman'] },
  { id: 2, name: 'G-sus', aliases: ['Manuno'] },
  { id: 3, name: 'Jaime', aliases: ['Jotin'] },
  { id: 4, name: 'Pana Sida', aliases: ['Pana Mopri'] },
  { id: 5, name: 'Javi', aliases: ['Javinho'] },
  { id: 6, name: 'Werz', aliases: [] },
  { id: 7, name: 'Bob', aliases: [] },
  { id: 8, name: 'Luigi', aliases: [] },
  { id: 9, name: 'Miguel', aliases: [] },
  { id: 10, name: 'Urzola', aliases: [] },
  { id: 11, name: 'Yoc', aliases: [] },
  { id: 12, name: 'Harry Potter', aliases: [] },
  { id: 13, name: 'Manuel', aliases: [] },
  { id: 14, name: 'Felao', aliases: [] },
  { id: 15, name: 'Ivan', aliases: [] },
  { id: 16, name: 'Ketrox', aliases: [] },
  { id: 17, name: 'Bohr', aliases: [] },
  { id: 18, name: 'Villa', aliases: [] },
  { id: 19, name: 'Chechinsito', aliases: [] },
  { id: 20, name: 'Werson', aliases: [] },
]

// Partidos iniciales basados en los datos proporcionados
const initialMatches = [
  {
    id: 1,
    date: '2026-01-08',
    venue: 'LUKTO',
    teamWhite: [2, 7, 11, 5, 19, 20], // G-sus, Bob, Yoc, Javi, Chechinsito, Werson
    teamBlack: [1, 15, 16, 4, 17, 18], // Colombia Pana, Ivan, Ketrox, Pana Sida, Bohr, Villa
    winner: 'white'
  },
  {
    id: 2,
    date: '2026-01-15',
    venue: 'LUKTO - FSB',
    teamWhite: [6, 7, 5, 8, 9, 3], // Werz, Bob, Javi, Luigi, Miguel, Jaime
    teamBlack: [1, 10, 11, 12, 13, 14], // Colombia Pana, Urzola, Yoc, Harry Potter, Manuel, Felao
    winner: 'black'
  }
]

function App() {
  const [activeTab, setActiveTab] = useState('stats')
  const [players, setPlayers] = useState(() => {
    const saved = localStorage.getItem('lukto-players')
    return saved ? JSON.parse(saved) : initialPlayers
  })
  const [matches, setMatches] = useState(() => {
    const saved = localStorage.getItem('lukto-matches')
    return saved ? JSON.parse(saved) : initialMatches
  })
  const [showPlayerModal, setShowPlayerModal] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerAliases, setNewPlayerAliases] = useState('')
  
  // Admin mode
  const [isAdmin, setIsAdmin] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')
  
  // Match form state
  const [matchDate, setMatchDate] = useState('')
  const [matchVenue, setMatchVenue] = useState('LUKTO')
  const [teamWhite, setTeamWhite] = useState([])
  const [teamBlack, setTeamBlack] = useState([])
  const [winner, setWinner] = useState('')

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('lukto-players', JSON.stringify(players))
  }, [players])

  useEffect(() => {
    localStorage.setItem('lukto-matches', JSON.stringify(matches))
  }, [matches])

  // Handle admin login
  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      setShowLoginModal(false)
      setPasswordInput('')
      setLoginError('')
    } else {
      setLoginError('Contraseña incorrecta')
    }
  }

  const handleLogout = () => {
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
        aliases: player.aliases
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
        id: parseInt(id),
        ...s,
        winRate: s.played > 0 ? (s.wins / s.played) * 100 : 0
      }))
      .sort((a, b) => b.winRate - a.winRate || b.wins - a.wins)
  }

  const stats = calculateStats()

  const getWinRateClass = (rate) => {
    if (rate >= 60) return 'high'
    if (rate >= 40) return 'medium'
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

  const handleAddMatch = () => {
    if (!matchDate || teamWhite.length === 0 || teamBlack.length === 0 || !winner) {
      alert('Por favor completa todos los campos')
      return
    }

    const newMatch = {
      id: Date.now(),
      date: matchDate,
      venue: matchVenue,
      teamWhite: [...teamWhite],
      teamBlack: [...teamBlack],
      winner
    }

    setMatches([...matches, newMatch])
    setMatchDate('')
    setMatchVenue('LUKTO')
    setTeamWhite([])
    setTeamBlack([])
    setWinner('')
    setActiveTab('stats')
  }

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return
    
    const newPlayer = {
      id: Date.now(),
      name: newPlayerName.trim(),
      aliases: newPlayerAliases.split(',').map(a => a.trim()).filter(a => a)
    }
    
    setPlayers([...players, newPlayer])
    setNewPlayerName('')
    setNewPlayerAliases('')
    setShowPlayerModal(false)
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

  return (
    <div className="app-container">
      <header className="header">
        <h1>LUKTO STATS</h1>
        <p className="subtitle">Win Rate Tracker</p>
        
        {/* Admin button */}
        <div className="admin-toggle">
          {isAdmin ? (
            <button className="admin-btn active" onClick={handleLogout}>
              🔓 Modo Admin
            </button>
          ) : (
            <button className="admin-btn" onClick={() => setShowLoginModal(true)}>
              🔒 Entrar como Admin
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
                  <th>Victorias</th>
                  <th>Derrotas</th>
                  <th>Jugados</th>
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
          <h2 className="section-title">Registrar Nuevo Partido</h2>
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

            <button 
              className="submit-btn"
              onClick={handleAddMatch}
              disabled={!matchDate || teamWhite.length === 0 || teamBlack.length === 0 || !winner}
            >
              GUARDAR PARTIDO
            </button>
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
                  {player.aliases.length > 0 && (
                    <div className="aliases">
                      aka: {player.aliases.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div className="add-player-card" onClick={() => setShowPlayerModal(true)}>
              <span style={{ fontSize: '1.5rem' }}>➕</span>
              Agregar Jugador
            </div>
          </div>
        </section>
      )}

      {/* Login Modal */}
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
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                placeholder="Ingresa la contraseña"
                autoFocus
              />
              {loginError && <p className="error-text">{loginError}</p>}
            </div>
            <button className="submit-btn" onClick={handleLogin}>
              ENTRAR
            </button>
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
