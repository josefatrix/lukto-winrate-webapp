/**
 * Pending Ratings & Predictions Notification Component
 * Shows banners for matches that need rating or prediction
 */
import { useState, useEffect, useMemo } from 'react'
import { useApp } from '../../contexts'

export const PendingRatingsNotification = ({ 
  onOpenRatingModal,
  onOpenPrediction,
  showBanner = true,
  className = '' 
}) => {
  const { 
    user, 
    userPlayer, 
    matches, 
    ratings,
    predictions,
    getPlayerName 
  } = useApp()
  
  const [dismissedRatings, setDismissedRatings] = useState(false)
  const [dismissedPredictions, setDismissedPredictions] = useState(false)
  const [expandedMatch, setExpandedMatch] = useState(null)

  // Calculate pending ratings
  const pendingMatches = useMemo(() => {
    if (!user || !userPlayer || !matches.length) return []
    
    return matches.filter(match => {
      // Check if user played in this match
      const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      if (!allPlayers.includes(userPlayer)) return false
      
      // Check if ratings are open for this match
      if (match.ratingsOpen === false) return false
      
      // Match must have a winner to rate
      if (!match.winner) return false
      
      // Check if user has already rated this match
      const hasRated = Object.values(ratings).some(playerRatings =>
        playerRatings.some(
          r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === match.id
        )
      )
      
      return !hasRated
    }).sort((a, b) => new Date(b.date) - new Date(a.date)) // Most recent first
  }, [user, userPlayer, matches, ratings])

  // Calculate pending predictions (matches without winner that user hasn't predicted)
  const pendingPredictions = useMemo(() => {
    if (!user || !matches.length) return []
    
    return matches.filter(match => {
      // Match must NOT have a winner yet
      if (match.winner) return false
      
      // Must have teams defined
      if (!match.teamWhite?.length || !match.teamBlack?.length) return false
      
      // Check if user already predicted
      const hasPredicted = predictions[match.id]?.[user.uid]
      
      return !hasPredicted
    }).sort((a, b) => new Date(a.date) - new Date(b.date)) // Soonest first
  }, [user, matches, predictions])

  // Reset dismissed when pending items change
  useEffect(() => {
    if (pendingMatches.length > 0) {
      setDismissedRatings(false)
    }
  }, [pendingMatches.length])

  useEffect(() => {
    if (pendingPredictions.length > 0) {
      setDismissedPredictions(false)
    }
  }, [pendingPredictions.length])

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T12:00:00')
    const now = new Date()
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Ayer'
    if (diffDays === -1) return 'Mañana'
    if (diffDays < 0) return `En ${Math.abs(diffDays)} días`
    if (diffDays < 7) return `Hace ${diffDays} días`
    
    return date.toLocaleDateString('es-ES', { 
      day: 'numeric', 
      month: 'short' 
    })
  }

  const handleRateMatch = (match) => {
    if (onOpenRatingModal) {
      onOpenRatingModal(match)
    }
  }

  const handlePredictMatch = (match) => {
    if (onOpenPrediction) {
      onOpenPrediction(match)
    }
  }

  const showRatingsNotification = showBanner && pendingMatches.length > 0 && !dismissedRatings
  const showPredictionsNotification = showBanner && pendingPredictions.length > 0 && !dismissedPredictions

  if (!showRatingsNotification && !showPredictionsNotification) {
    return null
  }

  return (
    <div className={`pending-notifications-container ${className}`}>
      {/* Predictions Notification */}
      {showPredictionsNotification && (
        <div className="pending-ratings-notification prediction-notification">
          <div className="pending-ratings-banner">
            {/* Icon */}
            <div className="pending-ratings-icon prediction-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="5" r="1" fill="currentColor" />
              </svg>
              {pendingPredictions.length > 1 && (
                <span className="pending-count">{pendingPredictions.length}</span>
              )}
            </div>
            
            {/* Content */}
            <div className="pending-ratings-content">
              <span className="pending-ratings-title">
                {pendingPredictions.length === 1 
                  ? '¡Nuevo partido disponible!'
                  : `${pendingPredictions.length} partidos por predecir`
                }
              </span>
              <span className="pending-ratings-subtitle">
                Predice el ganador y gana XP
              </span>
            </div>

            {/* Actions */}
            <div className="pending-ratings-actions">
              <button 
                className="pending-ratings-btn primary btn-haptic"
                onClick={() => handlePredictMatch(pendingPredictions[0])}
              >
                Predecir
              </button>
              <button 
                className="pending-ratings-dismiss btn-haptic"
                onClick={() => setDismissedPredictions(true)}
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Show prediction match info */}
          {pendingPredictions.length > 0 && (
            <div className="pending-ratings-list">
              {pendingPredictions.slice(0, 2).map((match, index) => (
                <div 
                  key={match.id} 
                  className="pending-match-item"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="pending-match-info">
                    <span className="pending-match-date">{formatDate(match.date)}</span>
                    <span className="pending-match-teams">
                      {match.teamWhite?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                      {' vs '}
                      {match.teamBlack?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                    </span>
                  </div>
                  <button 
                    className="pending-match-btn prediction-btn btn-haptic"
                    onClick={() => handlePredictMatch(match)}
                  >
                    Predecir
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ratings Notification */}
      {showRatingsNotification && (
        <div className="pending-ratings-notification">
          <div className="pending-ratings-banner">
            {/* Icon */}
            <div className="pending-ratings-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              {pendingMatches.length > 1 && (
                <span className="pending-count">{pendingMatches.length}</span>
              )}
            </div>
            
            {/* Content */}
            <div className="pending-ratings-content">
              <span className="pending-ratings-title">
                {pendingMatches.length === 1 
                  ? 'Tienes 1 partido por calificar'
                  : `Tienes ${pendingMatches.length} partidos por calificar`
                }
              </span>
              <span className="pending-ratings-subtitle">
                Califica a tus compañeros para ganar XP
              </span>
            </div>

            {/* Actions */}
            <div className="pending-ratings-actions">
              {pendingMatches.length === 1 ? (
                <button 
                  className="pending-ratings-btn primary btn-haptic"
                  onClick={() => handleRateMatch(pendingMatches[0])}
                >
                  Calificar
                </button>
              ) : (
                <button 
                  className="pending-ratings-btn primary btn-haptic"
                  onClick={() => setExpandedMatch(expandedMatch === 'ratings' ? null : 'ratings')}
                >
                  {expandedMatch === 'ratings' ? 'Ocultar' : 'Ver'}
                </button>
              )}
              <button 
                className="pending-ratings-dismiss btn-haptic"
                onClick={() => setDismissedRatings(true)}
                aria-label="Cerrar"
              >
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Expanded list */}
          {expandedMatch === 'ratings' && pendingMatches.length > 1 && (
            <div className="pending-ratings-list">
              {pendingMatches.map((match, index) => (
                <div 
                  key={match.id} 
                  className="pending-match-item"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="pending-match-info">
                    <span className="pending-match-date">{formatDate(match.date)}</span>
                    <span className="pending-match-teams">
                      {match.teamWhite?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                      {' vs '}
                      {match.teamBlack?.slice(0, 2).map(id => getPlayerName(id)?.split(' ')[0]).join(', ')}
                    </span>
                  </div>
                  <button 
                    className="pending-match-btn btn-haptic"
                    onClick={() => handleRateMatch(match)}
                  >
                    Calificar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Badge component for navigation
export const PendingRatingsBadge = ({ className = '' }) => {
  const { user, userPlayer, matches, ratings } = useApp()
  
  const pendingCount = useMemo(() => {
    if (!user || !userPlayer || !matches.length) return 0
    
    return matches.filter(match => {
      const allPlayers = [...(match.teamWhite || []), ...(match.teamBlack || [])]
      if (!allPlayers.includes(userPlayer)) return false
      if (match.ratingsOpen === false) return false
      
      const hasRated = Object.values(ratings).some(playerRatings =>
        playerRatings.some(
          r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === match.id
        )
      )
      
      return !hasRated
    }).length
  }, [user, userPlayer, matches, ratings])

  if (pendingCount === 0) return null

  return (
    <span className={`pending-ratings-badge ${className}`}>
      {pendingCount > 9 ? '9+' : pendingCount}
    </span>
  )
}

export default PendingRatingsNotification

