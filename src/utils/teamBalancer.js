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

const participates = (id, white, black) => white.includes(id) || black.includes(id)

/**
 * Does this split honour the constraints the assistant asked for?
 *
 * A pair naming someone who is not playing is skipped rather than failed:
 * keeping a player out of the match is its own verb, and the caller validates
 * who may be referenced before we ever get here.
 */
export const satisfiesConstraints = ({ white = [], black = [], constraints } = {}) => {
  const { fijarBlanco = [], fijarNegro = [], juntar = [], separar = [] } = constraints || {}

  if (fijarBlanco.some(id => black.includes(id))) return false
  if (fijarNegro.some(id => white.includes(id))) return false

  const sameTeam = (a, b) =>
    (white.includes(a) && white.includes(b)) || (black.includes(a) && black.includes(b))
  const bothPlay = (a, b) => participates(a, white, black) && participates(b, white, black)

  if (juntar.some(([a, b]) => bothPlay(a, b) && !sameTeam(a, b))) return false
  if (separar.some(([a, b]) => bothPlay(a, b) && sameTeam(a, b))) return false
  return true
}

const defaultShuffle = ids => [...ids].sort(() => Math.random() - 0.5)

/**
 * Best-of-N: shuffle, build greedily, keep the split `evaluateSplit` likes most.
 *
 * The two kinds of constraint enter at different moments, and swapping them
 * breaks the search. `fijarBlanco` / `fijarNegro` are pinned before generation,
 * so every candidate honours them. `juntar` / `separar` filter the candidates
 * afterwards: the best split that satisfies them wins, and if none does, the
 * best split overall comes back with `constraintsMet: false` rather than
 * nothing at all.
 */
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
  constraints,
}) => {
  const { fijarBlanco = [], fijarNegro = [] } = constraints || {}
  const inPool = id => pool.includes(id)
  const startWhite = [...new Set([...pinnedWhite, ...fijarBlanco.filter(inPool)])]
  const startBlack = [...new Set([...pinnedBlack, ...fijarNegro.filter(inPool)])].filter(
    id => !startWhite.includes(id)
  )

  let best = null
  let bestMeeting = null

  for (let i = 0; i < iterations; i++) {
    const { white, black } = buildGreedyTeams({
      order: shuffle(pool),
      pinnedWhite: startWhite,
      pinnedBlack: startBlack,
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
    const candidate = { white, black, score }
    if (!best || score > best.score) best = candidate
    if (
      (!bestMeeting || score > bestMeeting.score) &&
      satisfiesConstraints({ white, black, constraints })
    ) {
      bestMeeting = candidate
    }
  }

  return bestMeeting ? { ...bestMeeting, constraintsMet: true } : { ...best, constraintsMet: false }
}
