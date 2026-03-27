import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { doc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useApp } from '../contexts'
import { useStats } from './useStats'
import {
  POSITION_OPTIONS,
  MATCH_FORMAT_OPTIONS,
  getPositionLabel,
  getPositionGroup,
  clamp,
} from '../utils/matchConstants'

const BEST_OF_N_ITERATIONS = 40

const EMPTY_POINTER_STATE = {
  playerId: '',
  pointerId: null,
  offsetX: 0,
  offsetY: 0,
  startClientX: 0,
  startClientY: 0,
  dragStarted: false,
  releaseTarget: null,
}

export const useMatchBuilder = ({ showToast, logActivity }) => {
  const { players, matches, getPlayerName } = useApp()
  const { stats } = useStats()

  // ── form state ──
  const [matchDate, setMatchDate] = useState('')
  const [matchTime, setMatchTime] = useState('')
  const [matchVenue, setMatchVenue] = useState('LUKTO')
  const [matchFormat, setMatchFormat] = useState('6v6')
  const [selectedPlayers, setSelectedPlayers] = useState([])
  const [scoreWhite, setScoreWhite] = useState('')
  const [scoreBlack, setScoreBlack] = useState('')
  const [preserveCaptains, setPreserveCaptains] = useState(false)
  const [lockedWhiteCaptain, setLockedWhiteCaptain] = useState('')
  const [lockedBlackCaptain, setLockedBlackCaptain] = useState('')
  const [teamWhite, setTeamWhite] = useState([])
  const [teamBlack, setTeamBlack] = useState([])
  const [matchPositions, setMatchPositions] = useState({})
  const [winner, setWinner] = useState('')
  const [editingMatchId, setEditingMatchId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [poolSearch, setPoolSearch] = useState('')

  // ── TV board state ──
  const [showTvBoard, setShowTvBoard] = useState(false)
  const [tvBoardLayout, setTvBoardLayout] = useState({})
  const [draggingTvPlayerId, setDraggingTvPlayerId] = useState('')
  const [tvDragTeam, setTvDragTeam] = useState('')
  const [selectedTvPlayerId, setSelectedTvPlayerId] = useState('')
  const tvPitchRef = useRef(null)
  const tvPointerDragRef = useRef({ ...EMPTY_POINTER_STATE })
  const tvLastDragAtRef = useRef(0)

  // ── derived values ──
  const teamSize = matchFormat === '7v7' ? 7 : 6
  const requiredPlayers = teamSize * 2

  const statsById = useMemo(
    () => Object.fromEntries((stats || []).map(s => [s.id, s])),
    [stats],
  )

  // ── Preset / convocatoria management ──
  const PRESETS_KEY = 'lukto_match_presets'

  const loadPresets = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]')
    } catch {
      return []
    }
  }, [])

  const savePreset = useCallback((name) => {
    if (!name?.trim()) return
    const presets = loadPresets()
    const exists = presets.findIndex(p => p.name === name.trim())
    const entry = {
      name: name.trim(),
      playerIds: [...selectedPlayers],
      format: matchFormat,
      updatedAt: Date.now(),
    }
    if (exists >= 0) {
      presets[exists] = entry
    } else {
      presets.push(entry)
    }
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
    showToast('success', `Convocatoria "${name.trim()}" guardada`)
  }, [selectedPlayers, matchFormat, loadPresets, showToast])

  const applyPreset = useCallback((preset) => {
    if (!preset?.playerIds?.length) return
    const validIds = new Set(players.map(p => p.id))
    const ids = preset.playerIds.filter(id => validIds.has(id))
    const nextFormat = preset.format || matchFormat
    const nextTeamSize = nextFormat === '7v7' ? 7 : 6
    const nextRequired = nextTeamSize * 2
    const finalIds = ids.slice(0, nextRequired)

    setMatchFormat(nextFormat)
    setSelectedPlayers(finalIds)
    setTeamWhite([])
    setTeamBlack([])
    setMatchPositions({})
    setWinner('')
    showToast('success', `Convocatoria "${preset.name}" cargada (${finalIds.length} jugadores)`)
  }, [players, matchFormat, showToast])

  const deletePreset = useCallback((name) => {
    const presets = loadPresets().filter(p => p.name !== name)
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
    showToast('success', `Convocatoria "${name}" eliminada`)
  }, [loadPresets, showToast])

  // ── Most frequent position for a player (auto-default) ──
  const playerFrequentPositions = useMemo(() => {
    const freq = {}
    matches.forEach(match => {
      const positions = match.positions || {}
      Object.entries(positions).forEach(([playerId, pos]) => {
        if (!pos) return
        if (!freq[playerId]) freq[playerId] = {}
        freq[playerId][pos] = (freq[playerId][pos] || 0) + 1
      })
    })
    const result = {}
    Object.entries(freq).forEach(([playerId, counts]) => {
      let best = ''
      let bestCount = 0
      Object.entries(counts).forEach(([pos, count]) => {
        if (count > bestCount) {
          best = pos
          bestCount = count
        }
      })
      if (best) result[playerId] = best
    })
    return result
  }, [matches])

  // Auto-set default position when a player is added to a team
  const autoAssignPosition = useCallback((playerId) => {
    setMatchPositions(prev => {
      if (prev[playerId]) return prev
      const defaultPos = playerFrequentPositions[playerId]
      if (!defaultPos) return prev
      return { ...prev, [playerId]: defaultPos }
    })
  }, [playerFrequentPositions])

  // ── Pool search: filtered players ──
  const filteredPoolPlayers = useMemo(() => {
    if (!poolSearch.trim()) return players
    const q = poolSearch.trim().toLowerCase()
    return players.filter(p =>
      p.name?.toLowerCase().includes(q) ||
      (p.aliases || []).some(a => a.toLowerCase().includes(q)),
    )
  }, [players, poolSearch])

  // ── Format change ──
  const handleMatchFormatChange = useCallback((nextFormat) => {
    if (nextFormat === matchFormat) return
    const nextTeamSize = nextFormat === '7v7' ? 7 : 6
    const nextRequired = nextTeamSize * 2
    const next = selectedPlayers.slice(0, nextRequired)
    const allowed = new Set(next)

    setMatchFormat(nextFormat)
    setSelectedPlayers(next)
    setLockedWhiteCaptain(c => (allowed.has(c) ? c : ''))
    setLockedBlackCaptain(c => (allowed.has(c) ? c : ''))
    setTeamWhite(c => c.filter(id => allowed.has(id)).slice(0, nextTeamSize))
    setTeamBlack(c => c.filter(id => allowed.has(id)).slice(0, nextTeamSize))
    setMatchPositions(prev => {
      const n = {}
      Object.entries(prev).forEach(([pid, pos]) => {
        if (allowed.has(pid)) n[pid] = pos
      })
      return n
    })
    setWinner('')
  }, [matchFormat, selectedPlayers])

  // ── Pool toggle ──
  const handlePoolPlayerToggle = useCallback((playerId) => {
    if (selectedPlayers.includes(playerId)) {
      setSelectedPlayers(selectedPlayers.filter(id => id !== playerId))
      setTeamWhite(c => c.filter(id => id !== playerId))
      setTeamBlack(c => c.filter(id => id !== playerId))
      setMatchPositions(prev => {
        const n = { ...prev }
        delete n[playerId]
        return n
      })
      setWinner('')
      return
    }
    if (selectedPlayers.length >= requiredPlayers) {
      showToast('error', `Solo puedes elegir ${requiredPlayers} jugadores para ${teamSize} vs ${teamSize}`)
      return
    }
    setSelectedPlayers([...selectedPlayers, playerId])
  }, [selectedPlayers, requiredPlayers, teamSize, showToast])

  // ── Team toggle ──
  const handlePlayerToggle = useCallback((playerId, team) => {
    if (!selectedPlayers.includes(playerId)) {
      showToast('error', 'Primero agrega el jugador a la lista seleccionada')
      return
    }
    if (team === 'white') {
      if (teamWhite.includes(playerId)) {
        setTeamWhite(teamWhite.filter(id => id !== playerId))
        setMatchPositions(prev => { const n = { ...prev }; delete n[playerId]; return n })
      } else if (teamWhite.length >= teamSize) {
        showToast('error', `El equipo blanco ya tiene ${teamSize} jugadores`)
      } else if (!teamBlack.includes(playerId)) {
        setTeamWhite([...teamWhite, playerId])
        autoAssignPosition(playerId)
      }
    } else {
      if (teamBlack.includes(playerId)) {
        setTeamBlack(teamBlack.filter(id => id !== playerId))
        setMatchPositions(prev => { const n = { ...prev }; delete n[playerId]; return n })
      } else if (teamBlack.length >= teamSize) {
        showToast('error', `El equipo negro ya tiene ${teamSize} jugadores`)
      } else if (!teamWhite.includes(playerId)) {
        setTeamBlack([...teamBlack, playerId])
        autoAssignPosition(playerId)
      }
    }
  }, [selectedPlayers, teamWhite, teamBlack, teamSize, showToast, autoAssignPosition])

  // ── Clear helpers ──
  const clearSelectedPlayers = useCallback(() => {
    setSelectedPlayers([])
    setPreserveCaptains(false)
    setLockedWhiteCaptain('')
    setLockedBlackCaptain('')
    setTeamWhite([])
    setTeamBlack([])
    setMatchPositions({})
    setWinner('')
  }, [])

  const clearCurrentTeams = useCallback(() => {
    setTeamWhite([])
    setTeamBlack([])
    setWinner('')
  }, [])

  // ── Captain handlers ──
  const handleWhiteCaptainChange = useCallback((playerId) => {
    if (playerId && playerId === lockedBlackCaptain) setLockedBlackCaptain('')
    setLockedWhiteCaptain(playerId)
  }, [lockedBlackCaptain])

  const handleBlackCaptainChange = useCallback((playerId) => {
    if (playerId && playerId === lockedWhiteCaptain) setLockedWhiteCaptain('')
    setLockedBlackCaptain(playerId)
  }, [lockedWhiteCaptain])

  // ── Balance score ──
  const getPlayerBalanceScore = useCallback((playerId) => {
    const ps = statsById[playerId]
    if (!ps) return 50
    const avgRating = parseFloat(ps.avgRating) || 5
    const winRate = Number(ps.winRate) || 50
    const mvps = Number(ps.mvps) || 0
    const played = Number(ps.played) || 0
    return (avgRating * 6) + (winRate * 0.5) + (Math.min(mvps, 10) * 1.2) + (Math.min(played, 20) * 0.15)
  }, [statsById])

  // ── Role penalty ──
  const getTeamRolePenalty = useCallback((teamIds) => {
    if (!teamIds?.length) return 0
    const coverage = { Portero: 0, Defensa: 0, Medio: 0, Delantero: 0 }
    let withoutPosition = 0

    teamIds.forEach(pid => {
      const pos = matchPositions[pid] || ''
      if (!pos) { withoutPosition += 1; return }
      const group = getPositionGroup(pos)
      if (coverage[group] !== undefined) coverage[group] += 1
    })

    const isComplete = teamIds.length === teamSize
    const mult = isComplete ? 1 : 0.55
    const weights = { Portero: 2.2, Defensa: 1.1, Medio: 0.9, Delantero: 0.6 }

    let penalty = 0
    Object.entries(weights).forEach(([role, w]) => {
      if (coverage[role] === 0) penalty += w * mult
    })
    penalty += Math.max((coverage.Portero || 0) - 1, 0) * 0.35
    penalty += withoutPosition * (isComplete ? 0.25 : 0.15)
    return penalty
  }, [matchPositions, teamSize])

  // ── Probability calculation ──
  const calculateTeamProbability = useCallback((match) => {
    if (!match || !stats.length) return { white: 50, black: 50 }
    const getTeamStats = (teamIds) => {
      const ts = teamIds?.map(pid => stats.find(s => s.id === pid)).filter(Boolean) || []
      if (ts.length === 0) return { avgWinRate: 50, avgRating: 5, avgMvps: 0, recentForm: 50 }
      const avgWinRate = ts.reduce((s, p) => s + (p.winRate || 50), 0) / ts.length
      const avgRating = ts.reduce((s, p) => s + (parseFloat(p.avgRating) || 5), 0) / ts.length
      const avgMvps = ts.reduce((s, p) => s + (p.mvps || 0), 0) / ts.length
      const recentWins = ts.reduce((total, player) => {
        const pm = matches.filter(m =>
          (m.winner === 'white' || m.winner === 'black') &&
          (m.teamWhite?.includes(player.id) || m.teamBlack?.includes(player.id)),
        ).slice(-5)
        const wins = pm.filter(m => {
          const inW = m.teamWhite?.includes(player.id)
          return (inW && m.winner === 'white') || (!inW && m.winner === 'black')
        }).length
        return total + (pm.length > 0 ? (wins / pm.length) * 100 : 50)
      }, 0) / ts.length
      return { avgWinRate, avgRating, avgMvps, recentForm: recentWins }
    }
    const ws = getTeamStats(match.teamWhite)
    const bs = getTeamStats(match.teamBlack)
    const score = (s) =>
      (s.avgWinRate * 0.35) +
      (s.avgRating * 3 * 0.30) +
      (Math.min(s.avgMvps, 5) * 6 * 0.15) +
      (s.recentForm * 0.20)
    const wScore = score(ws)
    const bScore = score(bs)
    const total = wScore + bScore
    let whitePct = total > 0 ? Math.round((wScore / total) * 100) : 50
    whitePct = Math.max(15, Math.min(85, whitePct))
    return { white: whitePct, black: 100 - whitePct, whiteStats: ws, blackStats: bs }
  }, [stats, matches])

  // ── Historical teammate/duel stats ──
  const historicalDraftLinks = useMemo(() => {
    const teammatePairs = {}
    const duelStats = {}
    const pairKey = (a, b) => [a, b].sort().join('__')
    const duelKey = (a, b) => `${a}__${b}`

    const addPair = (a, b, won) => {
      if (!a || !b) return
      const k = pairKey(a, b)
      if (!teammatePairs[k]) teammatePairs[k] = { games: 0, wins: 0 }
      teammatePairs[k].games += 1
      if (won) teammatePairs[k].wins += 1
    }
    const addDuel = (a, b, aWon) => {
      if (!a || !b) return
      const k = duelKey(a, b)
      if (!duelStats[k]) duelStats[k] = { games: 0, wins: 0 }
      duelStats[k].games += 1
      if (aWon) duelStats[k].wins += 1
    }

    matches.forEach(match => {
      const decided = match.winner === 'white' || match.winner === 'black'
      if (!decided) return
      const w = [...(match.teamWhite || [])]
      const b = [...(match.teamBlack || [])]
      const wWon = match.winner === 'white'
      const bWon = match.winner === 'black'
      for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) addPair(w[i], w[j], wWon)
      for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) addPair(b[i], b[j], bWon)
      w.forEach(wp => b.forEach(bp => { addDuel(wp, bp, wWon); addDuel(bp, wp, bWon) }))
    })
    return { teammatePairs, duelStats }
  }, [matches])

  // ── Auto-balance (improved: best-of-N with greedy seed) ──
  const buildGreedyTeams = useCallback((scoredPlayers, pinnedWhite, pinnedBlack) => {
    const nextWhite = [...pinnedWhite]
    const nextBlack = [...pinnedBlack]
    let wScore = pinnedWhite.reduce((s, e) => s + e.score, 0)
    let bScore = pinnedBlack.reduce((s, e) => s + e.score, 0)
    const locked = new Set([...pinnedWhite, ...pinnedBlack].map(e => e.playerId))

    const remaining = scoredPlayers.filter(e => !locked.has(e.playerId))
    remaining.forEach(entry => {
      if (nextWhite.length >= teamSize) { nextBlack.push(entry); bScore += entry.score; return }
      if (nextBlack.length >= teamSize) { nextWhite.push(entry); wScore += entry.score; return }

      const objW = Math.abs((wScore + entry.score) - bScore)
        + (getTeamRolePenalty([...nextWhite, entry].map(e => e.playerId)) + getTeamRolePenalty(nextBlack.map(e => e.playerId))) * 12
      const objB = Math.abs(wScore - (bScore + entry.score))
        + (getTeamRolePenalty(nextWhite.map(e => e.playerId)) + getTeamRolePenalty([...nextBlack, entry].map(e => e.playerId))) * 12

      if (objW <= objB) { nextWhite.push(entry); wScore += entry.score }
      else { nextBlack.push(entry); bScore += entry.score }
    })
    return { white: nextWhite, black: nextBlack, wScore, bScore }
  }, [teamSize, getTeamRolePenalty])

  const evaluateSplit = useCallback((whiteIds, blackIds) => {
    const wPower = whiteIds.reduce((s, pid) => s + getPlayerBalanceScore(pid), 0)
    const bPower = blackIds.reduce((s, pid) => s + getPlayerBalanceScore(pid), 0)
    const total = wPower + bPower
    const gapPct = total > 0 ? (Math.abs(wPower - bPower) / total) * 100 : 0
    const prob = calculateTeamProbability({ teamWhite: whiteIds, teamBlack: blackIds })
    const probGap = Math.abs((prob.white || 50) - (prob.black || 50))
    const rolePen = getTeamRolePenalty(whiteIds) + getTeamRolePenalty(blackIds)
    return 100 - (probGap * 0.95) - (gapPct * 0.7) - (rolePen * 6)
  }, [getPlayerBalanceScore, calculateTeamProbability, getTeamRolePenalty])

  const suggestBalancedTeams = useCallback(({ preserveLockedCaptains } = {}) => {
    const validIds = new Set(players.map(p => p.id))
    const pool = Array.from(new Set(selectedPlayers)).filter(id => validIds.has(id))
    const shouldPreserve = preserveLockedCaptains ?? preserveCaptains

    if (pool.length !== requiredPlayers) {
      showToast('error', `Selecciona exactamente ${requiredPlayers} jugadores antes de armar equipos`)
      return
    }
    if (shouldPreserve && lockedWhiteCaptain && lockedWhiteCaptain === lockedBlackCaptain) {
      showToast('error', 'No puedes bloquear el mismo capitán en ambos equipos')
      return
    }

    const scored = pool
      .map(pid => ({ playerId: pid, score: getPlayerBalanceScore(pid) }))
      .sort((a, b) => b.score - a.score || a.playerId.localeCompare(b.playerId))

    const pinnedW = []
    const pinnedB = []
    if (shouldPreserve && lockedWhiteCaptain && pool.includes(lockedWhiteCaptain)) {
      const e = scored.find(s => s.playerId === lockedWhiteCaptain)
      if (e) pinnedW.push(e)
    }
    if (shouldPreserve && lockedBlackCaptain && pool.includes(lockedBlackCaptain)) {
      const e = scored.find(s => s.playerId === lockedBlackCaptain)
      if (e) pinnedB.push(e)
    }

    // Greedy seed
    const greedy = buildGreedyTeams(scored, pinnedW, pinnedB)
    let bestWhiteIds = greedy.white.map(e => e.playerId)
    let bestBlackIds = greedy.black.map(e => e.playerId)
    let bestScore = evaluateSplit(bestWhiteIds, bestBlackIds)

    // Best-of-N random shuffles to explore better splits
    const lockedSet = new Set([...pinnedW, ...pinnedB].map(e => e.playerId))
    const unlocked = scored.filter(e => !lockedSet.has(e.playerId))

    for (let i = 0; i < BEST_OF_N_ITERATIONS; i++) {
      const shuffled = [...unlocked].sort(() => Math.random() - 0.5)
      const trial = buildGreedyTeams(shuffled, pinnedW, pinnedB)
      const trialWhite = trial.white.map(e => e.playerId)
      const trialBlack = trial.black.map(e => e.playerId)
      const trialScore = evaluateSplit(trialWhite, trialBlack)
      if (trialScore > bestScore) {
        bestScore = trialScore
        bestWhiteIds = trialWhite
        bestBlackIds = trialBlack
      }
    }

    const retained = { ...matchPositions }
    Object.keys(retained).forEach(pid => {
      if (!bestWhiteIds.includes(pid) && !bestBlackIds.includes(pid)) delete retained[pid]
    })

    // Auto-assign default positions for players without one
    bestWhiteIds.forEach(pid => {
      if (!retained[pid] && playerFrequentPositions[pid]) retained[pid] = playerFrequentPositions[pid]
    })
    bestBlackIds.forEach(pid => {
      if (!retained[pid] && playerFrequentPositions[pid]) retained[pid] = playerFrequentPositions[pid]
    })

    setTeamWhite(bestWhiteIds)
    setTeamBlack(bestBlackIds)
    setMatchPositions(retained)
    setWinner('')

    const diff = Math.abs(
      bestWhiteIds.reduce((s, id) => s + getPlayerBalanceScore(id), 0) -
      bestBlackIds.reduce((s, id) => s + getPlayerBalanceScore(id), 0),
    ).toFixed(1)
    const rolePenalty = (getTeamRolePenalty(bestWhiteIds) + getTeamRolePenalty(bestBlackIds)).toFixed(2)
    const lockTag = shouldPreserve ? ' · capitanes bloqueados' : ''
    showToast('success', `Equipos sugeridos (${BEST_OF_N_ITERATIONS} combinaciones)${lockTag} · diff ${diff} · roles ${rolePenalty}`)
  }, [
    players, selectedPlayers, requiredPlayers, teamSize,
    preserveCaptains, lockedWhiteCaptain, lockedBlackCaptain,
    getPlayerBalanceScore, getTeamRolePenalty, matchPositions,
    buildGreedyTeams, evaluateSplit, playerFrequentPositions, showToast,
  ])

  // ── Live draft insights (teams summary, no swaps) ──
  const liveDraftBase = useMemo(() => {
    const roles = ['Portero', 'Defensa', 'Medio', 'Delantero']
    const assignedCount = teamWhite.length + teamBlack.length
    const unassignedCount = Math.max(selectedPlayers.length - assignedCount, 0)

    const summarizeTeam = (teamIds) => {
      const count = teamIds.length
      const metrics = teamIds.map(pid => {
        const ps = statsById[pid] || {}
        return {
          winRate: Number(ps.winRate) || 50,
          avgRating: parseFloat(ps.avgRating) || 5,
          mvps: Number(ps.mvps) || 0,
          played: Number(ps.played) || 0,
          ties: Number(ps.ties) || 0,
          power: getPlayerBalanceScore(pid),
        }
      })
      const avg = (field, fb = 0) => count === 0 ? fb : metrics.reduce((s, m) => s + m[field], 0) / count

      const coverage = { Portero: 0, Defensa: 0, Medio: 0, Delantero: 0 }
      let withoutPosition = 0
      teamIds.forEach(pid => {
        const pos = matchPositions[pid] || ''
        if (!pos) { withoutPosition += 1; return }
        const g = getPositionGroup(pos)
        if (coverage[g] !== undefined) coverage[g] += 1
      })

      let chemWins = 0, chemGames = 0, knownPairs = 0
      for (let i = 0; i < teamIds.length; i++)
        for (let j = i + 1; j < teamIds.length; j++) {
          const k = [teamIds[i], teamIds[j]].sort().join('__')
          const ps = historicalDraftLinks.teammatePairs[k]
          if (ps?.games) { knownPairs++; chemWins += ps.wins; chemGames += ps.games }
        }

      return {
        count,
        avgWinRate: avg('winRate', 50),
        avgRating: avg('avgRating', 5),
        avgMvps: avg('mvps', 0),
        avgPlayed: avg('played', 0),
        avgTies: avg('ties', 0),
        power: metrics.reduce((s, m) => s + m.power, 0),
        coverage,
        missingRoles: roles.filter(r => coverage[r] === 0),
        withoutPosition,
        chemistry: {
          score: chemGames > 0 ? (chemWins / chemGames) * 100 : 50,
          knownPairs,
          totalPairs: Math.max((count * (count - 1)) / 2, 0),
          games: chemGames,
        },
      }
    }

    const white = summarizeTeam(teamWhite)
    const black = summarizeTeam(teamBlack)
    const probability = calculateTeamProbability({ teamWhite, teamBlack })
    const probabilityGap = Math.abs((probability.white || 50) - (probability.black || 50))
    const totalPower = white.power + black.power
    const powerGap = Math.abs(white.power - black.power)
    const powerGapPct = totalPower > 0 ? (powerGap / totalPower) * 100 : 0
    const rolePenalty = getTeamRolePenalty(teamWhite) + getTeamRolePenalty(teamBlack)
    const completionPct = requiredPlayers > 0 ? Math.min(100, (selectedPlayers.length / requiredPlayers) * 100) : 0
    const assignmentPct = requiredPlayers > 0 ? Math.min(100, (assignedCount / requiredPlayers) * 100) : 0
    const completionFactor = 0.55 + 0.45 * (assignmentPct / 100)
    const rawScore = 100 - (probabilityGap * 0.95) - (powerGapPct * 0.7) - (rolePenalty * 6)
    const balanceScore = Math.max(0, Math.min(100, Math.round(rawScore * completionFactor)))

    const getBalanceBand = (s) => {
      if (s >= 80) return { label: 'Parejo', tone: 'good' }
      if (s >= 65) return { label: 'Aceptable', tone: 'medium' }
      return { label: 'Desbalanceado', tone: 'bad' }
    }

    const duo = { whiteWins: 0, blackWins: 0, games: 0, knownDuels: 0 }
    teamWhite.forEach(wp => {
      teamBlack.forEach(bp => {
        const wk = `${wp}__${bp}`
        const bk = `${bp}__${wp}`
        const wd = historicalDraftLinks.duelStats[wk]
        const bd = historicalDraftLinks.duelStats[bk]
        const dg = Math.max(wd?.games || 0, bd?.games || 0)
        if (dg > 0) duo.knownDuels += 1
        duo.whiteWins += wd?.wins || 0
        duo.blackWins += bd?.wins || 0
        duo.games += dg
      })
    })
    const duelTotal = duo.whiteWins + duo.blackWins
    const whiteDuelPct = duelTotal > 0 ? (duo.whiteWins / duelTotal) * 100 : 50

    const alerts = []
    if (selectedPlayers.length < requiredPlayers)
      alerts.push({ tone: 'info', text: `Faltan ${requiredPlayers - selectedPlayers.length} jugadores por seleccionar.` })
    if (selectedPlayers.length === requiredPlayers && unassignedCount > 0)
      alerts.push({ tone: 'warning', text: `Hay ${unassignedCount} jugadores seleccionados sin equipo.` })
    if (teamWhite.length === teamSize && white.missingRoles.includes('Portero'))
      alerts.push({ tone: 'warning', text: 'Equipo blanco sin Portero asignado.' })
    if (teamBlack.length === teamSize && black.missingRoles.includes('Portero'))
      alerts.push({ tone: 'warning', text: 'Equipo negro sin Portero asignado.' })
    if (teamWhite.length === teamSize && teamBlack.length === teamSize && probabilityGap >= 20)
      alerts.push({ tone: 'danger', text: `Ventaja marcada del equipo ${probability.white > probability.black ? 'blanco' : 'negro'} (${Math.max(probability.white, probability.black)}%).` })
    if (teamWhite.length === teamSize && teamBlack.length === teamSize && balanceScore < 65)
      alerts.push({ tone: 'danger', text: 'El balance general está bajo; revisa cambios o aplica un swap sugerido.' })
    if (rolePenalty >= 2)
      alerts.push({ tone: 'warning', text: 'Las posiciones están afectando el balance. Ajusta roles o usa un swap.' })
    if (duo.knownDuels > 0 && teamWhite.length > 0 && teamBlack.length > 0)
      alerts.push({ tone: 'info', text: `Historial entre equipos: ${whiteDuelPct.toFixed(0)}% para blanco en duelos previos.` })

    return {
      white, black, probability, probabilityGap, powerGapPct, rolePenalty,
      balanceScore, balanceBand: getBalanceBand(balanceScore),
      completionPct, assignmentPct, assignedCount, unassignedCount,
      duelStats: { knownDuels: duo.knownDuels, games: duo.games, whitePct: whiteDuelPct },
      alerts,
    }
  }, [
    teamWhite, teamBlack, selectedPlayers, teamSize, requiredPlayers,
    statsById, matchPositions, getPlayerBalanceScore, getTeamRolePenalty,
    historicalDraftLinks, calculateTeamProbability,
  ])

  // ── Swap suggestions (separated for performance) ──
  const swapSuggestions = useMemo(() => {
    if (teamWhite.length !== teamSize || teamBlack.length !== teamSize) return []

    const baseline = evaluateSplit(teamWhite, teamBlack)
    const suggestions = []
    teamWhite.forEach(wOut => {
      teamBlack.forEach(bOut => {
        const nw = teamWhite.map(id => (id === wOut ? bOut : id))
        const nb = teamBlack.map(id => (id === bOut ? wOut : id))
        const candidate = evaluateSplit(nw, nb)
        const improvement = candidate - baseline
        if (improvement > 0.5) {
          const prob = calculateTeamProbability({ teamWhite: nw, teamBlack: nb })
          suggestions.push({
            whiteOut: wOut, blackOut: bOut, improvement,
            nextBalance: Math.max(0, Math.min(100, Math.round(candidate))),
            nextWhiteProb: prob.white || 50, nextBlackProb: prob.black || 50,
          })
        }
      })
    })
    suggestions.sort((a, b) => b.improvement - a.improvement || b.nextBalance - a.nextBalance)
    return suggestions.slice(0, 3)
  }, [teamWhite, teamBlack, teamSize, evaluateSplit, calculateTeamProbability])

  const liveDraftInsights = useMemo(() => ({
    ...liveDraftBase,
    swapSuggestions,
  }), [liveDraftBase, swapSuggestions])

  // ── Apply swap ──
  const applySwapSuggestion = useCallback((whiteOut, blackOut) => {
    setTeamWhite(c => c.map(id => (id === whiteOut ? blackOut : id)))
    setTeamBlack(c => c.map(id => (id === blackOut ? whiteOut : id)))
    setWinner('')
    showToast('success', `Cambio aplicado: ${getPlayerName(whiteOut)} ↔ ${getPlayerName(blackOut)}`)
  }, [getPlayerName, showToast])

  // ── TV Board ──
  const inferPositionFromBoard = useCallback((x, y, team) => {
    const safeY = clamp(y, 0, 100)
    if (team === 'white') {
      if (x <= 14) return 'portero'
      if (x <= 27) {
        if (safeY < 35) return 'lateral_izq'
        if (safeY > 65) return 'lateral_der'
        return 'cierre'
      }
      if (x <= 40) { return (safeY < 38 || safeY > 62) ? 'medio' : 'pivote' }
      return 'delantero'
    }
    if (x >= 86) return 'portero'
    if (x >= 73) {
      if (safeY < 35) return 'lateral_izq'
      if (safeY > 65) return 'lateral_der'
      return 'cierre'
    }
    if (x >= 60) { return (safeY < 38 || safeY > 62) ? 'medio' : 'pivote' }
    return 'delantero'
  }, [])

  const ensureTvBoardLayout = useCallback((baseLayout = {}) => {
    const next = {}
    const getLine = (pos) => {
      if (pos === 'portero') return 'gk'
      if (pos === 'cierre' || pos === 'lateral_izq' || pos === 'lateral_der') return 'def'
      if (pos === 'delantero') return 'att'
      return 'mid'
    }
    const lineX = {
      white: { gk: 9, def: 22, mid: 34, att: 44 },
      black: { gk: 91, def: 78, mid: 66, att: 56 },
    }
    const build = (ids, team) => {
      const lines = { gk: [], def: [], mid: [], att: [] }
      ids.forEach(pid => lines[getLine(matchPositions[pid] || '')].push(pid))
      const minX = team === 'white' ? 4 : 52
      const maxX = team === 'white' ? 48 : 96
      ;['gk', 'def', 'mid', 'att'].forEach(line => {
        lines[line].forEach((pid, idx) => {
          const existing = baseLayout[pid]
          if (existing) { next[pid] = { x: clamp(existing.x, minX, maxX), y: clamp(existing.y, 6, 94) }; return }
          const total = lines[line].length
          const y = total <= 1 ? 50 : ((idx + 1) / (total + 1)) * 100
          next[pid] = { x: lineX[team][line], y: clamp(y, 8, 92) }
        })
      })
    }
    build(teamWhite, 'white')
    build(teamBlack, 'black')
    return next
  }, [teamWhite, teamBlack, matchPositions])

  const getTvPlayerTeam = useCallback((pid) => {
    if (teamWhite.includes(pid)) return 'white'
    if (teamBlack.includes(pid)) return 'black'
    return ''
  }, [teamWhite, teamBlack])

  const moveTvPlayerToPitch = useCallback((pid, pitchX, pitchY) => {
    const team = getTvPlayerTeam(pid)
    if (!team) return false
    const sx = clamp(pitchX, 2, 98)
    const sy = clamp(pitchY, 4, 96)
    const gx = team === 'white' ? clamp(sx, 4, 48) : clamp(sx, 52, 96)
    setTvBoardLayout(prev => ({ ...prev, [pid]: { x: gx, y: sy } }))
    const nextPos = inferPositionFromBoard(gx, sy, team)
    setMatchPositions(prev => (prev[pid] === nextPos ? prev : { ...prev, [pid]: nextPos }))
    return true
  }, [getTvPlayerTeam, inferPositionFromBoard])

  const updateTvPlayerByPoint = useCallback((pid, clientX, clientY, offX = 0, offY = 0) => {
    const rect = tvPitchRef.current?.getBoundingClientRect()
    if (!rect) return false
    const px = ((clientX - offX - rect.left) / rect.width) * 100
    const py = ((clientY - offY - rect.top) / rect.height) * 100
    return moveTvPlayerToPitch(pid, px, py)
  }, [moveTvPlayerToPitch])

  const finishTvPointerDrag = useCallback((event = null, options = {}) => {
    const { commit = true } = options
    const ds = tvPointerDragRef.current
    if (!ds.playerId) return
    if (event && ds.pointerId !== null && ds.pointerId !== event.pointerId) return
    if (commit && event && ds.dragStarted) updateTvPlayerByPoint(ds.playerId, event.clientX, event.clientY, ds.offsetX, ds.offsetY)
    if (ds.releaseTarget?.hasPointerCapture?.(ds.pointerId)) ds.releaseTarget.releasePointerCapture(ds.pointerId)
    if (ds.dragStarted) { tvLastDragAtRef.current = Date.now(); setWinner('') }
    tvPointerDragRef.current = { ...EMPTY_POINTER_STATE }
    setDraggingTvPlayerId('')
    setTvDragTeam('')
  }, [updateTvPlayerByPoint])

  const handleTvPointerDown = useCallback((event, pid) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const team = getTvPlayerTeam(pid)
    if (!team) return
    event.preventDefault()
    event.stopPropagation()
    const r = event.currentTarget.getBoundingClientRect()
    tvPointerDragRef.current = {
      playerId: pid, pointerId: event.pointerId,
      offsetX: event.clientX - (r.left + r.width / 2),
      offsetY: event.clientY - (r.top + r.height / 2),
      startClientX: event.clientX, startClientY: event.clientY,
      dragStarted: false, releaseTarget: event.currentTarget,
    }
    setSelectedTvPlayerId(pid)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [getTvPlayerTeam])

  const handleTvPitchPointerDown = useCallback((event) => {
    if (!selectedTvPlayerId) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.target.closest('.tv-player-chip')) return
    event.preventDefault()
    const moved = updateTvPlayerByPoint(selectedTvPlayerId, event.clientX, event.clientY)
    if (moved) { setWinner(''); tvLastDragAtRef.current = Date.now() }
  }, [selectedTvPlayerId, updateTvPlayerByPoint])

  const openTvBoard = useCallback(async () => {
    setTvBoardLayout(prev => ensureTvBoardLayout(prev))
    setShowTvBoard(true)
    try { if (!document.fullscreenElement && document.documentElement?.requestFullscreen) await document.documentElement.requestFullscreen() } catch { /* */ }
  }, [ensureTvBoardLayout])

  const closeTvBoard = useCallback(async () => {
    setShowTvBoard(false)
    setDraggingTvPlayerId('')
    setTvDragTeam('')
    setSelectedTvPlayerId('')
    tvPointerDragRef.current = { ...EMPTY_POINTER_STATE }
    try { if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen() } catch { /* */ }
  }, [])

  const resetTvBoardLayout = useCallback(() => {
    setTvBoardLayout(ensureTvBoardLayout({}))
  }, [ensureTvBoardLayout])

  const handleTvOverlayClick = useCallback(() => {
    if (tvPointerDragRef.current.playerId) return
    if (Date.now() - tvLastDragAtRef.current < 220) return
    closeTvBoard()
  }, [closeTvBoard])

  // TV pointer move/up effect
  useEffect(() => {
    if (!showTvBoard) return undefined
    const DRAG_DIST = 5
    const onMove = event => {
      const ds = tvPointerDragRef.current
      if (!ds.playerId) return
      if (ds.pointerId !== null && ds.pointerId !== event.pointerId) return
      if (!ds.dragStarted) {
        const d = Math.hypot(event.clientX - ds.startClientX, event.clientY - ds.startClientY)
        if (d < DRAG_DIST) return
        ds.dragStarted = true
        tvPointerDragRef.current = { ...ds }
        setDraggingTvPlayerId(ds.playerId)
        setTvDragTeam(getTvPlayerTeam(ds.playerId))
      }
      event.preventDefault()
      updateTvPlayerByPoint(ds.playerId, event.clientX, event.clientY, ds.offsetX, ds.offsetY)
    }
    const onUp = event => {
      const ds = tvPointerDragRef.current
      if (!ds.playerId) return
      if (ds.pointerId !== null && ds.pointerId !== event.pointerId) return
      if (!ds.dragStarted) { setSelectedTvPlayerId(ds.playerId); finishTvPointerDrag(event, { commit: false }); return }
      finishTvPointerDrag(event, { commit: true })
    }
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp) }
  }, [showTvBoard, finishTvPointerDrag, getTvPlayerTeam, updateTvPlayerByPoint])

  const tvBoardPlayers = useMemo(() => {
    const base = ensureTvBoardLayout(tvBoardLayout)
    const wPlayers = teamWhite.map(pid => ({ playerId: pid, team: 'white', x: base[pid]?.x ?? 20, y: base[pid]?.y ?? 50, position: matchPositions[pid] || '' }))
    const bPlayers = teamBlack.map(pid => ({ playerId: pid, team: 'black', x: base[pid]?.x ?? 80, y: base[pid]?.y ?? 50, position: matchPositions[pid] || '' }))
    return [...wPlayers, ...bPlayers]
  }, [ensureTvBoardLayout, tvBoardLayout, teamWhite, teamBlack, matchPositions])

  // ── Poll: generate 3 options ──
  const generatePollOptions = useCallback(() => {
    if (selectedPlayers.length !== requiredPlayers) {
      showToast('error', `Selecciona ${requiredPlayers} jugadores primero`)
      return null
    }

    const validIds = new Set(players.map(p => p.id))
    const pool = Array.from(new Set(selectedPlayers)).filter(id => validIds.has(id))
    const scored = pool.map(pid => ({ playerId: pid, score: getPlayerBalanceScore(pid) }))

    const pinnedW = []
    const pinnedB = []

    const generateOne = () => {
      const shuffled = [...scored].sort(() => Math.random() - 0.5)
      const result = buildGreedyTeams(shuffled, pinnedW, pinnedB)
      const wIds = result.white.map(e => e.playerId)
      const bIds = result.black.map(e => e.playerId)
      const balance = evaluateSplit(wIds, bIds)
      const prob = calculateTeamProbability({ teamWhite: wIds, teamBlack: bIds })

      const positions = {}
      wIds.forEach(pid => { if (playerFrequentPositions[pid]) positions[pid] = playerFrequentPositions[pid] })
      bIds.forEach(pid => { if (playerFrequentPositions[pid]) positions[pid] = playerFrequentPositions[pid] })

      return {
        teamWhite: wIds,
        teamBlack: bIds,
        positions,
        balanceScore: Math.max(0, Math.min(100, Math.round(balance))),
        probability: { white: prob.white || 50, black: prob.black || 50 },
        votes: 0,
        label: '',
      }
    }

    const options = []
    const seen = new Set()
    let attempts = 0
    while (options.length < 3 && attempts < 120) {
      attempts++
      const opt = generateOne()
      const key = [...opt.teamWhite].sort().join(',')
      if (!seen.has(key)) {
        seen.add(key)
        options.push(opt)
      }
    }

    while (options.length < 3) options.push(generateOne())
    options.sort((a, b) => b.balanceScore - a.balanceScore)

    return options
  }, [
    selectedPlayers, requiredPlayers, players, getPlayerBalanceScore,
    buildGreedyTeams, evaluateSplit, calculateTeamProbability,
    playerFrequentPositions, showToast,
  ])

  const createTeamPoll = useCallback(async (options) => {
    if (!options || options.length === 0) return null

    const playerNames = {}
    players.forEach(p => { playerNames[p.id] = p.name })

    const pollId = `poll_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const pollData = {
      type: 'teamPoll',
      title: `Partido ${matchFormat} — ¿Cuál armado prefieres?`,
      matchDate: matchDate || '',
      matchTime: matchTime || '',
      matchVenue: matchVenue || 'LUKTO',
      matchFormat,
      teamSize,
      options,
      playerNames,
      totalVotes: 0,
      createdAt: new Date().toISOString(),
    }

    try {
      await setDoc(doc(db, 'matches', pollId), pollData)
      return pollId
    } catch (e) {
      console.error('Error creating poll:', e)
      showToast('error', 'Error al crear la encuesta. Verifica que estés logueado.')
      return null
    }
  }, [players, matchFormat, matchDate, matchTime, matchVenue, teamSize, showToast])

  // ── Save match (with loading state + error handling) ──
  const handleAddMatch = useCallback(async () => {
    if (!matchDate) { showToast('error', 'Completa la fecha del partido'); return }
    if (selectedPlayers.length !== requiredPlayers) { showToast('error', `Debes seleccionar ${requiredPlayers} jugadores para un partido ${teamSize} vs ${teamSize}`); return }
    if (teamWhite.length !== teamSize || teamBlack.length !== teamSize) { showToast('error', `Cada equipo debe tener exactamente ${teamSize} jugadores`); return }

    const selectedSet = new Set(selectedPlayers)
    const assigned = [...teamWhite, ...teamBlack]
    const assignedSet = new Set(assigned)
    if (assignedSet.size !== requiredPlayers || !assigned.every(pid => selectedSet.has(pid))) {
      showToast('error', 'Los equipos deben incluir a todos los jugadores seleccionados sin repetir'); return
    }

    const nScoreW = scoreWhite === '' ? null : Number(scoreWhite)
    const nScoreB = scoreBlack === '' ? null : Number(scoreBlack)
    const hasScore = nScoreW !== null || nScoreB !== null
    if (hasScore && (nScoreW === null || nScoreB === null)) { showToast('error', 'Si registras marcador, completa ambos goles'); return }
    if (hasScore) {
      const invalid = !Number.isInteger(nScoreW) || !Number.isInteger(nScoreB) || nScoreW < 0 || nScoreB < 0 || nScoreW > 30 || nScoreB > 30
      if (invalid) { showToast('error', 'Marcador inválido. Usa enteros entre 0 y 30'); return }
    }

    const winnerByScore = hasScore ? (nScoreW === nScoreB ? 'tie' : nScoreW > nScoreB ? 'white' : 'black') : ''
    if (winner && winnerByScore && winner !== winnerByScore) { showToast('error', 'El ganador no coincide con el marcador registrado'); return }
    const resolvedWinner = winnerByScore || winner

    const matchData = {
      date: matchDate, time: matchTime || '', venue: matchVenue,
      matchFormat, teamSize,
      playerPool: [...selectedPlayers],
      captains: { white: lockedWhiteCaptain || '', black: lockedBlackCaptain || '' },
      teamWhite: [...teamWhite], teamBlack: [...teamBlack],
      positions: { ...matchPositions },
      scoreWhite: hasScore ? nScoreW : null, scoreBlack: hasScore ? nScoreB : null,
      winner: resolvedWinner, ratingsOpen: true,
    }

    setSaving(true)
    try {
      if (editingMatchId) {
        const prevMatch = matches.find(m => m.id === editingMatchId)
        await updateDoc(doc(db, 'matches', editingMatchId), matchData)
        await logActivity('match_edit', { matchId: editingMatchId, before: prevMatch, after: matchData })
      } else {
        const newMatchId = Date.now().toString()
        await setDoc(doc(db, 'matches', newMatchId), matchData)
        await logActivity('match_create', { matchId: newMatchId, matchDate: matchData.date, venue: matchData.venue })
      }
      resetMatchForm()
      return true
    } catch (error) {
      console.error('Error saving match:', error)
      showToast('error', 'Error al guardar el partido. Intenta de nuevo.')
      return false
    } finally {
      setSaving(false)
    }
  }, [
    matchDate, matchTime, matchVenue, matchFormat, teamSize,
    selectedPlayers, requiredPlayers, teamWhite, teamBlack,
    matchPositions, scoreWhite, scoreBlack, winner,
    lockedWhiteCaptain, lockedBlackCaptain, editingMatchId,
    matches, showToast, logActivity,
  ])

  // ── Reset form ──
  const resetMatchForm = useCallback(() => {
    setShowTvBoard(false)
    setTvBoardLayout({})
    setDraggingTvPlayerId('')
    setTvDragTeam('')
    setMatchDate('')
    setMatchTime('')
    setMatchVenue('LUKTO')
    setMatchFormat('6v6')
    setSelectedPlayers([])
    setScoreWhite('')
    setScoreBlack('')
    setPreserveCaptains(false)
    setLockedWhiteCaptain('')
    setLockedBlackCaptain('')
    setTeamWhite([])
    setTeamBlack([])
    setMatchPositions({})
    setWinner('')
    setEditingMatchId(null)
    setPoolSearch('')
  }, [])

  // ── Open edit match ──
  const openEditMatch = useCallback((match) => {
    const inferredTeamSize = Number(match.teamSize) || Math.max(match.teamWhite?.length || 0, match.teamBlack?.length || 0, 6)
    const nextFormat = match.matchFormat || (inferredTeamSize >= 7 ? '7v7' : '6v6')
    const nextTeamSize = nextFormat === '7v7' ? 7 : 6
    const nextRequired = nextTeamSize * 2
    const matchPool = Array.from(new Set([...(match.playerPool || []), ...(match.teamWhite || []), ...(match.teamBlack || [])]))
    const normalized = matchPool.slice(0, nextRequired)
    const allowed = new Set(normalized)

    setMatchDate(match.date)
    setMatchTime(match.time || '')
    setMatchVenue(match.venue)
    setMatchFormat(nextFormat)
    setSelectedPlayers(normalized)
    setScoreWhite(match.scoreWhite === null || match.scoreWhite === undefined ? '' : String(match.scoreWhite))
    setScoreBlack(match.scoreBlack === null || match.scoreBlack === undefined ? '' : String(match.scoreBlack))
    setPreserveCaptains(!!(match.captains?.white || match.captains?.black))
    setLockedWhiteCaptain(allowed.has(match.captains?.white) ? match.captains.white : '')
    setLockedBlackCaptain(allowed.has(match.captains?.black) ? match.captains.black : '')
    setTeamWhite([...(match.teamWhite || [])].filter(id => allowed.has(id)).slice(0, nextTeamSize))
    setTeamBlack([...(match.teamBlack || [])].filter(id => allowed.has(id)).slice(0, nextTeamSize))
    setMatchPositions(() => {
      const n = {}
      Object.entries(match.positions || {}).forEach(([pid, pos]) => { if (allowed.has(pid)) n[pid] = pos })
      return n
    })
    setWinner(match.winner || '')
    setEditingMatchId(match.id)
    setPoolSearch('')
  }, [])

  return {
    // Constants
    POSITION_OPTIONS,
    MATCH_FORMAT_OPTIONS,
    getPositionLabel,

    // Form state
    matchDate, setMatchDate,
    matchTime, setMatchTime,
    matchVenue, setMatchVenue,
    matchFormat,
    selectedPlayers,
    scoreWhite, setScoreWhite,
    scoreBlack, setScoreBlack,
    preserveCaptains, setPreserveCaptains,
    lockedWhiteCaptain, lockedBlackCaptain,
    teamWhite, teamBlack,
    matchPositions, setMatchPositions,
    winner, setWinner,
    editingMatchId,
    saving,

    // Pool search
    poolSearch, setPoolSearch,
    filteredPoolPlayers,

    // Derived
    teamSize, requiredPlayers,

    // Handlers
    handleMatchFormatChange,
    handlePoolPlayerToggle,
    handlePlayerToggle,
    clearSelectedPlayers,
    clearCurrentTeams,
    handleWhiteCaptainChange,
    handleBlackCaptainChange,
    suggestBalancedTeams,
    applySwapSuggestion,
    handleAddMatch,
    resetMatchForm,
    openEditMatch,

    // Insights
    liveDraftInsights,

    // Presets
    loadPresets,
    savePreset,
    applyPreset,
    deletePreset,

    // TV Board
    showTvBoard,
    tvPitchRef,
    tvBoardPlayers,
    draggingTvPlayerId,
    tvDragTeam,
    selectedTvPlayerId,
    setSelectedTvPlayerId,
    openTvBoard,
    closeTvBoard,
    resetTvBoardLayout,
    handleTvPointerDown,
    handleTvPitchPointerDown,
    handleTvOverlayClick,

    // Poll generation
    generatePollOptions,
    createTeamPoll,

    // Shared utils (for App.jsx positionAnalytics etc.)
    calculateTeamProbability,
    getPositionGroup,
  }
}
