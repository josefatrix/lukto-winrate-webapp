/** Shared sporting rules. Only completed matches contribute to statistics. */
export const hasResult = match => ['white', 'black', 'tie'].includes(match?.winner)

export const finiteOr = (value, fallback) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return fallback
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

/** Percentage: (wins + half the draws) / all completed appearances. */
export const calculateWinRate = (wins, ties, played) => played > 0 ? ((wins + ties * 0.5) / played) * 100 : 0

export const compareMatchChronology = (a, b) => {
  const dateOrder = String(a.date || '').localeCompare(String(b.date || ''))
  return dateOrder || String(a.time || '').localeCompare(String(b.time || '')) || String(a.id).localeCompare(String(b.id), 'en', { numeric: true })
}

const playerResults = (matches, playerId) => matches
  .filter(match => hasResult(match) && (match.teamWhite?.includes(playerId) || match.teamBlack?.includes(playerId)))
  .sort(compareMatchChronology)
  .map(match => match.winner === 'tie' ? 'D' : (match.teamWhite?.includes(playerId) ? match.winner === 'white' : match.winner === 'black') ? 'W' : 'L')

export const getStreakSummary = (matches, playerId) => {
  let current = { type: null, count: 0 }
  let bestWinStreak = 0
  let bestUnbeatenStreak = 0
  let unbeaten = 0
  for (const result of playerResults(matches, playerId)) {
    current = { type: result, count: current.type === result ? current.count + 1 : 1 }
    unbeaten = result === 'L' ? 0 : unbeaten + 1
    bestUnbeatenStreak = Math.max(bestUnbeatenStreak, unbeaten)
    if (result === 'W') bestWinStreak = Math.max(bestWinStreak, current.count)
  }
  return { current, bestWinStreak, bestUnbeatenStreak }
}

export const getCurrentStreak = (matches, playerId) => getStreakSummary(matches, playerId).current

const validRatings = entries => (entries || []).filter(entry => typeof entry.score === 'number' && Number.isFinite(entry.score) && entry.score >= 0 && entry.score <= 10)

/** Co-leaders meeting the per-player vote threshold share the MVP award. */
export const getMatchMvp = (match, ratings = {}, minVotes = 4) => {
  if (!hasResult(match)) return null
  const threshold = Math.max(1, Math.ceil(finiteOr(minVotes, 4)))
  const candidates = [...new Set([...(match.teamWhite || []), ...(match.teamBlack || [])])]
    .map(playerId => {
      const entries = validRatings(ratings[playerId]).filter(entry => entry.matchId === match.id)
      return { playerId, votes: entries.length, avgRating: entries.length ? entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length : 0 }
    })
    .filter(candidate => candidate.votes >= threshold)
    .sort((a, b) => b.avgRating - a.avgRating || String(a.playerId).localeCompare(String(b.playerId)))
  if (!candidates.length) return null
  const leader = candidates[0]
  return { playerId: leader.playerId, avgRating: leader.avgRating, votes: leader.votes, tiedPlayerIds: candidates.filter(candidate => Math.abs(candidate.avgRating - leader.avgRating) < 1e-9).map(candidate => candidate.playerId) }
}

export const computeStatsFromMatches = (players, matchList, ratings = {}, { scopeRatingsToMatches = false, mvpMinVotes = 4 } = {}) => {
  const completedMatches = matchList.filter(hasResult)
  const matchIds = scopeRatingsToMatches ? new Set(completedMatches.map(match => match.id)) : null
  const statsMap = new Map(players.map(player => [player.id, { id: player.id, name: player.name, aliases: player.aliases || [], wins: 0, losses: 0, ties: 0, played: 0, mvps: 0 }]))
  for (const match of completedMatches) {
    const mvp = getMatchMvp(match, ratings, mvpMinVotes)
    for (const playerId of mvp?.tiedPlayerIds || []) {
      if (statsMap.has(playerId)) statsMap.get(playerId).mvps++
    }
    for (const playerId of new Set([...(match.teamWhite || []), ...(match.teamBlack || [])])) {
      const stats = statsMap.get(playerId)
      if (!stats) continue
      stats.played++
      if (match.winner === 'tie') stats.ties++
      else if ((match.teamWhite?.includes(playerId) && match.winner === 'white') || (match.teamBlack?.includes(playerId) && match.winner === 'black')) stats.wins++
      else stats.losses++
    }
  }
  return [...statsMap.values()].filter(stats => stats.played > 0).map(stats => {
    const entries = validRatings(ratings[stats.id]).filter(entry => !matchIds || matchIds.has(entry.matchId))
    const avgRating = entries.length ? (entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length).toFixed(1) : null
    const winRate = calculateWinRate(stats.wins, stats.ties, stats.played)
    const baseScore = finiteOr(avgRating, 5) * 10 * 0.45 + (stats.mvps / stats.played) * 100 * 0.25 + winRate * 0.2 + Math.min(stats.played, 5) * 2
    const confidenceFactor = Math.min(1, 0.35 + Math.log(stats.played + 1) / Math.log(6))
    return { ...stats, winRate, avgRating, rankingScore: (baseScore * confidenceFactor).toFixed(1) }
  }).sort((a, b) => Number(b.rankingScore) - Number(a.rankingScore) || b.wins - a.wins || String(a.id).localeCompare(String(b.id)))
}
