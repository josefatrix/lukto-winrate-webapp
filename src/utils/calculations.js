/**
 * Statistics and ranking calculations
 */

import { RANKING_WEIGHTS, XP_VALUES, RANK_THRESHOLDS } from '../constants/config'

/**
 * Calculate player's average rating from all their ratings
 */
export const calculatePlayerAvgRating = (playerId, ratings) => {
  const playerRatings = ratings?.[playerId]
  if (!playerRatings || playerRatings.length === 0) return null
  const sum = playerRatings.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
  const avg = sum / playerRatings.length
  return typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : null
}

/**
 * Calculate ranking score using weighted formula
 * 45% Rating + 25% MVP Rate + 20% Win Rate + 10% Participation
 */
export const calculateRankingScore = (stats, avgRating) => {
  const { played, mvps, winRate } = stats
  const ratingValue = avgRating ? parseFloat(avgRating) : 5
  
  // MVP Rate instead of total (fairer for all players)
  const mvpRate = played > 0 ? (mvps / played) * 100 : 0
  
  // Base score calculation
  const baseScore = 
    (ratingValue * 10 * RANKING_WEIGHTS.rating) +
    (mvpRate * RANKING_WEIGHTS.mvpRate) +
    (winRate * RANKING_WEIGHTS.winRate) +
    (Math.min(played, 5) * 2) // Participation (max 10 pts)
  
  // Confidence factor with logarithmic curve
  // 1 game = 0.50, 2 = 0.65, 3 = 0.80, 4 = 0.90, 5+ = 1.0
  const confidenceFactor = Math.min(1, 0.35 + (Math.log(played + 1) / Math.log(6)))
  
  const result = baseScore * confidenceFactor
  return typeof result === 'number' && !isNaN(result) ? result.toFixed(1) : '0.0'
}

/**
 * Calculate win/loss streaks for a player
 */
export const calculateStreaks = (playerId, matches) => {
  const sortedMatches = [...matches].sort((a, b) => new Date(a.date) - new Date(b.date))
  let currentStreak = 0
  let streakType = null
  let maxWinStreak = 0
  let maxLossStreak = 0
  let tempStreak = 0
  let tempType = null

  sortedMatches.forEach(match => {
    if (!match.teamWhite || !match.teamBlack) return
    const inWhite = match.teamWhite.includes(playerId)
    const inBlack = match.teamBlack.includes(playerId)
    if (!inWhite && !inBlack) return

    const decided = match.winner === 'white' || match.winner === 'black'
    if (!decided) return
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

/**
 * Calculate head-to-head stats between two players
 */
export const calculateH2H = (player1Id, player2Id, matches) => {
  let sameTeamWins = 0
  let sameTeamLosses = 0
  let againstWins = 0
  let againstLosses = 0

  matches.forEach(match => {
    if (!match.teamWhite || !match.teamBlack) return
    const p1White = match.teamWhite.includes(player1Id)
    const p1Black = match.teamBlack.includes(player1Id)
    const p2White = match.teamWhite.includes(player2Id)
    const p2Black = match.teamBlack.includes(player2Id)
    
    if (match.winner !== 'white' && match.winner !== 'black') return
    
    // Same team
    if ((p1White && p2White) || (p1Black && p2Black)) {
      const won = (p1White && match.winner === 'white') || (p1Black && match.winner === 'black')
      if (won) sameTeamWins++
      else sameTeamLosses++
    }
    // Against each other
    else if ((p1White && p2Black) || (p1Black && p2White)) {
      const p1Won = (p1White && match.winner === 'white') || (p1Black && match.winner === 'black')
      if (p1Won) againstWins++
      else againstLosses++
    }
  })

  return {
    sameTeam: { wins: sameTeamWins, losses: sameTeamLosses, total: sameTeamWins + sameTeamLosses },
    against: { wins: againstWins, losses: againstLosses, total: againstWins + againstLosses }
  }
}

/**
 * Calculate XP for a player based on their activity
 */
export const calculateXP = (playerId, matches, ratings) => {
  let xp = 0
  
  // XP from games
  matches.forEach(match => {
    if (!match.teamWhite || !match.teamBlack) return
    const inWhite = match.teamWhite.includes(playerId)
    const inBlack = match.teamBlack.includes(playerId)
    if (!inWhite && !inBlack) return
    
    xp += XP_VALUES.gamePlay
    
    // Win bonus
    const won = (inWhite && match.winner === 'white') || (inBlack && match.winner === 'black')
    if (won) xp += XP_VALUES.gameWin
    
    // MVP bonus (check if player was MVP)
    const allPlayers = [...match.teamWhite, ...match.teamBlack]
    let mvpId = null
    let mvpRating = -1
    
    allPlayers.forEach(pid => {
      const playerRatings = ratings[pid] || []
      const matchRatings = playerRatings.filter(r => r.matchId === match.id)
      if (matchRatings.length > 0) {
        const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
        if (avg > mvpRating) {
          mvpRating = avg
          mvpId = pid
        }
      }
    })
    
    if (mvpId === playerId) xp += XP_VALUES.mvp
  })
  
  // XP from ratings received
  const playerRatings = ratings[playerId] || []
  xp += playerRatings.length * XP_VALUES.ratingReceived
  
  // XP from ratings given
  Object.values(ratings).forEach(ratingList => {
    ratingList.forEach(r => {
      if (r.ratedBy === playerId) {
        xp += XP_VALUES.ratingGiven
      }
    })
  })
  
  return xp
}

/**
 * Get rank based on XP
 */
export const getRank = (xp) => {
  if (xp >= RANK_THRESHOLDS.leyenda) return 'leyenda'
  if (xp >= RANK_THRESHOLDS.maestro) return 'maestro'
  if (xp >= RANK_THRESHOLDS.diamante) return 'diamante'
  if (xp >= RANK_THRESHOLDS.platino) return 'platino'
  if (xp >= RANK_THRESHOLDS.oro) return 'oro'
  if (xp >= RANK_THRESHOLDS.plata) return 'plata'
  return 'bronce'
}

/**
 * Fewest matches a player needs in a period to get a ranking position; the
 * rest stay "En evaluación" so one lucky match can't top the table.
 */
export const MIN_RANKED_PLAYED = { all: 3, month: 2, week: 1 }

/**
 * Players that hold a ranking position, best ranking score first
 */
export const getRankedPlayers = (stats, minPlayed = MIN_RANKED_PLAYED.all) =>
  [...(stats || [])]
    .filter(s => (s.played || 0) >= minPlayed)
    .sort((a, b) => (parseFloat(b.rankingScore) || 0) - (parseFloat(a.rankingScore) || 0))

/**
 * Get XP progress to next rank
 */
export const getXPProgress = (xp) => {
  const rank = getRank(xp)
  const thresholds = Object.entries(RANK_THRESHOLDS).sort((a, b) => a[1] - b[1])
  const currentIndex = thresholds.findIndex(([r]) => r === rank)
  const nextThreshold = thresholds[currentIndex + 1]
  
  if (!nextThreshold) return { current: xp, next: xp, progress: 100, nextRank: null }
  
  const currentThreshold = thresholds[currentIndex][1]
  const progress = ((xp - currentThreshold) / (nextThreshold[1] - currentThreshold)) * 100
  
  return {
    current: xp,
    next: nextThreshold[1],
    progress: Math.min(100, Math.max(0, progress)),
    nextRank: nextThreshold[0]
  }
}

/**
 * Filter matches by time period
 */
export const filterMatchesByPeriod = (matches, period) => {
  if (period === 'all') return matches
  
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  return matches.filter(match => {
    const matchDate = new Date(match.date)
    if (period === 'week') return matchDate >= startOfWeek
    if (period === 'month') return matchDate >= startOfMonth
    return true
  })
}
