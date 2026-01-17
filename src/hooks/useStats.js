/**
 * useStats Hook
 * Calculates player statistics, MVP, rankings, etc.
 */
import { useMemo } from 'react'
import { useApp } from '../contexts'

export const useStats = () => {
  const { players, matches, ratings, timeFilter } = useApp()

  // Calculate base stats for each player
  const stats = useMemo(() => {
    const statsMap = {}

    players.forEach(player => {
      statsMap[player.id] = {
        wins: 0,
        losses: 0,
        played: 0,
        mvps: 0,
        name: player.name,
        aliases: player.aliases || [],
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
      .map(([id, s]) => {
        const winRate = s.played > 0 ? (s.wins / s.played) * 100 : 0
        const avgRating = calculatePlayerAvgRating(id, ratings)
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
          rankingScore: typeof rankingScore === 'number' && !isNaN(rankingScore) ? rankingScore.toFixed(1) : '0.0',
        }
      })
      .sort(
        (a, b) => parseFloat(b.rankingScore) - parseFloat(a.rankingScore) || b.wins - a.wins
      )
  }, [players, matches, ratings])

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

    const statsMap = {}
    players.forEach(player => {
      statsMap[player.id] = {
        wins: 0,
        losses: 0,
        played: 0,
        mvps: 0,
        name: player.name,
        aliases: player.aliases || [],
      }
    })

    getFilteredMatches.forEach(match => {
      const whiteWon = match.winner === 'white'
      const allMatchPlayers = [...match.teamWhite, ...match.teamBlack]

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
      .map(([id, s]) => {
        const winRate = s.played > 0 ? (s.wins / s.played) * 100 : 0
        const avgRating = calculatePlayerAvgRating(id, ratings)
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
          rankingScore: typeof rankingScore === 'number' && !isNaN(rankingScore) ? rankingScore.toFixed(1) : '0.0',
        }
      })
      .sort(
        (a, b) => parseFloat(b.rankingScore) - parseFloat(a.rankingScore) || b.wins - a.wins
      )
  }, [players, getFilteredMatches, ratings, timeFilter, stats])

  // Player of the period (week/month)
  const getPlayerOfPeriod = period => {
    const now = new Date()
    let periodMatches

    if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      periodMatches = matches.filter(m => new Date(m.date) >= weekAgo)
    } else {
      periodMatches = matches.filter(m => {
        const d = new Date(m.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
    }

    if (periodMatches.length === 0) return null

    const periodStats = {}
    periodMatches.forEach(match => {
      const whiteWon = match.winner === 'white'
      const allPlayers = [...match.teamWhite, ...match.teamBlack]

      allPlayers.forEach(playerId => {
        if (!periodStats[playerId]) {
          periodStats[playerId] = { wins: 0, played: 0, mvps: 0, totalRating: 0, ratingCount: 0 }
        }
        periodStats[playerId].played++

        const inWhite = match.teamWhite.includes(playerId)
        if ((inWhite && whiteWon) || (!inWhite && !whiteWon)) {
          periodStats[playerId].wins++
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

    const minGames = period === 'week' ? 1 : 2

    Object.entries(periodStats).forEach(([playerId, pStats]) => {
      if (pStats.played >= minGames) {
        const avgRating = pStats.ratingCount > 0 ? pStats.totalRating / pStats.ratingCount : 5
        const score = pStats.wins * 3 + avgRating + pStats.played * 0.5
        if (score > bestScore) {
          bestScore = score
          const wr = pStats.played > 0 ? Math.round((pStats.wins / pStats.played) * 100) : 0
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

  return {
    stats,
    filteredStats,
    getFilteredMatches,
    getPlayerOfMonth: () => getPlayerOfPeriod('month'),
    getPlayerOfWeek: () => getPlayerOfPeriod('week'),
  }
}

// Helper function
const calculatePlayerAvgRating = (playerId, ratings) => {
  const playerRatings = ratings?.[playerId]
  if (!playerRatings || playerRatings.length === 0) return null
  const sum = playerRatings.reduce((acc, r) => acc + (typeof r.score === 'number' ? r.score : 0), 0)
  const avg = sum / playerRatings.length
  return typeof avg === 'number' && !isNaN(avg) ? avg.toFixed(1) : null
}

export default useStats

