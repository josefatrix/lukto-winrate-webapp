/**
 * useStats Hook
 * Calculates player statistics, MVP, rankings, etc.
 */
import { useMemo } from 'react'
import { useApp } from '../contexts'

// Prediction bonus for correct predictions
const PREDICTION_BONUS = 0.2

/**
 * Average rating of a player across a set of ratings.
 * `matchIds` (optional) restricts the average to those matches — used when we
 * need the ranking as it stood before a given match.
 */
const calculatePlayerAvgRating = (playerId, ratings, matchIds = null) => {
  const playerRatings = ratings?.[playerId]
  if (!playerRatings || playerRatings.length === 0) return null

  const scoped = matchIds ? playerRatings.filter(r => matchIds.has(r.matchId)) : playerRatings
  if (scoped.length === 0) return null

  const sum = scoped.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
  const avg = sum / scoped.length
  return typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : null
}

/**
 * Single source of truth for the ranking table.
 * Both the all-time table and the period-filtered one run through here, so the
 * ranking formula can never drift between the two.
 *
 * `scopeRatingsToMatches` restricts each player's average rating to the matches
 * passed in. It stays off by default to preserve the existing behaviour of the
 * period filters (which rate on the full history); the "ranking before the last
 * match" calculation turns it on.
 */
export const computeStatsFromMatches = (players, matchList, ratings, { scopeRatingsToMatches = false } = {}) => {
  const statsMap = {}

  players.forEach(player => {
    statsMap[player.id] = {
      wins: 0,
      losses: 0,
      ties: 0,
      played: 0,
      mvps: 0,
      name: player.name,
      aliases: player.aliases || [],
    }
  })

  const matchIds = scopeRatingsToMatches ? new Set(matchList.map(m => m.id)) : null

  matchList.forEach(match => {
    if (!match.teamWhite || !match.teamBlack) return
    const winner = match.winner
    const decided = winner === 'white' || winner === 'black'
    const tied = winner === 'tie'
    const whiteWon = winner === 'white'
    const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]

    // MVP for this match (highest avg rating)
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
        if (decided) {
          if (whiteWon) statsMap[playerId].wins++
          else statsMap[playerId].losses++
        } else if (tied) {
          statsMap[playerId].ties++
        }
      }
    })

    match.teamBlack.forEach(playerId => {
      if (statsMap[playerId]) {
        statsMap[playerId].played++
        if (decided) {
          if (!whiteWon) statsMap[playerId].wins++
          else statsMap[playerId].losses++
        } else if (tied) {
          statsMap[playerId].ties++
        }
      }
    })
  })

  return Object.entries(statsMap)
    .filter(([, s]) => s.played > 0)
    .map(([id, s]) => {
      const playedGames = s.played || 0
      const winRate = playedGames > 0 ? ((s.wins + 0.5 * (s.ties || 0)) / playedGames) * 100 : 0
      const avgRating = calculatePlayerAvgRating(id, ratings, matchIds)
      const ratingValue = avgRating ? parseFloat(avgRating) : 5

      const mvpRate = s.played > 0 ? (s.mvps / s.played) * 100 : 0

      const baseScore =
        ratingValue * 10 * 0.45 + mvpRate * 0.25 + winRate * 0.2 + Math.min(s.played, 5) * 2

      const confidenceFactor = Math.min(1, 0.35 + Math.log(s.played + 1) / Math.log(6))
      const rankingScore = baseScore * confidenceFactor

      return {
        id,
        ...s,
        winRate: typeof winRate === 'number' && !isNaN(winRate) ? winRate : 0,
        avgRating,
        rankingScore:
          typeof rankingScore === 'number' && !isNaN(rankingScore) ? rankingScore.toFixed(1) : '0.0',
      }
    })
    .sort((a, b) => parseFloat(b.rankingScore) - parseFloat(a.rankingScore) || b.wins - a.wins)
}

const hasResult = match => match?.winner === 'white' || match?.winner === 'black' || match?.winner === 'tie'

export const useStats = () => {
  const { players, matches, ratings, timeFilter } = useApp()

  // Calculate base stats for each player
  const stats = useMemo(
    () => computeStatsFromMatches(players, matches, ratings),
    [players, matches, ratings]
  )

  // Filter matches by time period
  const getFilteredMatches = useMemo(() => {
    const now = new Date()
    return matches.filter(match => {
      const matchDate = new Date(match.date)
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return matchDate >= weekAgo
      }
      if (timeFilter === 'month') {
        return (
          matchDate.getMonth() === now.getMonth() &&
          matchDate.getFullYear() === now.getFullYear()
        )
      }
      return true
    })
  }, [matches, timeFilter])

  // Calculate filtered stats
  const filteredStats = useMemo(() => {
    if (timeFilter === 'all') return stats
    return computeStatsFromMatches(players, getFilteredMatches, ratings)
  }, [players, getFilteredMatches, ratings, timeFilter, stats])

  /**
   * Ranking movement caused by the most recent finished match: where each
   * player sat before it, and where they sit now.
   */
  const rankingMovers = useMemo(() => {
    const played = matches.filter(hasResult).sort((a, b) => new Date(a.date) - new Date(b.date))
    const lastMatch = played[played.length - 1]
    if (!lastMatch) return { lastMatch: null, movers: [] }

    const previousMatches = matches.filter(m => m.id !== lastMatch.id)
    const previousStats = computeStatsFromMatches(players, previousMatches, ratings, {
      scopeRatingsToMatches: true,
    })

    const previousPosition = new Map(previousStats.map((s, index) => [s.id, index + 1]))
    const involved = new Set([...(lastMatch.teamWhite || []), ...(lastMatch.teamBlack || [])])

    const movers = stats
      .map((s, index) => {
        const before = previousPosition.get(s.id)
        return {
          id: s.id,
          name: s.name,
          avgRating: s.avgRating,
          position: index + 1,
          previousPosition: before ?? null,
          delta: before ? before - (index + 1) : null,
          playedLastMatch: involved.has(s.id),
        }
      })
      // Everyone who shifted, not only the players on the pitch: a match moves
      // the table under people who did not play, and showing only the losers of
      // one side reads as a bug.
      .filter(entry => entry.delta !== null && entry.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.position - b.position)

    return { lastMatch, movers }
  }, [players, matches, ratings, stats])

  const computePlayerOfMatches = (periodMatches, minGames) => {
    if (!periodMatches || periodMatches.length === 0) return null

    const periodStats = {}
    periodMatches.forEach(match => {
      if (!match.teamWhite || !match.teamBlack) return
      const winner = match.winner
      const decided = winner === 'white' || winner === 'black'
      const whiteWon = winner === 'white'
      const allPlayers = [...match.teamWhite, ...match.teamBlack]

      allPlayers.forEach(playerId => {
        if (!periodStats[playerId]) {
          periodStats[playerId] = { wins: 0, losses: 0, ties: 0, played: 0, mvps: 0, totalRating: 0, ratingCount: 0 }
        }
        periodStats[playerId].played++

        const inWhite = match.teamWhite.includes(playerId)
        if (decided) {
          if ((inWhite && whiteWon) || (!inWhite && !whiteWon)) {
            periodStats[playerId].wins++
          } else {
            periodStats[playerId].losses = (periodStats[playerId].losses || 0) + 1
          }
        } else if (winner === 'tie') {
          periodStats[playerId].ties = (periodStats[playerId].ties || 0) + 1
        }

        const playerRatings = ratings[playerId] || []
        const matchRatings = playerRatings.filter(r => r.matchId === match.id)
        if (matchRatings.length > 0) {
          const avg = matchRatings.reduce((sum, r) => sum + r.score, 0) / matchRatings.length
          periodStats[playerId].totalRating += avg
          periodStats[playerId].ratingCount++
        }
      })
    })

    let bestPlayer = null
    let bestScore = -1

    Object.entries(periodStats).forEach(([playerId, pStats]) => {
      if (pStats.played >= minGames) {
        const avgRating = pStats.ratingCount > 0 ? pStats.totalRating / pStats.ratingCount : 5
        const score = pStats.wins * 3 + avgRating + pStats.played * 0.5
        if (score > bestScore) {
          bestScore = score
          const playedGames = pStats.played || 0
          const wr = playedGames > 0
            ? Math.round(((pStats.wins + 0.5 * (pStats.ties || 0)) / playedGames) * 100)
            : 0
          bestPlayer = {
            id: playerId,
            ...pStats,
            avgRating: typeof avgRating === 'number' ? avgRating.toFixed(1) : '5.0',
            winRate: wr,
          }
        }
      }
    })

    return bestPlayer
  }

  const getPlayerOfWeek = () => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const periodMatches = matches.filter(m => new Date(m.date) >= weekAgo)
    return computePlayerOfMatches(periodMatches, 1)
  }

  const getPlayerOfMonth = () => {
    const now = new Date()
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const isMonthClosed = now.getDate() === lastDayOfMonth

    let targetMonth = now.getMonth()
    let targetYear = now.getFullYear()
    if (!isMonthClosed) {
      targetMonth -= 1
      if (targetMonth < 0) {
        targetMonth = 11
        targetYear -= 1
      }
    }

    const start = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0)
    const end = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999)
    const periodMatches = matches.filter(m => {
      const d = new Date(m.date)
      return d >= start && d <= end
    })
    return computePlayerOfMatches(periodMatches, 2)
  }

  const getMonthlyWinners = () => {
    // Get all unique year-month combos from matches, sorted newest first
    const groups = new Map()
    matches.forEach(match => {
      const d = new Date(match.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(match)
    })

    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, monthMatches]) => {
        const [year, month] = key.split('-').map(Number)
        const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
        return {
          key,
          monthLabel,
          winner: computePlayerOfMatches(monthMatches, 2),
        }
      })
  }


  const getWeeklyWinners = (limit = 8) => {
    const startOfWeek = date => {
      const d = new Date(date)
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day
      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      return d
    }

    const groups = new Map()
    matches.forEach(match => {
      const matchDate = new Date(match.date)
      const weekStart = startOfWeek(matchDate)
      const key = weekStart.toISOString().split('T')[0]
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(match)
    })

    const weeks = Array.from(groups.entries())
      .map(([key, weekMatches]) => {
        const weekStart = new Date(key)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 6)
        weekEnd.setHours(23, 59, 59, 999)
        return {
          weekStart,
          weekEnd,
          winner: computePlayerOfMatches(weekMatches, 1),
        }
      })
      .sort((a, b) => b.weekStart - a.weekStart)

    return weeks.slice(0, limit)
  }

  return {
    stats,
    filteredStats,
    getFilteredMatches,
    rankingMovers,
    getPlayerOfMonth,
    getMonthlyWinners,
    getPlayerOfWeek,
    getWeeklyWinners,
  }
}

// Helper function - Check if player correctly predicted a specific match
export const getMatchPredictionBonus = (playerId, matchId, predictions, userLinks) => {
  if (!predictions || !userLinks || !matchId) return 0

  // Find the user ID linked to this player
  const userId = Object.entries(userLinks).find(([, data]) => data?.playerId === playerId)?.[0]
  if (!userId) return 0

  const userPrediction = predictions[matchId]?.[userId]
  return userPrediction ? PREDICTION_BONUS : 0
}

// Helper function - Check if prediction was correct for a match
export const isPredictionCorrect = (userId, matchId, matchWinner, predictions) => {
  if (!predictions || !userId || !matchId || !matchWinner) return false
  const userPrediction = predictions[matchId]?.[userId]
  return userPrediction?.prediction === matchWinner
}

export default useStats
