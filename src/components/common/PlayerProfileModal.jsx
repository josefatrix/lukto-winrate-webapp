import { useState, useEffect, useRef } from 'react'
import { AvatarImage, AppIcon } from './index'
import { ProfileIcons } from './ProfileIcons'

function getPredictionBet(pred) {
  return pred?.lukCoinsBet ?? pred?.xpBet ?? 0
}

export function PlayerProfileModal({ 
  show, 
  playerId, 
  onClose, 
  players, 
  stats, 
  matches,
  ratings,
  predictions = {},
  userLinks = {},
  positionAnalytics,
  getPlayerPhoto,
  getPlayerName,
  calculateXP,
  getRank,
  // Renders the same content inline as a full tab instead of as an overlay.
  asPage = false,
}) {
  const isVisible = !!show && !!playerId

  // State for badge tooltip
  const [selectedBadge, setSelectedBadge] = useState(null)

  // State for share card
  const [showShareCard, setShowShareCard] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const shareCardRef = useRef(null)
  const profileCardRef = useRef(null)

  useEffect(() => {
    // As a tab the profile scrolls with the page — locking the body would
    // freeze the whole app.
    if (!show || asPage) return undefined
    const originalOverflow = document.body.style.overflow
    const originalPaddingRight = document.body.style.paddingRight
    const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

    document.body.style.overflow = 'hidden'
    if (scrollBarWidth > 0) {
      document.body.style.paddingRight = `${scrollBarWidth}px`
    }

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.paddingRight = originalPaddingRight
    }
  }, [show, asPage])

  useEffect(() => {
    if (!show) return
    if (profileCardRef.current) {
      profileCardRef.current.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [show, playerId])

  const getPoolTotals = matchId => {
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

  const getPoolWin = (pred, match) => {
    if (!match?.winner || match.winner === 'tie') return 0
    if (pred?.prediction !== match.winner) return 0
    const { totalWhite, totalBlack } = getPoolTotals(match.id)
    const bet = getPredictionBet(pred)
    const totalWinSide = match.winner === 'white' ? totalWhite : totalBlack
    const totalLoseSide = match.winner === 'white' ? totalBlack : totalWhite
    if (totalWinSide <= 0 || totalLoseSide <= 0) return 0
    return Math.round((bet / totalWinSide) * totalLoseSide)
  }

  if (!isVisible) return null

  const player = players?.find(p => p.id === playerId)
  if (!player) {
    return (
      <div className={asPage ? 'profile-page' : 'profile-overlay'} onClick={asPage ? undefined : onClose}>
        <div
          className={`profile-card ${asPage ? 'as-page' : ''}`}
          ref={profileCardRef}
          onClick={asPage ? undefined : e => e.stopPropagation()}
        >
          {!asPage && <button className="profile-close" onClick={onClose} aria-label="Cerrar perfil">×</button>}
          <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Jugador no encontrado</p>
          {!asPage && (
            <div className="profile-footer-actions">
              <button className="cancel-btn" onClick={onClose}>Cerrar</button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const sortedByPts = stats?.length > 0
    ? [...stats].sort((a, b) => (parseFloat(b.rankingScore) || 0) - (parseFloat(a.rankingScore) || 0))
    : []
  const rankingIndex = sortedByPts.findIndex(s => s.id === playerId)
  const rankingPos = rankingIndex >= 0 ? rankingIndex + 1 : null

  const playerStats = stats?.find(s => s.id === playerId) || { played: 0, wins: 0, losses: 0, ties: 0, mvps: 0, winRate: 0, rankingScore: '0.0' }
  const xp = calculateXP ? calculateXP(playerId) : 0
  const rank = getRank ? getRank(xp) : { name: 'Bronce', color: '#CD7F32', key: 'bronce' }
  const playerRatings = ratings?.[playerId] || []
  const linkedUserId = Object.entries(userLinks || {}).find(([, data]) => data?.playerId === playerId)?.[0]
  const linkedUserData = linkedUserId ? userLinks?.[linkedUserId] : null
  const cosmetics = linkedUserData?.cosmetics || null
  const lukCoins = typeof linkedUserData?.lukCoins === 'number' ? linkedUserData.lukCoins : null
  const playerPhoto = getPlayerPhoto ? getPlayerPhoto(playerId) : null
  const banner = cosmetics?.banner || null
  const nameStyle = cosmetics?.nameStyle || null
  const bannerTextMap = {
    junior: 'Banner Junior',
    monda: 'Soy la monda',
    hayjuego: 'Hay juegooo',
    amamar: 'A mamar',
    legend: 'Leyenda',
  }
  const bannerText = banner ? bannerTextMap[banner] : null

  // Determine primary position on the pitch
  const playerRoleMap = positionAnalytics?.byPlayer?.[playerId] || {}
  const topRoleEntry = Object.entries(playerRoleMap)
    .filter(([, d]) => (d?.played || 0) > 0)
    .sort((a, b) => b[1].played - a[1].played)[0]
  const primaryRole = topRoleEntry ? topRoleEntry[0] : (player.position || 'Polivalente')
  
  // Calculate all stats averages for comparison
  const ratingSamples = stats?.filter(p => p.avgRating) || []
  const ratingSampleCount = ratingSamples.length
  const avgStats = {
    winRate: stats?.length > 0 ? stats.reduce((s, p) => s + (p.winRate || 0), 0) / stats.length : 50,
    rating: ratingSampleCount > 0 ? ratingSamples.reduce((s, p) => s + parseFloat(p.avgRating || 5), 0) / ratingSampleCount : 5,
    mvps: stats?.length > 0 ? stats.reduce((s, p) => s + (p.mvps || 0), 0) / stats.length : 0
  }
  
  // Calculate streaks
  const playerMatches = matches?.filter(m => 
    m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
  ).sort((a, b) => new Date(b.date) - new Date(a.date)) || []
  
  let bestWinStreak = 0, worstLossStreak = 0, tempWinStreak = 0, tempLossStreak = 0
  let currentStreak = { type: 'none', count: 0 }
  let firstResult = true
  
  for (const m of playerMatches) {
    const inWhite = m.teamWhite?.includes(playerId)
    const decided = m.winner === 'white' || m.winner === 'black'
    if (!decided) continue
    const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
    
    if (won) {
      tempWinStreak++
      tempLossStreak = 0
      if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak
      // Track current streak (first matches in the sorted list are most recent)
      if (firstResult) { currentStreak = { type: 'win', count: 1 }; firstResult = false }
      else if (currentStreak.type === 'win') currentStreak.count++
    } else {
      tempLossStreak++
      tempWinStreak = 0
      if (tempLossStreak > worstLossStreak) worstLossStreak = tempLossStreak
      // Track current streak
      if (firstResult) { currentStreak = { type: 'loss', count: 1 }; firstResult = false }
      else if (currentStreak.type === 'loss') currentStreak.count++
    }
  }

  // Rating stats
  const bestRating = playerRatings.length > 0 ? Math.max(...playerRatings.map(r => r.score)) : 0
  const worstRating = playerRatings.length > 0 ? Math.min(...playerRatings.map(r => r.score)) : 0
  const avgRating = playerRatings.length > 0 
    ? (playerRatings.reduce((s, r) => s + r.score, 0) / playerRatings.length)
    : 0
  
  // Achievements/Badges with SVG icons and descriptions
  const badges = []
  
  // MVP badges (progression)
  if (playerStats.mvps >= 1) badges.push({ icon: 'star', name: 'MVP', color: '#fbbf24', desc: 'Ser el jugador más valorado en al menos 1 partido' })
  if (playerStats.mvps >= 3) badges.push({ icon: 'star', name: 'Triple MVP', color: '#f59e0b', desc: 'Acumular 3 títulos de MVP' })
  if (playerStats.mvps >= 5) badges.push({ icon: 'crown', name: 'Rey', color: '#f97316', desc: 'Acumular 5 o más títulos de MVP' })
  if (playerStats.mvps >= 10) badges.push({ icon: 'trophy', name: 'Leyenda', color: '#dc2626', desc: 'Alcanzar 10 MVPs totales - el máximo honor' })
  
  // Rating badges
  if (bestRating === 10) badges.push({ icon: 'check100', name: 'Perfecto', color: '#10b981', desc: 'Recibir una calificación perfecta de 10' })
  if (avgRating >= 8 && playerStats.played >= 3) badges.push({ icon: 'target', name: 'Consistente', color: '#3b82f6', desc: 'Mantener un rating promedio superior a 8.0' })
  if (avgRating >= 9 && playerStats.played >= 5) badges.push({ icon: 'diamond', name: 'Élite', color: '#06b6d4', desc: 'Calificación promedio de 9+ con 5 partidos jugados' })
  if (worstRating >= 7 && playerStats.played >= 3) badges.push({ icon: 'shield', name: 'Blindado', color: '#64748b', desc: 'Nunca recibir una calificación menor a 7' })
  
  // Win rate badges
  if (playerStats.winRate >= 50 && playerStats.played >= 3) badges.push({ icon: 'thumbsup', name: 'Ganador', color: '#22c55e', desc: 'Win rate del 50% o superior' })
  if (playerStats.winRate >= 70 && playerStats.played >= 3) badges.push({ icon: 'muscle', name: 'Dominante', color: '#ef4444', desc: 'Mantener un win rate superior al 70%' })
  if (playerStats.winRate >= 80 && playerStats.played >= 5) badges.push({ icon: 'fire', name: 'Intratable', color: '#f97316', desc: 'Win rate del 80%+ con 5 partidos' })
  if (playerStats.winRate === 100 && playerStats.played >= 3) badges.push({ icon: 'rocket', name: 'Invicto', color: '#a855f7', desc: '¡100% win rate sin derrotas!' })
  
  // Streak badges
  if (bestWinStreak >= 3) badges.push({ icon: 'flame', name: 'En Racha', color: '#f59e0b', desc: 'Racha de 3+ victorias consecutivas' })
  if (bestWinStreak >= 5) badges.push({ icon: 'bolt', name: 'Imparable', color: '#eab308', desc: 'Racha de 5+ victorias consecutivas' })
  if (bestWinStreak >= 7) badges.push({ icon: 'lightning', name: 'Demoledor', color: '#fbbf24', desc: 'Racha épica de 7+ victorias' })
  
  // Participation badges
  if (playerStats.played >= 1) badges.push({ icon: 'ball', name: 'Debutante', color: '#6b7280', desc: 'Jugar tu primer partido' })
  if (playerStats.played >= 5) badges.push({ icon: 'controller', name: 'Regular', color: '#8b5cf6', desc: 'Jugar 5 o más partidos' })
  if (playerStats.played >= 10) badges.push({ icon: 'medal', name: 'Veterano', color: '#7c3aed', desc: 'Jugar 10 o más partidos' })
  if (playerStats.played >= 20) badges.push({ icon: 'badge', name: 'Capitán', color: '#4f46e5', desc: 'Jugar 20 o más partidos' })
  if (playerStats.played >= 50) badges.push({ icon: 'castle', name: 'Pilar', color: '#2563eb', desc: 'Jugar 50+ partidos - pilar del equipo' })
  
  // XP badges
  if (xp >= 500) badges.push({ icon: 'gem', name: 'Ascendido', color: '#0ea5e9', desc: 'Alcanzar 500 puntos de XP' })
  if (xp >= 1000) badges.push({ icon: 'crystal', name: 'Maestro', color: '#06b6d4', desc: 'Alcanzar 1000 puntos de XP' })
  if (xp >= 2000) badges.push({ icon: 'infinity', name: 'Inmortal', color: '#14b8a6', desc: 'Alcanzar 2000 puntos de XP' })
  
  // Special badges
  if (playerStats.wins >= 10) badges.push({ icon: 'check', name: '10 Victorias', color: '#22c55e', desc: 'Acumular 10 victorias totales' })
  if (playerStats.wins >= 25) badges.push({ icon: 'checkDouble', name: '25 Victorias', color: '#16a34a', desc: 'Acumular 25 victorias - ¡Impresionante!' })

  // Position-based badges
  const roleStats = positionAnalytics?.byPlayer?.[playerId] || {}
  const roleNames = Object.keys(roleStats).filter(r => (roleStats[r]?.played || 0) > 0)
  if (roleNames.length >= 3) {
    badges.push({ icon: 'badge', name: 'Versátil', color: '#22d3ee', desc: 'Jugar 3 o más roles distintos' })
  }
  const roleWinRate = (entry) => {
    if (!entry || !entry.played) return 0
    return Math.round(((entry.wins + 0.5 * (entry.ties || 0)) / entry.played) * 100)
  }
  const roleAvgRating = (entry) => {
    if (!entry || !entry.ratingCount) return null
    return entry.ratingSum / entry.ratingCount
  }
  const portero = roleStats.Portero
  if (portero?.played >= 5) {
    badges.push({ icon: 'shield', name: 'Guardián', color: '#3b82f6', desc: 'Jugar 5+ partidos como Portero' })
  }
  const defensa = roleStats.Defensa
  if (defensa?.played >= 5 && roleWinRate(defensa) >= 70) {
    badges.push({ icon: 'shield', name: 'Muro', color: '#64748b', desc: '70%+ WR jugando en Defensa' })
  }
  const medio = roleStats.Medio
  if (medio?.played >= 5 && (roleAvgRating(medio) || 0) >= 8) {
    badges.push({ icon: 'target', name: 'Motor', color: '#0ea5e9', desc: 'Calificación 8+ jugando en Medio' })
  }
  const delantero = roleStats.Delantero
  if (delantero?.played >= 5 && (delantero.mvps || 0) >= 2) {
    badges.push({ icon: 'fire', name: 'Killer', color: '#f97316', desc: '2+ MVPs jugando de Delantero' })
  }
  
  // XP Progress calculation
  const RANK_THRESHOLDS = [0, 100, 250, 500, 850, 1300, 1900, 2600]
  const currentRankIndex = RANK_THRESHOLDS.findIndex((t, i) => xp < (RANK_THRESHOLDS[i + 1] || Infinity))
  const currentThreshold = RANK_THRESHOLDS[currentRankIndex] || 0
  const nextThreshold = RANK_THRESHOLDS[currentRankIndex + 1] || RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1]
  const xpInCurrentRank = xp - currentThreshold
  const xpNeededForNext = nextThreshold - currentThreshold
  const xpProgress = Math.min(100, (xpInCurrentRank / xpNeededForNext) * 100)

  // Share function - now shows a shareable card
  const shareProfile = () => {
    setShowShareCard(true)
  }

  // Generate and share image
  const generateShareImage = async () => {
    if (!shareCardRef.current) return
    setIsGeneratingImage(true)
    
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: null,
        scale: 2,
        useCORS: true,
        allowTaint: true
      })
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          setIsGeneratingImage(false)
          return
        }
        
        const file = new File([blob], `${player.name}-lukto-stats.png`, { type: 'image/png' })
        
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            // Only share the image file, no text to avoid duplicate preview
            await navigator.share({
              files: [file]
            })
          } catch (err) {
            if (err.name !== 'AbortError') {
              downloadImage(canvas)
            }
          }
        } else {
          downloadImage(canvas)
        }
        setIsGeneratingImage(false)
        setShowShareCard(false)
      }, 'image/png')
    } catch (error) {
      console.error('Error generating image:', error)
      setIsGeneratingImage(false)
    }
  }

  const downloadImage = (canvas) => {
    const link = document.createElement('a')
    link.download = `${player.name}-lukto-stats.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  return (
    <div className={asPage ? 'profile-page' : 'profile-overlay'} onClick={asPage ? undefined : onClose}>
      <div
        className={`profile-card profile-card-v2 ${asPage ? 'as-page' : ''}`}
        ref={profileCardRef}
        onClick={asPage ? undefined : e => e.stopPropagation()}
      >
        <div className="profile-actions">
          <button className="profile-share" onClick={shareProfile} title="Compartir">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
            </svg>
          </button>
          {!asPage && <button className="profile-close" onClick={onClose} aria-label="Cerrar perfil">×</button>}
        </div>

        {/* Premier League / Scouting Hero Header */}
        <div
          className={`profile-hero-v2 ${banner ? `banner-${banner}` : ''}`}
          style={{
            '--rank-color': rank.color,
            ...(playerPhoto ? { '--ph-photo': `url(${playerPhoto})` } : {}),
          }}
        >
          {playerPhoto && <div className="ph-backdrop-blur" aria-hidden="true" />}
          {bannerText && <div className="profile-banner-text">{bannerText}</div>}

          <div className={`ph-photo-wrap ${cosmetics?.avatarGlow ? 'glow' : ''}`}>
            <AvatarImage
              src={playerPhoto}
              name={player.name}
              imgClassName="ph-photo-img"
              fallbackClassName="ph-photo-fallback"
            />
            {rankingPos && (
              <span className={`ph-pos-badge ${rankingPos === 1 ? 'gold' : rankingPos === 2 ? 'silver' : rankingPos === 3 ? 'bronze' : ''}`}>
                #{rankingPos}
              </span>
            )}
          </div>

          <h2
            className={`ph-name ${cosmetics?.goldName ? 'gold' : ''} ${nameStyle ? `name-${nameStyle}` : ''}`}
            data-text={player.name}
          >
            {player.name}
          </h2>

          <div className="ph-meta-pills">
            {rankingPos && (
              <span className="ph-meta-pill pts">
                #{rankingPos} Ranking · <b>{playerStats.rankingScore || '0.0'} PTS</b>
              </span>
            )}
            <span className="ph-meta-pill role">
              {primaryRole}
            </span>
            {lukCoins !== null && (
              <span className="ph-meta-pill coins">
                {lukCoins} LC
              </span>
            )}
          </div>
          
          {/* Rank & XP Progress */}
          <div className="ph-rank-section">
            <div className="ph-rank" style={{ '--rank-color': rank.color }}>
              <span className="ph-rank-name">{rank.name}</span>
              <span className="ph-xp">{xp} XP</span>
            </div>
            <div className="ph-progress-bar">
              <div className="ph-progress-fill" style={{ width: `${xpProgress}%`, background: rank.color }}></div>
            </div>
            <div className="ph-progress-labels">
              <span>{currentThreshold} XP</span>
              <span>
                {nextThreshold > xp ? `Faltan ${nextThreshold - xp} XP` : 'Rango Máximo'}
              </span>
              <span>{nextThreshold} XP</span>
            </div>
          </div>
        </div>

        {/* Complete 8-KPI Scouting Grid */}
        <div className="profile-stats-grid">
          <div className="psg-item pts">
            <span className="psg-value">{playerStats.rankingScore || '0.0'}</span>
            <span className="psg-label">PTS Ranking</span>
          </div>
          <div className="psg-item rating">
            <span className="psg-value">{avgRating ? avgRating.toFixed(1) : '—'}</span>
            <span className="psg-label">★ Calif.</span>
          </div>
          <div className="psg-item mvp">
            <span className="psg-value">{playerStats.mvps || 0}</span>
            <span className="psg-label">MVPs</span>
          </div>
          <div className="psg-item wr">
            <span className="psg-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : parseFloat(playerStats.winRate || 0).toFixed(0)}%</span>
            <span className="psg-label">Efectividad</span>
          </div>
          <div className="psg-item">
            <span className="psg-value">{playerStats.played || 0}</span>
            <span className="psg-label">Partidos (PJ)</span>
          </div>
          <div className="psg-item win">
            <span className="psg-value">{playerStats.wins || 0}</span>
            <span className="psg-label">Victorias (V)</span>
          </div>
          <div className="psg-item tie">
            <span className="psg-value">{playerStats.ties || 0}</span>
            <span className="psg-label">Empates (E)</span>
          </div>
          <div className="psg-item loss">
            <span className="psg-value">{playerStats.losses || 0}</span>
            <span className="psg-label">Derrotas (D)</span>
          </div>
        </div>

        {/* Recent 5 Matches Form Strip */}
        {(() => {
          const decidedMatches = playerMatches
            .filter(m => m.winner === 'white' || m.winner === 'black' || m.winner === 'tie')
            .slice(0, 5)
            .reverse()
          if (decidedMatches.length === 0) return null

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Forma Reciente (Últimos {decidedMatches.length})</h4>
              <div className="profile-recent-form">
                {decidedMatches.map((m, idx) => {
                  const inWhite = m.teamWhite?.includes(playerId)
                  const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
                  const res = m.winner === 'tie' ? 'e' : won ? 'v' : 'd'
                  const mRatings = (ratings?.[playerId] || []).filter(r => r.matchId === m.id)
                  const mAvg = mRatings.length > 0
                    ? (mRatings.reduce((s, r) => s + r.score, 0) / mRatings.length).toFixed(1)
                    : null
                  const dateShort = m.date
                    ? new Date(m.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
                    : ''
                  const isLatest = idx === decidedMatches.length - 1
                  return (
                    <div key={m.id || idx} className={`prf-card ${res} ${isLatest ? 'latest' : ''}`}>
                      <span className={`pl-form-dot ${res} ${isLatest ? 'latest' : ''}`}>
                        {res === 'v' ? 'V' : res === 'e' ? 'E' : 'D'}
                      </span>
                      <span className="prf-rating">{mAvg ? `${mAvg} ★` : '—'}</span>
                      <span className="prf-date">{dateShort}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {(() => {
          const roleStats = positionAnalytics.byPlayer?.[playerId] || {}
          const roleEntries = Object.entries(roleStats)
            .map(([role, data]) => ({
              role,
              ...data,
              winRate: data.played > 0 ? Math.round(((data.wins + 0.5 * data.ties) / data.played) * 100) : 0,
              avgRating: data.ratingCount > 0 ? (data.ratingSum / data.ratingCount).toFixed(1) : null,
            }))
            .sort((a, b) => b.played - a.played)

          if (roleEntries.length === 0) return null

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Roles y Posiciones</h4>
              <div className="roles-summary">
                {roleEntries.map(entry => {
                  const pct = Math.round((entry.played / playerStats.played) * 100)
                  return (
                    <div key={entry.role} className="role-chip">
                      <span className="role-name">{entry.role}</span>
                      <span className="role-pct">{pct}%</span>
                      <span className="role-meta">{entry.played} partidos</span>
                    </div>
                  )
                })}
              </div>
              <div className="roles-table">
                {roleEntries.map(entry => (
                  <div key={entry.role} className="role-row">
                    <span className="role-label">{entry.role}</span>
                    <span className="role-stats">{entry.wins}V - {entry.ties}E - {entry.losses}D</span>
                    <span className="role-stats">{entry.winRate}% WR</span>
                    <span className="role-stats"><AppIcon name="star" size={12} /> {entry.avgRating || '-'}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}


        {/* Badges */}
        {badges.length > 0 && (
          <div className="profile-section-v2">
            <h4 className="ps-title">Logros</h4>
            <div className="badges-row">
              {badges.map((badge, i) => (
                <div 
                  key={i} 
                  className={`badge-v2 ${selectedBadge === i ? 'selected' : ''}`} 
                  style={{ '--badge-color': badge.color }}
                  onClick={() => setSelectedBadge(selectedBadge === i ? null : i)}
                >
                  <span className="badge-v2-icon">{ProfileIcons[badge.icon]}</span>
                  <span className="badge-v2-name">{badge.name}</span>
                </div>
              ))}
            </div>
            {/* Badge Tooltip */}
            {selectedBadge !== null && badges[selectedBadge] && (
              <div className="badge-tooltip" onClick={() => setSelectedBadge(null)}>
                <div className="bt-icon" style={{ color: badges[selectedBadge].color }}>
                  {ProfileIcons[badges[selectedBadge].icon]}
                </div>
                <div className="bt-content">
                  <span className="bt-name">{badges[selectedBadge].name}</span>
                  <span className="bt-desc">{badges[selectedBadge].desc}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison */}
        <div className="profile-section-v2">
          <h4 className="ps-title">vs Promedio</h4>
          <div className="comparison-row-v2">
            <div className="comp-v2">
              <span className="comp-v2-label">Win Rate</span>
              <span className="comp-v2-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : 0}%</span>
              <span className={`comp-v2-diff ${(playerStats.winRate || 0) >= avgStats.winRate ? 'pos' : 'neg'}`}>
                {(playerStats.winRate || 0) >= avgStats.winRate ? '+' : ''}{((playerStats.winRate || 0) - avgStats.winRate).toFixed(0)}%
              </span>
            </div>
            <div className="comp-v2">
              <span className="comp-v2-label">Calificación</span>
              <span className="comp-v2-value">{avgRating ? avgRating.toFixed(1) : '-'}</span>
              <span className={`comp-v2-diff ${avgRating >= avgStats.rating ? 'pos' : 'neg'}`}>
                {avgRating >= avgStats.rating ? '+' : ''}{(avgRating - avgStats.rating).toFixed(1)}
              </span>
            </div>
            <div className="comp-v2">
              <span className="comp-v2-label">MVPs</span>
              <span className="comp-v2-value">{playerStats.mvps || 0}</span>
              <span className={`comp-v2-diff ${(playerStats.mvps || 0) >= avgStats.mvps ? 'pos' : 'neg'}`}>
                {(playerStats.mvps || 0) >= avgStats.mvps ? '+' : ''}{((playerStats.mvps || 0) - avgStats.mvps).toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Current Streak & Records */}
        <div className="profile-section-v2">
          <h4 className="ps-title">Rachas y Récords</h4>
          
          {/* Current Streak Banner */}
          {currentStreak.count > 0 && (
            <div className={`current-streak-banner ${currentStreak.type}`}>
              <span className="csb-icon">
                {currentStreak.type === 'win' 
                  ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="#22c55e"/></svg>
                  : <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ef4444" strokeWidth="2"/><path d="M8 8l8 8M16 8l-8 8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"/></svg>
                }
              </span>
              <div className="csb-content">
                <span className="csb-count">{currentStreak.count} {currentStreak.type === 'win' ? 'victorias' : 'derrotas'}</span>
                <span className="csb-label">Racha actual</span>
              </div>
              {currentStreak.count >= 3 && currentStreak.type === 'win' && (
                <span className="csb-badge"><AppIcon name="spark" size={14} /></span>
              )}
            </div>
          )}
          
          <div className="records-row-v2">
            <div className="record-v2">
              <span className="record-v2-icon win">{ProfileIcons.medal}</span>
              <span className="record-v2-value">{bestWinStreak}</span>
              <span className="record-v2-label">Mejor racha</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon loss">{ProfileIcons.heartBroken}</span>
              <span className="record-v2-value">{worstLossStreak}</span>
              <span className="record-v2-label">Peor racha</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon win">{ProfileIcons.arrowUp}</span>
              <span className="record-v2-value">{bestRating || '-'}</span>
              <span className="record-v2-label">Calificación máx.</span>
            </div>
            <div className="record-v2">
              <span className="record-v2-icon loss">{ProfileIcons.arrowDown}</span>
              <span className="record-v2-value">{worstRating || '-'}</span>
              <span className="record-v2-label">Calificación mín.</span>
            </div>
          </div>
        </div>

        {/* Performance Graph */}
        {(() => {
          const playerMatches = matches
            .filter(m => m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId))
            .sort((a, b) => new Date(a.date) - new Date(b.date))
          
          const graphData = playerMatches.map(m => {
            const matchRatings = (ratings[playerId] || []).filter(r => r.matchId === m.id)
            const avgScore = matchRatings.length > 0 
              ? matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length 
              : null
            const inWhite = m.teamWhite?.includes(playerId)
            const won = (inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')
            const result = m.winner === 'tie' ? 'tie' : won ? 'win' : 'loss'
            return { date: m.date, rating: avgScore, result }
          }).filter(d => d.rating !== null)

          if (graphData.length < 2) return null

          const maxRating = 10
          const minRating = 1
          const height = 120
          const width = 280
          const padding = 20

          const points = graphData.map((d, i) => {
            const x = padding + (i / (graphData.length - 1)) * (width - padding * 2)
            const y = height - padding - ((d.rating - minRating) / (maxRating - minRating)) * (height - padding * 2)
            return { x, y, ...d }
          })

          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
          const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Rendimiento</h4>
              <div className="performance-graph">
                <svg viewBox={`0 0 ${width} ${height}`} className="pg-svg">
                  {/* Grid lines */}
                  {[1, 5, 10].map(val => {
                    const y = height - padding - ((val - minRating) / (maxRating - minRating)) * (height - padding * 2)
                    return (
                      <g key={val}>
                        <line x1={padding} y1={y} x2={width - padding} y2={y} className="pg-grid" />
                        <text x={padding - 5} y={y + 4} className="pg-label">{val}</text>
                      </g>
                    )
                  })}
                  {/* Area fill */}
                  <path d={areaD} className="pg-area" />
                  {/* Line */}
                  <path d={pathD} className="pg-line" />
                  {/* Points */}
                  {points.map((p, i) => (
                    <circle 
                      key={i} 
                      cx={p.x} 
                      cy={p.y} 
                      r="4" 
                      className={`pg-point ${p.result}`}
                    />
                  ))}
                </svg>
                <div className="pg-legend">
                  <span className="pg-legend-item"><span className="dot win"></span> Victoria</span>
                  <span className="pg-legend-item"><span className="dot loss"></span> Derrota</span>
                  <span className="pg-legend-item"><span className="dot tie"></span> Empate</span>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Rivals & Allies */}
        {(() => {
          const rivalStats = {}
          matches.forEach(m => {
            const inWhite = m.teamWhite?.includes(playerId)
            const inBlack = m.teamBlack?.includes(playerId)
            if (!inWhite && !inBlack) return
            
            const myTeam = inWhite ? m.teamWhite : m.teamBlack
            const enemyTeam = inWhite ? m.teamBlack : m.teamWhite
            const won = (inWhite && m.winner === 'white') || (inBlack && m.winner === 'black')
            
            // Track teammates
            myTeam?.forEach(tid => {
              if (tid === playerId) return
              if (!rivalStats[tid]) rivalStats[tid] = { together: 0, togetherWins: 0, against: 0, againstWins: 0 }
              rivalStats[tid].together++
              if (won) rivalStats[tid].togetherWins++
            })
            
            // Track enemies
            enemyTeam?.forEach(eid => {
              if (!rivalStats[eid]) rivalStats[eid] = { together: 0, togetherWins: 0, against: 0, againstWins: 0 }
              rivalStats[eid].against++
              if (won) rivalStats[eid].againstWins++
            })
          })

          const rankings = Object.entries(rivalStats)
            .filter(([_, s]) => s.together + s.against >= 2)
            .map(([id, s]) => ({
              id,
              name: getPlayerName(id),
              photo: getPlayerPhoto(id),
              togetherWR: s.together > 0 ? Math.round((s.togetherWins / s.together) * 100) : null,
              togetherGames: s.together,
              againstWR: s.against > 0 ? Math.round((s.againstWins / s.against) * 100) : null,
              againstGames: s.against
            }))

          const bestAlly = rankings.filter(r => r.togetherGames >= 2).sort((a, b) => (b.togetherWR || 0) - (a.togetherWR || 0))[0]
          const worstAlly = rankings.filter(r => r.togetherGames >= 2).sort((a, b) => (a.togetherWR || 0) - (b.togetherWR || 0))[0]
          const bestRival = rankings.filter(r => r.againstGames >= 2).sort((a, b) => (b.againstWR || 0) - (a.againstWR || 0))[0]
          const worstRival = rankings.filter(r => r.againstGames >= 2).sort((a, b) => (a.againstWR || 0) - (b.againstWR || 0))[0]

          if (!bestAlly && !worstRival) return null

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Rivales y Aliados</h4>
              <div className="rivals-grid">
                {bestAlly && (
                  <div className="rival-card ally">
                    <span className="rc-label">Mejor Aliado</span>
                    <div className="rc-player">
                      <AvatarImage src={bestAlly.photo} name={bestAlly.name} />
                    </div>
                    <span className="rc-name">{bestAlly.name}</span>
                    <span className="rc-stat good">{bestAlly.togetherWR}% WR juntos</span>
                    <span className="rc-games">{bestAlly.togetherGames} partidos</span>
                  </div>
                )}
                {worstAlly && worstAlly.id !== bestAlly?.id && (
                  <div className="rival-card ally-bad">
                    <span className="rc-label">Peor Aliado</span>
                    <div className="rc-player">
                      <AvatarImage src={worstAlly.photo} name={worstAlly.name} />
                    </div>
                    <span className="rc-name">{worstAlly.name}</span>
                    <span className="rc-stat bad">{worstAlly.togetherWR}% WR juntos</span>
                    <span className="rc-games">{worstAlly.togetherGames} partidos</span>
                  </div>
                )}
                {bestRival && (
                  <div className="rival-card rival">
                    <span className="rc-label">Víctima Favorita</span>
                    <div className="rc-player">
                      <AvatarImage src={bestRival.photo} name={bestRival.name} />
                    </div>
                    <span className="rc-name">{bestRival.name}</span>
                    <span className="rc-stat good">{bestRival.againstWR}% WR vs</span>
                    <span className="rc-games">{bestRival.againstGames} enfrentamientos</span>
                  </div>
                )}
                {worstRival && worstRival.id !== bestRival?.id && (
                  <div className="rival-card nemesis">
                    <span className="rc-label">Tu Némesis</span>
                    <div className="rc-player">
                      <AvatarImage src={worstRival.photo} name={worstRival.name} />
                    </div>
                    <span className="rc-name">{worstRival.name}</span>
                    <span className="rc-stat bad">{worstRival.againstWR}% WR vs</span>
                    <span className="rc-games">{worstRival.againstGames} enfrentamientos</span>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Predictions History */}
        {(() => {
          // Find user ID for this player
          const userId = userLinks 
            ? Object.entries(userLinks).find(([, linkData]) => linkData?.playerId === playerId)?.[0]
            : null
          
          if (!userId) return null
          
          // Get all predictions for this user
          const userPredictions = Object.entries(predictions)
            .map(([matchId, matchPreds]) => {
              const pred = matchPreds?.[userId]
              if (!pred) return null
              const match = matches.find(m => m.id === (pred.matchId || matchId))
              return { ...pred, matchId: pred.matchId || matchId, match }
            })
            .filter(Boolean)
            .filter(p => p.match)
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
          
          if (userPredictions.length === 0) return null
          
          // Calculate stats
          const resolved = userPredictions.filter(p => p.match?.winner && p.match.winner !== 'tie')
          const voided = userPredictions.filter(p => p.match?.winner === 'tie')
          const correct = resolved.filter(p => p.prediction === p.match.winner)
          const accuracy = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0
          const totalCoinsWon = correct.reduce((sum, p) => sum + getPoolWin(p, p.match), 0)
          const totalCoinsLost = resolved.filter(p => p.prediction !== p.match.winner)
            .reduce((sum, p) => sum + getPredictionBet(p), 0)
          
          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Historial de Predicciones</h4>
              
              {/* Summary Stats */}
              <div className="predictions-summary">
                <div className="pred-stat">
                  <span className="pred-stat-value">{resolved.length}</span>
                  <span className="pred-stat-label">Predicciones</span>
                </div>
                {voided.length > 0 && (
                  <div className="pred-stat">
                    <span className="pred-stat-value">{voided.length}</span>
                    <span className="pred-stat-label">Empates</span>
                  </div>
                )}
                <div className="pred-stat">
                  <span className="pred-stat-value good">{correct.length}</span>
                  <span className="pred-stat-label">Acertadas</span>
                </div>
                <div className="pred-stat">
                  <span className={`pred-stat-value ${accuracy >= 50 ? 'good' : 'bad'}`}>{accuracy}%</span>
                  <span className="pred-stat-label">Precisión</span>
                </div>
                <div className="pred-stat">
                  <span className={`pred-stat-value ${totalCoinsWon - totalCoinsLost >= 0 ? 'good' : 'bad'}`}>
                    {totalCoinsWon - totalCoinsLost >= 0 ? '+' : ''}{totalCoinsWon - totalCoinsLost}
                  </span>
                  <span className="pred-stat-label">LukCoins Netos</span>
                </div>
              </div>
              
              {/* Predictions List */}
              <div className="predictions-list">
                {userPredictions.slice(0, 5).map((pred, idx) => {
                  const isVoid = pred.match?.winner === 'tie'
                  const isResolved = !!pred.match?.winner && !isVoid
                  const isCorrect = isResolved && pred.prediction === pred.match.winner
                  const predictedTeam = pred.prediction === 'white' ? 'Blanco' : 'Negro'
                  const bet = getPredictionBet(pred)
                  const win = getPoolWin(pred, pred.match)
                  
                  return (
                    <div key={idx} className={`prediction-item ${isResolved ? (isCorrect ? 'correct' : 'wrong') : isVoid ? 'void' : 'pending'}`}>
                      <div className="pred-match-info">
                        <span className="pred-date">
                          {new Date(pred.match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="pred-teams">
                          {pred.match.teamWhite?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')} vs {pred.match.teamBlack?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                        </span>
                      </div>
                      <div className="pred-result">
                        <span className="pred-choice">Eq. {predictedTeam}</span>
                        <span className="pred-xp">
                          {isVoid
                            ? '0'
                            : isResolved 
                              ? (isCorrect ? `+${win}` : `-${bet}`)
                              : `${bet}`
                          } LC
                        </span>
                        <span className="pred-status">
                          {isVoid
                            ? <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#94a3b8"/><path d="M4 8h8" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                            : isResolved 
                              ? (isCorrect 
                                ? <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#22c55e"/><path d="M5 8l2 2 4-4" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                : <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#ef4444"/><path d="M5.5 5.5l5 5m0-5l-5 5" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                              )
                              : <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#f59e0b"/><circle cx="8" cy="8" r="2" fill="white"/></svg>
                          }
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {userPredictions.length > 5 && (
                <div className="predictions-more">
                  +{userPredictions.length - 5} predicciones más
                </div>
              )}
            </div>
          )
        })()}

        {/* Period Summary (Week/Month) */}
        {(() => {
          const now = new Date()
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          
          // Weekly stats
          const weekMatches = matches.filter(m => {
            const played = m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
            return played && new Date(m.date) >= weekAgo
          })
          
          // Monthly stats
          const monthMatches = matches.filter(m => {
            const played = m.teamWhite?.includes(playerId) || m.teamBlack?.includes(playerId)
            const mDate = new Date(m.date)
            return played && mDate >= monthStart
          })
          
          const calcPeriodStats = (periodMatches) => {
            let wins = 0, losses = 0, ties = 0, mvps = 0, totalRating = 0, ratingCount = 0
            
            periodMatches.forEach(m => {
              const inWhite = m.teamWhite?.includes(playerId)
              const decided = m.winner === 'white' || m.winner === 'black'
              if (decided) {
                if ((inWhite && m.winner === 'white') || (!inWhite && m.winner === 'black')) wins++
                else losses++
              } else if (m.winner === 'tie') {
                ties++
              }
              
              // Check MVP
              const allPlayers = [...(m.teamWhite || []), ...(m.teamBlack || [])]
              let mvpId = null, mvpRating = -1
              allPlayers.forEach(pid => {
                const pRatings = (ratings[pid] || []).filter(r => r.matchId === m.id)
                if (pRatings.length > 0) {
                  const avg = pRatings.reduce((s, r) => s + r.score, 0) / pRatings.length
                  if (avg > mvpRating) { mvpRating = avg; mvpId = pid }
                }
              })
              if (mvpId === playerId) mvps++
              
              // Rating
              const myRatings = (ratings[playerId] || []).filter(r => r.matchId === m.id)
              if (myRatings.length > 0) {
                totalRating += myRatings.reduce((s, r) => s + r.score, 0) / myRatings.length
                ratingCount++
              }
            })
            
            const played = periodMatches.length
            const winRate = played > 0 ? Math.round(((wins + 0.5 * ties) / played) * 100) : 0
            const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : null
            
            return { played, wins, losses, ties, mvps, winRate, avgRating }
          }
          
          const weekStats = calcPeriodStats(weekMatches)
          const monthStats = calcPeriodStats(monthMatches)
          
          if (weekStats.played === 0 && monthStats.played === 0) return null
          
          const periodNames = {
            week: 'Esta Semana',
            month: new Date().toLocaleDateString('es-ES', { month: 'long' })
          }
          
          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Resumen del Período</h4>
              <div className="period-summary-tabs">
                {weekStats.played > 0 && (
                  <div className="period-card">
                    <span className="period-label">{periodNames.week}</span>
                    <div className="period-stats">
                      <span className="period-main">{weekStats.wins}V - {weekStats.ties || 0}E - {weekStats.losses}D</span>
                      <span className={`period-wr ${weekStats.winRate >= 50 ? 'good' : 'bad'}`}>{weekStats.winRate}%</span>
                    </div>
                    <div className="period-details">
                      {weekStats.avgRating && <span><AppIcon name="star" size={12} /> {weekStats.avgRating}</span>}
                      {weekStats.mvps > 0 && <span><AppIcon name="trophy" size={12} /> {weekStats.mvps} MVP</span>}
                      <span><AppIcon name="note" size={12} /> {weekStats.played} partidos</span>
                    </div>
                  </div>
                )}
                {monthStats.played > 0 && (
                  <div className="period-card">
                    <span className="period-label">{periodNames.month}</span>
                    <div className="period-stats">
                      <span className="period-main">{monthStats.wins}V - {monthStats.ties || 0}E - {monthStats.losses}D</span>
                      <span className={`period-wr ${monthStats.winRate >= 50 ? 'good' : 'bad'}`}>{monthStats.winRate}%</span>
                    </div>
                    <div className="period-details">
                      {monthStats.avgRating && <span><AppIcon name="star" size={12} /> {monthStats.avgRating}</span>}
                      {monthStats.mvps > 0 && <span><AppIcon name="trophy" size={12} /> {monthStats.mvps} MVP</span>}
                      <span><AppIcon name="note" size={12} /> {monthStats.played} partidos</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })()}

        {/* Earnings History */}
        {playerMatches.length > 0 && (() => {
          const COIN_REWARDS = { played: 5, win: 8, mvp: 12 }

          const linkedUserId2 = userLinks
            ? Object.entries(userLinks).find(([, d]) => d?.playerId === playerId)?.[0]
            : null

          const matchXpBreakdown = (match) => {
            const br = { participation: 10, win: 0, rating: 0, mvp: 0, ratingAvg: null, isMvp: false, won: false }
            if (!match?.id) return { ...br, total: 10 }
            const inW = match.teamWhite?.includes(playerId)
            const won = match.winner
              ? (inW && match.winner === 'white') || (!inW && match.winner === 'black')
              : false
            br.won = won
            br.win = won ? 25 : 0

            const pRatings = (ratings?.[playerId] || []).filter(r => r.matchId === match.id)
            if (pRatings.length > 0) {
              const avg = pRatings.reduce((s, r) => s + r.score, 0) / pRatings.length
              br.ratingAvg = avg
              br.rating = Math.round(avg * 5)
            }

            const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
            let mvpId = null, mvpBest = -1
            allPlayers.forEach(pid => {
              const pr = (ratings?.[pid] || []).filter(r => r.matchId === match.id)
              if (pr.length > 0) {
                const avg = pr.reduce((s, r) => s + r.score, 0) / pr.length
                if (avg > mvpBest) { mvpBest = avg; mvpId = pid }
              }
            })
            br.isMvp = mvpId === playerId
            br.mvp = br.isMvp ? 50 : 0
            br.total = br.participation + br.win + br.rating + br.mvp
            return br
          }

          const history = playerMatches.map(match => {
            const inWhite = match.teamWhite?.includes(playerId)
            const decided = match.winner === 'white' || match.winner === 'black'
            const tied = match.winner === 'tie'
            const won = decided && ((inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black'))
            const result = !match.winner ? 'pending' : tied ? 'tie' : won ? 'win' : 'loss'

            const xp = matchXpBreakdown(match)

            let matchLC = COIN_REWARDS.played
            if (won) matchLC += COIN_REWARDS.win
            if (xp.isMvp) matchLC += COIN_REWARDS.mvp

            let predInfo = null
            if (linkedUserId2) {
              const pred = predictions?.[match.id]?.[linkedUserId2]
              if (pred) {
                const bet = getPredictionBet(pred)
                let lcDelta = 0, predStatus = 'pending'
                if (tied) {
                  predStatus = 'void'
                } else if (match.winner) {
                  if (pred.prediction === match.winner) {
                    const poolWin = getPoolWin(pred, match)
                    lcDelta = poolWin
                    predStatus = 'correct'
                  } else {
                    lcDelta = -bet
                    predStatus = 'wrong'
                  }
                }
                predInfo = { bet, lcDelta, predStatus, prediction: pred.prediction }
              }
            }

            return { match, result, xp, matchLC, predInfo }
          })

          const resolvedHistory = history.filter(h => h.result !== 'pending')
          const totalHistXP = resolvedHistory.reduce((s, h) => s + h.xp.total, 0)
          const totalHistLC = resolvedHistory.reduce((s, h) => s + h.matchLC, 0)

          return (
            <div className="profile-section-v2">
              <h4 className="ps-title">Ganancias por Partido</h4>

              {/* How to earn card */}
              <div className="earn-rules-card">
                <div className="erc-col">
                  <span className="erc-header">XP</span>
                  <span className="erc-row"><span className="erc-val">+10</span> Participar</span>
                  <span className="erc-row"><span className="erc-val">+25</span> Victoria</span>
                  <span className="erc-row"><span className="erc-val">+50</span> MVP</span>
                  <span className="erc-row"><span className="erc-val">+N</span> Calificación × 5</span>
                </div>
                <div className="erc-divider" />
                <div className="erc-col">
                  <span className="erc-header">LukCoins</span>
                  <span className="erc-row"><span className="erc-val lc">+5</span> Participar</span>
                  <span className="erc-row"><span className="erc-val lc">+8</span> Victoria</span>
                  <span className="erc-row"><span className="erc-val lc">+12</span> MVP</span>
                  <span className="erc-row"><span className="erc-val lc">+4</span> Calificar</span>
                </div>
              </div>

              {/* Totals */}
              <div className="earn-totals-row">
                <div className="etr-item">
                  <span className="etr-num">{totalHistXP}</span>
                  <span className="etr-unit">XP</span>
                  <span className="etr-label">en partidos</span>
                </div>
                <div className="etr-item lc">
                  <span className="etr-num">{totalHistLC}</span>
                  <span className="etr-unit">LC</span>
                  <span className="etr-label">en partidos</span>
                </div>
              </div>

              {/* Per-match list */}
              <div className="earn-history-list">
                {history.map(({ match, result, xp, matchLC, predInfo }, idx) => (
                  <div key={idx} className={`ehl-row ${result}`}>
                    <div className="ehl-left">
                      <span className={`ehl-dot ${result}`} />
                      <div className="ehl-info">
                        <span className="ehl-date">
                          {new Date(match.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                        <div className="ehl-tags">
                          {xp.isMvp && <span className="ehl-tag gold">★ MVP</span>}
                          {xp.ratingAvg != null && <span className="ehl-tag neutral">⭐ {xp.ratingAvg.toFixed(1)}</span>}
                          {predInfo && predInfo.predStatus === 'correct' && <span className="ehl-tag green">Pred ✓</span>}
                          {predInfo && predInfo.predStatus === 'wrong' && <span className="ehl-tag red">Pred ✗</span>}
                          {predInfo && predInfo.predStatus === 'void' && <span className="ehl-tag gray">Pred ~</span>}
                        </div>
                      </div>
                    </div>
                    <div className="ehl-right">
                      {result !== 'pending' ? (
                        <>
                          <span className="ehl-xp">+{xp.total} XP</span>
                          <span className="ehl-lc">+{matchLC} LC</span>
                          {predInfo && predInfo.predStatus !== 'pending' && predInfo.predStatus !== 'void' && (
                            <span className={`ehl-pred ${predInfo.predStatus}`}>
                              {predInfo.lcDelta >= 0 ? '+' : ''}{predInfo.lcDelta} LC
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="ehl-pending">Pendiente</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {!asPage && (
          <div className="profile-footer-actions">
            <button className="cancel-btn" onClick={onClose}>Cerrar perfil</button>
          </div>
        )}

        {/* Share Card Modal */}
        {showShareCard && (
          <div className="share-card-overlay" onClick={() => setShowShareCard(false)}>
            <div className="share-card-container" onClick={e => e.stopPropagation()}>
              {/* The actual shareable card */}
              <div ref={shareCardRef} className="share-card">
                <div className="sc-header">
                  <img src="/lukto-logo.png" alt="LUKTO" className="sc-logo" />
                  <span className="sc-brand">LUKTO</span>
                </div>
                
                <div className="sc-player">
                  <div className="sc-avatar" style={{ borderColor: rank.color }}>
                    <AvatarImage
                      src={playerPhoto}
                      name={player.name}
                      imgClassName="sc-photo-img"
                      fallbackClassName="sc-photo-fallback"
                    />
                  </div>
                  <h2 className="sc-name">{player.name}</h2>
                  <div className="sc-rank" style={{ color: rank.color }}>
                    {rankingPos ? `#${rankingPos} · ` : ''}{rank.name} · {xp} XP
                  </div>
                </div>

                <div className="sc-stats">
                  <div className="sc-stat">
                    <span className="sc-stat-value">{playerStats.rankingScore || '0.0'}</span>
                    <span className="sc-stat-label">PTS</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{typeof playerStats.winRate === 'number' ? playerStats.winRate.toFixed(0) : 0}%</span>
                    <span className="sc-stat-label">Win Rate</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{avgRating ? avgRating.toFixed(1) : '-'}</span>
                    <span className="sc-stat-label">Calificación</span>
                  </div>
                  <div className="sc-stat">
                    <span className="sc-stat-value">{playerStats.mvps || 0}</span>
                    <span className="sc-stat-label">MVPs</span>
                  </div>
                </div>

                <div className="sc-record">
                  <span className="sc-wins">{playerStats.wins || 0}V</span>
                  <span className="sc-sep">-</span>
                  <span className="sc-ties">{playerStats.ties || 0}E</span>
                  <span className="sc-sep">-</span>
                  <span className="sc-losses">{playerStats.losses || 0}D</span>
                </div>

                {badges.length > 0 && (
                  <div className="sc-badges">
                    {badges.slice(0, 4).map((badge, i) => (
                      <span key={i} className="sc-badge" style={{ color: badge.color }}>
                        {ProfileIcons[badge.icon]}
                      </span>
                    ))}
                  </div>
                )}

                <div className="sc-footer">
                  <span>LUKTO STATS</span>
                </div>
              </div>

              {/* Actions */}
              <div className="share-card-actions">
                <button 
                  className="sc-btn primary" 
                  onClick={generateShareImage}
                  disabled={isGeneratingImage}
                >
                  {isGeneratingImage ? 'Generando...' : 'Compartir Imagen'}
                </button>
                <button className="sc-btn secondary" onClick={() => setShowShareCard(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
