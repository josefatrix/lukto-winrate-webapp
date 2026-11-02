/**
 * Who plays well with whom, and who beats whom.
 *
 * Extracted from useMatchBuilder's `historicalDraftLinks` so the assistant's
 * facts block and the match builder read the same numbers from the same code.
 * Only decided matches count — a draw says nothing about chemistry.
 */

export const pairKey = (a, b) => [a, b].sort().join('__')
export const duelKey = (a, b) => `${a}__${b}`

export const computeDraftLinks = (matches = []) => {
  const teammatePairs = {}
  const duelStats = {}

  const addPair = (a, b, won) => {
    if (!a || !b) return
    const key = pairKey(a, b)
    if (!teammatePairs[key]) teammatePairs[key] = { games: 0, wins: 0 }
    teammatePairs[key].games += 1
    if (won) teammatePairs[key].wins += 1
  }

  const addDuel = (a, b, aWon) => {
    if (!a || !b) return
    const key = duelKey(a, b)
    if (!duelStats[key]) duelStats[key] = { games: 0, wins: 0 }
    duelStats[key].games += 1
    if (aWon) duelStats[key].wins += 1
  }

  for (const match of matches) {
    const whiteWon = match?.winner === 'white'
    const blackWon = match?.winner === 'black'
    if (!whiteWon && !blackWon) continue

    const white = match.teamWhite || []
    const black = match.teamBlack || []

    for (let i = 0; i < white.length; i++) {
      for (let j = i + 1; j < white.length; j++) addPair(white[i], white[j], whiteWon)
    }
    for (let i = 0; i < black.length; i++) {
      for (let j = i + 1; j < black.length; j++) addPair(black[i], black[j], blackWon)
    }
    for (const w of white) {
      for (const b of black) {
        addDuel(w, b, whiteWon)
        addDuel(b, w, blackWon)
      }
    }
  }

  return { teammatePairs, duelStats }
}
