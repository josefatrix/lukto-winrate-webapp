/** Pure roster validation shared by the builder and its regression tests. */
export const getActivePlayerIds = players =>
  new Set((players || []).filter(player => !player.archived).map(player => player.id))

export const sanitizeBuilderRoster = (source = {}, activePlayerIds = new Set(), teamSize = 0) => {
  const requiredPlayers = Math.max(0, teamSize * 2)
  const seen = new Set()
  let removedIds = 0
  const selectedPlayers = []

  for (const id of source.selectedPlayers || []) {
    if (!activePlayerIds.has(id)) {
      removedIds += 1
      continue
    }
    if (seen.has(id)) continue
    seen.add(id)
    if (!requiredPlayers || selectedPlayers.length < requiredPlayers) selectedPlayers.push(id)
  }

  const allowed = new Set(selectedPlayers)
  const teamWhite = (source.teamWhite || []).filter(id => allowed.has(id)).slice(0, teamSize)
  const teamBlack = (source.teamBlack || [])
    .filter(id => allowed.has(id) && !teamWhite.includes(id))
    .slice(0, teamSize)

  return {
    selectedPlayers,
    teamWhite,
    teamBlack,
    matchPositions: Object.fromEntries(
      Object.entries(source.matchPositions || {}).filter(([pid]) => allowed.has(pid))
    ),
    lockedWhiteCaptain: allowed.has(source.lockedWhiteCaptain) ? source.lockedWhiteCaptain : '',
    lockedBlackCaptain: allowed.has(source.lockedBlackCaptain) ? source.lockedBlackCaptain : '',
    removedIds,
  }
}
