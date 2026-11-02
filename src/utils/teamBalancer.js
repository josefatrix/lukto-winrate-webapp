/**
 * Team balancer, extracted from useMatchBuilder so it can be tested.
 *
 * Everything here is pure: what used to come from the hook's closure
 * (`statsById`, `matchPositions`, `teamSize`) now arrives as a parameter, and
 * the randomness arrives as `shuffle`. The formulas are unchanged — the dots
 * the admin sees on screen come from the same numbers the algorithm uses, and
 * that has to stay true.
 */
import { getPositionGroup } from './matchConstants.js'

export const BEST_OF_N_ITERATIONS = 40

/** Strength of one player. `undefined` stats mean "unknown", not "weak". */
export const scorePlayer = statsEntry => {
  if (!statsEntry) return 50
  const avgRating = parseFloat(statsEntry.avgRating) || 5
  const winRate = Number(statsEntry.winRate) || 50
  const mvps = Number(statsEntry.mvps) || 0
  const played = Number(statsEntry.played) || 0
  return avgRating * 6 + winRate * 0.5 + Math.min(mvps, 10) * 1.2 + Math.min(played, 20) * 0.15
}

const ROLE_WEIGHTS = { Portero: 2.2, Defensa: 1.1, Medio: 0.9, Delantero: 0.6 }

/**
 * How badly one team's roles are covered. `teamSize` matters: a half-built
 * team is judged more leniently than a full one, so the same positions score
 * differently depending on the format.
 */
export const rolePenaltyFor = (positions, teamSize) => {
  if (!positions?.length) return 0
  const coverage = { Portero: 0, Defensa: 0, Medio: 0, Delantero: 0 }
  let withoutPosition = 0

  positions.forEach(pos => {
    if (!pos) {
      withoutPosition += 1
      return
    }
    const group = getPositionGroup(pos)
    if (coverage[group] !== undefined) coverage[group] += 1
  })

  const isComplete = positions.length === teamSize
  const mult = isComplete ? 1 : 0.55

  let penalty = 0
  Object.entries(ROLE_WEIGHTS).forEach(([role, weight]) => {
    if (coverage[role] === 0) penalty += weight * mult
  })
  penalty += Math.max((coverage.Portero || 0) - 1, 0) * 0.35
  penalty += withoutPosition * (isComplete ? 0.25 : 0.15)
  return penalty
}

/** One greedy pass over `order`, placing each player on the side that hurts least. */
export const buildGreedyTeams = ({
  order,
  pinnedWhite = [],
  pinnedBlack = [],
  teamSize,
  scoreOf,
  positionOf,
}) => {
  const white = [...pinnedWhite]
  const black = [...pinnedBlack]
  let whiteScore = white.reduce((sum, id) => sum + scoreOf(id), 0)
  let blackScore = black.reduce((sum, id) => sum + scoreOf(id), 0)
  const locked = new Set([...pinnedWhite, ...pinnedBlack])
  const penalty = ids => rolePenaltyFor(ids.map(positionOf), teamSize)

  order
    .filter(id => !locked.has(id))
    .forEach(id => {
      const score = scoreOf(id)
      if (white.length >= teamSize) {
        black.push(id)
        blackScore += score
        return
      }
      if (black.length >= teamSize) {
        white.push(id)
        whiteScore += score
        return
      }

      const objW =
        Math.abs(whiteScore + score - blackScore) +
        (penalty([...white, id]) + penalty(black)) * 12
      const objB =
        Math.abs(whiteScore - (blackScore + score)) +
        (penalty(white) + penalty([...black, id])) * 12

      if (objW <= objB) {
        white.push(id)
        whiteScore += score
      } else {
        black.push(id)
        blackScore += score
      }
    })

  return { white, black, whiteScore, blackScore }
}

/** How good a split is: 100 minus what the imbalances cost. */
export const evaluateSplit = ({
  whiteIds,
  blackIds,
  teamSize,
  scoreOf,
  positionOf,
  probability,
}) => {
  const whitePower = whiteIds.reduce((sum, id) => sum + scoreOf(id), 0)
  const blackPower = blackIds.reduce((sum, id) => sum + scoreOf(id), 0)
  const total = whitePower + blackPower
  const gapPct = total > 0 ? (Math.abs(whitePower - blackPower) / total) * 100 : 0
  const probGap = Math.abs((probability?.white || 50) - (probability?.black || 50))
  const rolePen =
    rolePenaltyFor(whiteIds.map(positionOf), teamSize) +
    rolePenaltyFor(blackIds.map(positionOf), teamSize)
  return 100 - probGap * 0.95 - gapPct * 0.7 - rolePen * 6
}

const defaultShuffle = ids => [...ids].sort(() => Math.random() - 0.5)

/** Best-of-N: shuffle, build greedily, keep the split `evaluateSplit` likes most. */
export const pickBestSplit = ({
  pool,
  pinnedWhite = [],
  pinnedBlack = [],
  teamSize,
  scoreOf,
  positionOf,
  probabilityOf,
  iterations = BEST_OF_N_ITERATIONS,
  shuffle = defaultShuffle,
}) => {
  let best = null
  for (let i = 0; i < iterations; i++) {
    const { white, black } = buildGreedyTeams({
      order: shuffle(pool),
      pinnedWhite,
      pinnedBlack,
      teamSize,
      scoreOf,
      positionOf,
    })
    const score = evaluateSplit({
      whiteIds: white,
      blackIds: black,
      teamSize,
      scoreOf,
      positionOf,
      probability: probabilityOf(white, black),
    })
    if (!best || score > best.score) best = { white, black, score }
  }
  return best
}
