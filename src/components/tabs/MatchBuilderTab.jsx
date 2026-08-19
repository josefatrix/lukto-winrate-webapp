import { useState, useMemo, useCallback, useEffect } from 'react'
import { useApp } from '../../contexts'
import { AppIcon } from '../common'
import { getPositionLabel } from '../../utils/matchConstants'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'

/* Position pills — short labels for quick assignment */
const POSITION_PILLS = [
  { value: 'portero',     short: 'GK' },
  { value: 'cierre',      short: 'DF' },
  { value: 'lateral_izq', short: 'LI' },
  { value: 'lateral_der', short: 'LD' },
  { value: 'medio',       short: 'MC' },
  { value: 'pivote',      short: 'PV' },
  { value: 'delantero',   short: 'DC' },
]

/* Chemistry below this many known pairs is mostly the 50% fallback, not data */
const MIN_CHEMISTRY_PAIRS = 3

const WEEKDAY_FMT = { weekday: 'long', day: 'numeric', month: 'short' }

function formatDateLabel(dateStr) {
  try {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('es-ES', WEEKDAY_FMT)
  } catch {
    return dateStr
  }
}

/* "HOY" / "MAÑANA" / "JUEVES, 13 AGO" — how you'd say it in the group chat */
function relativeDayLabel(dateStr) {
  if (!dateStr) return ''
  const target = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(target.getTime())) return ''
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days = Math.round((target - today) / 86400000)
  if (days === 0) return 'HOY'
  if (days === 1) return 'MAÑANA'
  return target.toLocaleDateString('es-ES', WEEKDAY_FMT).toUpperCase()
}

/* "20:00" → "8pm", "20:30" → "8:30pm" */
function shortTime(time) {
  if (!time) return ''
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 || 12
  return m ? `${hour12}:${String(m).padStart(2, '0')}${suffix}` : `${hour12}${suffix}`
}

/* WhatsApp-ready roster:
 *
 *   Lista lukto HOY 8pm confamiliar norte:
 *
 *   ⚪ Blanco
 *
 *   * Gabo
 *   ...
 */
function buildTeamListMessage({ matchDate, matchTime, matchVenue, teamWhite, teamBlack, getPlayerName }) {
  const head = ['Lista lukto']
  const day = relativeDayLabel(matchDate)
  if (day) head.push(day)
  const time = shortTime(matchTime)
  if (time) head.push(time)
  const venue = (matchVenue || '').trim()
  // "lukto" is already in the prefix — don't say it twice
  if (venue && venue.toLowerCase() !== 'lukto') head.push(venue)

  const roster = ids => ids.map(id => `* ${getPlayerName(id)}`).join('\n')

  return [
    `${head.join(' ')}:`,
    '',
    '⚪ Blanco',
    '',
    roster(teamWhite),
    '',
    '⬛️ Negro',
    '',
    roster(teamBlack),
  ].join('\n')
}

export function MatchBuilderTab({ mb }) {
  const { getPlayerName, setActiveTab, teamPolls, showToast } = useApp()

  const [presetName, setPresetName] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false)
  const [poolOpen, setPoolOpen] = useState(true)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [resultOpen, setResultOpen] = useState(false)
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [showListPreview, setShowListPreview] = useState(false)
  const [copiedList, setCopiedList] = useState(false)

  // Poll state
  const [pollOptions, setPollOptions] = useState(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollLink, setPollLink] = useState('')
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const presets = mb.loadPresets()
  const insights = mb.liveDraftInsights
  const powerMap = mb.playerPowerMap

  const poolReady = mb.selectedPlayers.length === mb.requiredPlayers
  const teamsReady = mb.teamWhite.length === mb.teamSize && mb.teamBlack.length === mb.teamSize
  const canSave = mb.matchDate && poolReady && teamsReady
  const hasResult = !!mb.winner || mb.scoreWhite !== '' || mb.scoreBlack !== ''
  const formIsEmpty = mb.selectedPlayers.length === 0 && !mb.matchDate

  /* An existing result should be visible the moment you open the match to edit it */
  useEffect(() => {
    if (hasResult) setResultOpen(true)
  }, [hasResult])

  const handlePoolToggle = useCallback(() => setPoolOpen(o => !o), [])
  const handlePoolPlayerToggle = useCallback((pid) => {
    mb.handlePoolPlayerToggle(pid)
  }, [mb])

  const handleSave = async () => {
    const ok = await mb.handleAddMatch()
    if (ok) setActiveTab('matches')
  }

  const handleSavePreset = () => {
    if (!presetName.trim()) return
    mb.savePreset(presetName.trim())
    setPresetName('')
    setShowPresets(false)
  }

  /* Clearing the pool wipes teams, positions, captains and result too */
  const handleClearPool = useCallback(() => {
    if (!confirm('Se borrará la convocatoria completa, los equipos, las posiciones y el resultado. ¿Continuar?')) return
    mb.clearSelectedPlayers()
  }, [mb])

  /* Enter in the search box calls up the first match — 12 players without leaving the keyboard */
  const handleSearchKeyDown = useCallback((e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const next = mb.filteredPoolPlayers.find(p => !mb.selectedPlayers.includes(p.id))
    if (!next || mb.selectedPlayers.length >= mb.requiredPlayers) return
    mb.handlePoolPlayerToggle(next.id)
    mb.setPoolSearch('')
  }, [mb])

  /* Shareable roster — regenerated whenever the teams or the schedule change */
  const teamListMessage = useMemo(() => buildTeamListMessage({
    matchDate: mb.matchDate,
    matchTime: mb.matchTime,
    matchVenue: mb.matchVenue,
    teamWhite: mb.teamWhite,
    teamBlack: mb.teamBlack,
    getPlayerName,
  }), [mb.matchDate, mb.matchTime, mb.matchVenue, mb.teamWhite, mb.teamBlack, getPlayerName])

  const handleCopyList = useCallback(async () => {
    const succeed = () => {
      setCopiedList(true)
      setTimeout(() => setCopiedList(false), 2000)
    }
    try {
      await navigator.clipboard.writeText(teamListMessage)
      succeed()
      return
    } catch {
      /* Async clipboard unavailable (older iOS Safari, unfocused document) */
    }
    // Legacy fallback — still the only path that works on some mobile browsers
    try {
      const textarea = document.createElement('textarea')
      textarea.value = teamListMessage
      textarea.setAttribute('readonly', '')
      textarea.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(textarea)
      textarea.select()
      textarea.setSelectionRange(0, teamListMessage.length)
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) {
        succeed()
        return
      }
    } catch {
      /* Fall through to manual selection */
    }
    // Last resort: show the text so it can be selected by hand
    setShowListPreview(true)
    showToast('error', 'No se pudo copiar automáticamente. Selecciona el texto de abajo.')
  }, [teamListMessage, showToast])

  const handleShareListWhatsApp = useCallback(() => {
    window.open(`https://wa.me/?text=${encodeURIComponent(teamListMessage)}`, '_blank')
  }, [teamListMessage])

  /* Create a player from here and call them up in one step */
  const handleCreatePlayer = useCallback(async (name) => {
    const created = await mb.createPlayer(name)
    if (!created) return
    setNewPlayerName('')
    setShowNewPlayer(false)
    mb.setPoolSearch('')
  }, [mb])

  const handleGeneratePoll = useCallback(() => {
    const options = mb.generatePollOptions()
    if (options) {
      setPollOptions(options)
      setPollLink('')
      setCopiedLink(false)
      setShowPollModal(true)
    }
  }, [mb])

  const handleRegenerateSingle = useCallback((idx) => {
    const fresh = mb.generatePollOptions()
    if (!fresh || !fresh[0]) return
    setPollOptions(prev => {
      const next = [...prev]
      next[idx] = fresh[Math.floor(Math.random() * fresh.length)]
      return next
    })
  }, [mb])

  const handleCreatePoll = useCallback(async () => {
    if (!pollOptions) return
    setCreatingPoll(true)
    const pollId = await mb.createTeamPoll(pollOptions)
    if (pollId) setPollLink(`${window.location.origin}/vote/${pollId}`)
    setCreatingPoll(false)
  }, [pollOptions, mb])

  const handleCopyLink = useCallback(() => {
    if (!pollLink) return
    navigator.clipboard?.writeText(pollLink).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }, [pollLink])

  const handleShareWhatsApp = useCallback(() => {
    if (!pollLink) return
    const text = `⚽ *LUKTO - Vota por el mejor armado*\n\nElige tu opción favorita para el próximo partido:\n${pollLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }, [pollLink])

  const handleApplyOption = useCallback((option) => {
    option.teamWhite.forEach(pid => {
      if (!mb.teamWhite.includes(pid) && !mb.teamBlack.includes(pid)) mb.handlePlayerToggle(pid, 'white')
    })
    option.teamBlack.forEach(pid => {
      if (!mb.teamWhite.includes(pid) && !mb.teamBlack.includes(pid)) mb.handlePlayerToggle(pid, 'black')
    })
    setShowPollModal(false)
  }, [mb])

  const topAlerts = useMemo(() =>
    insights.alerts.filter(a => a.tone === 'danger' || a.tone === 'warning'),
  [insights.alerts])

  /* Unassigned = in pool but not in either team */
  const unassigned = useMemo(() =>
    mb.selectedPlayers.filter(pid => !mb.teamWhite.includes(pid) && !mb.teamBlack.includes(pid)),
  [mb.selectedPlayers, mb.teamWhite, mb.teamBlack])

  /* How many players on each side have no history — their numbers are placeholders */
  const countUnknown = useCallback(
    (ids) => ids.filter(pid => !powerMap[pid]?.known).length,
    [powerMap],
  )

  const handleSwap = useCallback((pid, fromTeam) => {
    const toTeam = fromTeam === 'white' ? 'black' : 'white'
    mb.handlePlayerToggle(pid, fromTeam)   // remove from current
    mb.handlePlayerToggle(pid, toTeam)     // add to other
  }, [mb])

  const handleAssignFromPool = useCallback((pid, team) => {
    mb.handlePlayerToggle(pid, team)
  }, [mb])

  /* What's still blocking the save — shown instead of a silently disabled button */
  const savePending = useMemo(() => {
    if (!mb.matchDate) return 'Falta la fecha del partido'
    if (!poolReady) {
      const left = mb.requiredPlayers - mb.selectedPlayers.length
      return left > 0
        ? `Faltan ${left} jugador${left === 1 ? '' : 'es'} en la convocatoria`
        : 'Ajusta la convocatoria'
    }
    if (!teamsReady) return 'Asigna a todos los jugadores a un equipo'
    return ''
  }, [mb.matchDate, mb.requiredPlayers, mb.selectedPlayers.length, poolReady, teamsReady])

  const formatIndex = Math.max(0, mb.MATCH_FORMAT_OPTIONS.findIndex(o => o.value === mb.matchFormat))
  const showQuickStart = mb.selectedPlayers.length === 0 && (mb.lastConvocatoria || presets.length > 0)

  return (
    <section className="stats-section">
      <h2 className="section-title">
        {mb.editingMatchId ? 'Editar Partido' : 'Nuevo Partido'}
      </h2>

      {/* ── Active Polls ── */}
      {teamPolls.length > 0 && (
        <ActivePolls polls={teamPolls} getPlayerName={getPlayerName} />
      )}

      {/* ── Unsaved draft from a previous session ── */}
      {mb.restorableDraft && formIsEmpty && (
        <div className="mb-draft-recovery">
          <div className="mb-draft-recovery-text">
            <strong>Tienes un armado sin guardar</strong>
            <span>
              {mb.restorableDraft.selectedPlayers?.length || 0} jugadores
              {mb.restorableDraft.matchDate ? ` · ${formatDateLabel(mb.restorableDraft.matchDate)}` : ''}
            </span>
          </div>
          <div className="mb-draft-recovery-actions">
            <button type="button" className="mb-action" onClick={mb.discardDraft}>Descartar</button>
            <button type="button" className="mb-action primary" onClick={mb.restoreDraft}>Retomar</button>
          </div>
        </div>
      )}

      <div className="mb-wizard">

        {/* ── STEP 0: Match Info ── */}
        <StepCard number={0} title="Datos del partido" subtitle="Fecha, hora y formato" done={!!mb.matchDate}>
          <div className="mb-info-grid">
            <div className="mb-field">
              <label htmlFor="mb-date">Fecha</label>
              <input id="mb-date" type="date" value={mb.matchDate} onChange={e => mb.setMatchDate(e.target.value)} />
            </div>
            <div className="mb-field">
              <label htmlFor="mb-time">Hora</label>
              <input id="mb-time" type="time" value={mb.matchTime} onChange={e => mb.setMatchTime(e.target.value)} />
            </div>
            <div className="mb-field mb-field-venue">
              <label htmlFor="mb-venue">Lugar</label>
              <input id="mb-venue" type="text" value={mb.matchVenue} onChange={e => mb.setMatchVenue(e.target.value)} placeholder="LUKTO" />
            </div>
          </div>

          {!mb.matchDate && mb.suggestedSchedule && (
            <button type="button" className="mb-suggest-chip" onClick={mb.applySuggestedSchedule}>
              <AppIcon name="spark" size={12} />
              Usar {formatDateLabel(mb.suggestedSchedule.date)}
              {mb.suggestedSchedule.time ? ` · ${mb.suggestedSchedule.time}` : ''}
            </button>
          )}

          <div className="mb-format-row" role="group" aria-label="Formato del partido">
            <span
              className="mb-format-thumb"
              aria-hidden="true"
              style={{ '--mb-seg-index': formatIndex }}
            />
            {mb.MATCH_FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={mb.matchFormat === opt.value}
                className={`mb-format-btn ${mb.matchFormat === opt.value ? 'active' : ''}`}
                onClick={() => mb.handleMatchFormatChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </StepCard>

        {/* ── STEP 1: Convocatoria + Armado ── */}
        <StepCard
          number={1}
          title="Armado de equipos"
          subtitle={
            !poolReady
              ? `Convocatoria: ${mb.selectedPlayers.length}/${mb.requiredPlayers} jugadores`
              : teamsReady
                ? `${insights.balanceBand.label} · Balance ${insights.balanceScore}/100`
                : `Asigna ${mb.teamSize} jugadores por equipo`
          }
          done={teamsReady}
          badge={teamsReady ? `${insights.balanceScore}/100` : poolReady ? `${mb.teamSize * 2 - mb.teamWhite.length - mb.teamBlack.length} sin asignar` : undefined}
          badgeTone={teamsReady ? insights.balanceBand.tone : 'neutral'}
        >

          {/* ── Quick start: the fastest path for a recurring group ── */}
          {showQuickStart && (
            <div className="mb-quickstart">
              <span className="mb-quickstart-label">Empezar con:</span>
              {mb.lastConvocatoria && (
                <button type="button" className="mb-quickstart-btn" onClick={mb.applyLastConvocatoria}>
                  <AppIcon name="clock" size={12} />
                  Última convocatoria ({mb.lastConvocatoria.playerIds.length})
                </button>
              )}
              {presets.slice(0, 3).map(p => (
                <button key={p.name} type="button" className="mb-quickstart-btn" onClick={() => mb.applyPreset(p)}>
                  <AppIcon name="note" size={12} />
                  {p.name} ({p.playerIds.length})
                </button>
              ))}
            </div>
          )}

          {/* ── Convocatoria (colapsable una vez lista) ── */}
          <div className={`mb-pool-section ${poolReady ? 'ready' : ''}`}>
            <button
              type="button"
              className="mb-pool-section-head"
              onClick={handlePoolToggle}
              aria-expanded={poolOpen}
            >
              <span className="mb-pool-section-title">
                {poolReady
                  ? <><AppIcon name="check" size={12} /> Convocatoria lista ({mb.selectedPlayers.length})</>
                  : `Convocatoria — ${mb.selectedPlayers.length}/${mb.requiredPlayers}`
                }
              </span>
              {!poolReady && !poolOpen && (
                <span className="mb-pool-head-progress" aria-hidden="true">
                  <span
                    className="mb-pool-head-bar"
                    style={{ width: `${Math.min(100, (mb.selectedPlayers.length / mb.requiredPlayers) * 100)}%` }}
                  />
                </span>
              )}
              <span className={`mb-pool-chevron ${poolOpen ? 'up' : ''}`} aria-hidden="true">›</span>
            </button>

            {poolOpen && (
              <div className="mb-pool-body">
                <div className="mb-pool-controls">
                  <input
                    type="search"
                    value={mb.poolSearch}
                    onChange={e => mb.setPoolSearch(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Buscar jugador... (Enter para añadir)"
                    className="mb-search"
                    aria-label="Buscar jugador"
                  />
                  <div className="mb-presets-row">
                    <button type="button" className={`mb-preset-toggle ${showPresets ? 'active' : ''}`} onClick={() => setShowPresets(!showPresets)}>
                      <AppIcon name="note" size={12} />
                      {showPresets ? 'Ocultar' : 'Guardadas'}
                    </button>
                    <button
                      type="button"
                      className={`mb-preset-toggle ${showNewPlayer ? 'active' : ''}`}
                      onClick={() => {
                        setShowNewPlayer(o => !o)
                        setNewPlayerName(mb.poolSearch.trim())
                      }}
                      aria-expanded={showNewPlayer}
                    >
                      <AppIcon name="plus" size={12} />
                      Nuevo jugador
                    </button>
                    {mb.selectedPlayers.length > 0 && (
                      <button type="button" className="mb-action-sm danger" onClick={handleClearPool}>
                        <AppIcon name="trash" size={11} /> Vaciar convocatoria
                      </button>
                    )}
                  </div>
                </div>

                {showNewPlayer && (
                  <div className="mb-newplayer-panel">
                    <label htmlFor="mb-new-player">Nombre del jugador</label>
                    <div className="mb-newplayer-row">
                      <input
                        id="mb-new-player"
                        type="text"
                        value={newPlayerName}
                        onChange={e => setNewPlayerName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleCreatePlayer(newPlayerName)}
                        placeholder="Ej. Pepe, Invitado de Juan..."
                        className="mb-preset-input"
                        autoFocus
                      />
                      <button
                        type="button"
                        className="mb-action-sm primary"
                        onClick={() => handleCreatePlayer(newPlayerName)}
                        disabled={!newPlayerName.trim() || mb.creatingPlayer}
                      >
                        {mb.creatingPlayer ? 'Creando...' : 'Crear'}
                      </button>
                    </div>
                    <p className="mb-newplayer-hint">
                      Se añade a la convocatoria al crearlo. Podrás editarlo o borrarlo desde Jugadores.
                    </p>
                  </div>
                )}

                {showPresets && (
                  <div className="mb-presets-panel">
                    {presets.length > 0 ? (
                      <div className="mb-preset-list">
                        {presets.map(p => (
                          <div key={p.name} className="mb-preset-item">
                            <button type="button" className="mb-preset-load" onClick={() => { mb.applyPreset(p); setShowPresets(false) }}>
                              <span className="mb-preset-name">{p.name}</span>
                              <span className="mb-preset-count">{p.playerIds.length} jug.</span>
                            </button>
                            <button
                              type="button"
                              className="mb-preset-delete"
                              onClick={() => mb.deletePreset(p.name)}
                              aria-label={`Eliminar convocatoria ${p.name}`}
                            >×</button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mb-preset-empty">No hay convocatorias guardadas.</p>
                    )}
                    <div className="mb-preset-save-row">
                      <input
                        type="text"
                        value={presetName}
                        onChange={e => setPresetName(e.target.value)}
                        placeholder="Nombre de la convocatoria..."
                        className="mb-preset-input"
                        onKeyDown={e => e.key === 'Enter' && handleSavePreset()}
                      />
                      <button
                        type="button"
                        className="mb-action-sm primary"
                        onClick={handleSavePreset}
                        disabled={!presetName.trim() || mb.selectedPlayers.length === 0}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress bar */}
                <div
                  className="mb-pool-progress"
                  role="progressbar"
                  aria-valuenow={mb.selectedPlayers.length}
                  aria-valuemin={0}
                  aria-valuemax={mb.requiredPlayers}
                >
                  <div
                    className={`mb-pool-bar ${poolReady ? 'ready' : ''}`}
                    style={{ width: `${Math.min(100, (mb.selectedPlayers.length / mb.requiredPlayers) * 100)}%` }}
                  />
                </div>

                {/* Player grid */}
                <div className="player-select-grid">
                  {mb.filteredPoolPlayers.map(player => {
                    const isSelected = mb.selectedPlayers.includes(player.id)
                    const isDisabled = !isSelected && mb.selectedPlayers.length >= mb.requiredPlayers
                    const power = powerMap[player.id]
                    return (
                      <button
                        key={player.id}
                        type="button"
                        aria-pressed={isSelected}
                        className={`player-chip ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                        onClick={() => handlePoolPlayerToggle(player.id)}
                        disabled={isDisabled}
                        title={power?.known ? `Nivel ${power.tier} · ${power.played} partidos` : 'Sin partidos registrados'}
                      >
                        <span className={`mb-chip-power ${power?.tier || 'unknown'}`} />
                        {player.name}
                      </button>
                    )
                  })}
                  {mb.filteredPoolPlayers.length === 0 && (
                    <div className="mb-pool-no-results">
                      <p>Ningún jugador coincide con «{mb.poolSearch}»</p>
                      <button
                        type="button"
                        className="mb-create-inline"
                        onClick={() => handleCreatePlayer(mb.poolSearch)}
                        disabled={mb.creatingPlayer || !mb.poolSearch.trim()}
                      >
                        <AppIcon name="plus" size={12} />
                        {mb.creatingPlayer ? 'Creando...' : `Crear «${mb.poolSearch.trim()}»`}
                      </button>
                    </div>
                  )}
                </div>

                <p className="mb-power-legend">
                  Nivel estimado:
                  <span><i className="mb-chip-power high" /> alto</span>
                  <span><i className="mb-chip-power mid" /> medio</span>
                  <span><i className="mb-chip-power low" /> bajo</span>
                  <span><i className="mb-chip-power unknown" /> sin datos</span>
                </p>
              </div>
            )}
          </div>

          {/* ── Balance & probability (two different metrics, visibly separated) ── */}
          {(mb.teamWhite.length > 0 || mb.teamBlack.length > 0) && (
            <div className="mb-balance-panel">
              <div className="mb-balance-head">
                <span className="mb-balance-title">Balance</span>
                <span className={`mb-balance-tag ${insights.balanceBand.tone}`}>
                  {insights.balanceBand.label} · {insights.balanceScore}/100
                </span>
              </div>
              <div className="mb-balance-bar-track">
                <div
                  className={`mb-balance-bar-fill ${insights.balanceBand.tone}`}
                  style={{ width: `${insights.balanceScore}%` }}
                />
              </div>

              <div className="mb-prob-row">
                <span className="mb-prob-label">Prob. de victoria</span>
                <div className="mb-prob-track">
                  <span className="mb-prob-white" style={{ width: `${insights.probability.white}%` }} />
                  <span className="mb-prob-black" style={{ width: `${insights.probability.black}%` }} />
                </div>
                <span className="mb-prob-values">
                  {insights.probability.white}% · {insights.probability.black}%
                </span>
              </div>
            </div>
          )}

          {/* ── Actions: one primary, the rest secondary ── */}
          <div className="mb-actions-row">
            <button
              type="button"
              className="mb-action primary"
              onClick={() => mb.suggestBalancedTeams({ preserveLockedCaptains: mb.preserveCaptains })}
              disabled={!poolReady}
            >
              <AppIcon name="spark" size={14} /> Auto-balance
            </button>
            <button
              type="button"
              className="mb-action"
              onClick={mb.swapTeamColors}
              disabled={!mb.teamWhite.length && !mb.teamBlack.length}
              title="Blanco pasa a Negro y viceversa"
            >
              <AppIcon name="arrowUp" size={13} /> Intercambiar
            </button>
            <button type="button" className="mb-action" onClick={mb.openTvBoard} disabled={!poolReady}>
              <AppIcon name="note" size={13} /> Pizarra
            </button>
            <button type="button" className="mb-action poll" onClick={handleGeneratePoll} disabled={!poolReady}>
              <AppIcon name="users" size={13} /> Votar
            </button>
            <button
              type="button"
              className="mb-action ghost"
              onClick={mb.clearCurrentTeams}
              disabled={mb.teamWhite.length === 0 && mb.teamBlack.length === 0}
            >
              Vaciar equipos
            </button>
          </div>

          {/* ── Undo: only while there is something to undo ── */}
          {mb.undoLabel && (
            <div className="mb-undo-bar">
              <span>Última acción: <strong>{mb.undoLabel}</strong></span>
              <button type="button" className="mb-undo-btn" onClick={mb.undoLastAction}>Deshacer</button>
            </div>
          )}

          {/* ── Alerts: one line, expandable ── */}
          {topAlerts.length > 0 && teamsReady && (
            <div className={`mb-alerts ${alertsOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="mb-alerts-head"
                onClick={() => setAlertsOpen(o => !o)}
                aria-expanded={alertsOpen}
              >
                <AppIcon name={topAlerts.some(a => a.tone === 'danger') ? 'close' : 'info'} size={12} />
                <span>{topAlerts.length} aviso{topAlerts.length === 1 ? '' : 's'} sobre el armado</span>
                <span className={`mb-pool-chevron ${alertsOpen ? 'up' : ''}`} aria-hidden="true">›</span>
              </button>
              {alertsOpen && (
                <div className="mb-alerts-body">
                  {topAlerts.map((a, i) => (
                    <div key={i} className={`mb-quick-alert ${a.tone}`}>
                      <AppIcon name={a.tone === 'danger' ? 'close' : 'info'} size={11} />
                      <span>{a.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Swap suggestions ── */}
          {teamsReady && insights.swapSuggestions.length > 0 && (
            <div className="mb-swaps">
              <span className="mb-swaps-label">Mejoras sugeridas:</span>
              {insights.swapSuggestions.map((swap, idx) => (
                <button
                  key={`${swap.whiteOut}-${swap.blackOut}-${idx}`}
                  type="button"
                  className="mb-swap-btn"
                  onClick={() => mb.applySwapSuggestion(swap.whiteOut, swap.blackOut)}
                  title={`Sube el balance a ${Math.min(100, insights.balanceScore + Math.round(swap.improvement))}/100`}
                >
                  {getPlayerName(swap.whiteOut)} ↔ {getPlayerName(swap.blackOut)}
                  <span className="mb-swap-gain">
                    → {Math.min(100, insights.balanceScore + Math.round(swap.improvement))}/100
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* ── DRAFT ZONES ── */}
          {poolReady && (
            <>
              {unassigned.length === 0 && (
                <p className="mb-draft-status">
                  <AppIcon name="check" size={12} /> Todos los jugadores están asignados
                </p>
              )}

              <div className={`mb-draft-zones ${unassigned.length === 0 ? 'all-assigned' : ''}`}>

                {/* Pool — unassigned (solo mientras queden jugadores por repartir) */}
                {unassigned.length > 0 && (
                  <DraftPoolZone
                    unassigned={unassigned}
                    getPlayerName={getPlayerName}
                    onAddToWhite={pid => handleAssignFromPool(pid, 'white')}
                    onAddToBlack={pid => handleAssignFromPool(pid, 'black')}
                    whiteFull={mb.teamWhite.length >= mb.teamSize}
                    blackFull={mb.teamBlack.length >= mb.teamSize}
                    playerPowerMap={powerMap}
                  />
                )}

                {/* Team Blanco */}
                <DraftTeamZone
                  team="white"
                  label="Blanco"
                  teamPlayers={mb.teamWhite}
                  teamSize={mb.teamSize}
                  matchPositions={mb.matchPositions}
                  onRemove={pid => mb.handlePlayerToggle(pid, 'white')}
                  onSwap={pid => handleSwap(pid, 'white')}
                  onPositionChange={(pid, val) => mb.setMatchPositions(prev => ({ ...prev, [pid]: val }))}
                  getPlayerName={getPlayerName}
                  insights={insights.white}
                  playerPowerMap={powerMap}
                  unknownCount={countUnknown(mb.teamWhite)}
                />

                {/* Team Negro */}
                <DraftTeamZone
                  team="black"
                  label="Negro"
                  teamPlayers={mb.teamBlack}
                  teamSize={mb.teamSize}
                  matchPositions={mb.matchPositions}
                  onRemove={pid => mb.handlePlayerToggle(pid, 'black')}
                  onSwap={pid => handleSwap(pid, 'black')}
                  onPositionChange={(pid, val) => mb.setMatchPositions(prev => ({ ...prev, [pid]: val }))}
                  getPlayerName={getPlayerName}
                  insights={insights.black}
                  playerPowerMap={powerMap}
                  unknownCount={countUnknown(mb.teamBlack)}
                />
              </div>

              {/* ── Share the roster: the moment the teams are set ── */}
              {teamsReady && (
                <div className="mb-share-list">
                  <div className="mb-share-actions">
                    <button type="button" className="mb-share-btn copy" onClick={handleCopyList}>
                      <AppIcon name={copiedList ? 'check' : 'note'} size={13} />
                      {copiedList ? 'Copiado' : 'Copiar lista'}
                    </button>
                    <button type="button" className="mb-share-btn whatsapp" onClick={handleShareListWhatsApp}>
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      className="mb-share-btn ghost"
                      onClick={() => setShowListPreview(o => !o)}
                      aria-expanded={showListPreview}
                    >
                      {showListPreview ? 'Ocultar texto' : 'Ver texto'}
                    </button>
                  </div>
                  {showListPreview && (
                    <pre className="mb-share-preview">{teamListMessage}</pre>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Capitanes (collapsed) ── */}
          <details className="mb-captains-detail">
            <summary>Opciones de capitanes</summary>
            <div className="mb-captains-body">
              <label className="mb-captain-check">
                <input type="checkbox" checked={mb.preserveCaptains} onChange={e => mb.setPreserveCaptains(e.target.checked)} />
                <span>Fijar capitanes al auto-balance</span>
              </label>
              <div className="mb-captain-selects">
                <select
                  className="position-select"
                  value={mb.lockedWhiteCaptain}
                  onChange={e => mb.handleWhiteCaptainChange(e.target.value)}
                  disabled={!mb.preserveCaptains || mb.selectedPlayers.length === 0}
                  aria-label="Capitán del equipo blanco"
                >
                  <option value="">Cap. blanco</option>
                  {mb.selectedPlayers.filter(pid => pid !== mb.lockedBlackCaptain).map(pid => (
                    <option key={`cw-${pid}`} value={pid}>{getPlayerName(pid)}</option>
                  ))}
                </select>
                <select
                  className="position-select"
                  value={mb.lockedBlackCaptain}
                  onChange={e => mb.handleBlackCaptainChange(e.target.value)}
                  disabled={!mb.preserveCaptains || mb.selectedPlayers.length === 0}
                  aria-label="Capitán del equipo negro"
                >
                  <option value="">Cap. negro</option>
                  {mb.selectedPlayers.filter(pid => pid !== mb.lockedWhiteCaptain).map(pid => (
                    <option key={`cb-${pid}`} value={pid}>{getPlayerName(pid)}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* ── Advanced insights (collapsed) ── */}
          {teamsReady && (
            <details className="mb-advanced-detail" open={showAdvancedInsights} onToggle={e => setShowAdvancedInsights(e.currentTarget.open)}>
              <summary>Análisis detallado</summary>
              <div className="mb-advanced-body">
                <div className="mb-compare-grid">
                  <CompareCard team="Blanco" tone="white" data={insights.white} unknownCount={countUnknown(mb.teamWhite)} />
                  <CompareCard team="Negro" tone="black" data={insights.black} unknownCount={countUnknown(mb.teamBlack)} />
                </div>
                {insights.duelStats.knownDuels > 0 && (
                  <p className="mb-duel-hint">
                    Historial cruzado: {insights.duelStats.whitePct.toFixed(0)}% victorias blanco
                    en {insights.duelStats.knownDuels} duelos previos
                  </p>
                )}
              </div>
            </details>
          )}
        </StepCard>

        {/* ── STEP 2: Result (opt-in — most matches are created before kick-off) ── */}
        <StepCard
          number={2}
          title="Resultado"
          subtitle={hasResult ? `${mb.scoreWhite || 0} — ${mb.scoreBlack || 0}` : 'Opcional · añádelo cuando se juegue'}
          done={hasResult}
          disabled={!teamsReady}
        >
          {!resultOpen ? (
            <button type="button" className="mb-result-open" onClick={() => setResultOpen(true)}>
              <AppIcon name="check" size={13} /> Ya se jugó — añadir marcador
            </button>
          ) : (
            <>
              <div className="mb-score-row">
                <div className="mb-score-team">
                  <span className="mb-score-label white">Blanco</span>
                  <input
                    type="number" min="0" max="30" inputMode="numeric"
                    value={mb.scoreWhite}
                    onChange={e => mb.setScoreWhite(e.target.value)}
                    placeholder="0"
                    className="mb-score-input"
                    aria-label="Goles del equipo blanco"
                  />
                </div>
                <span className="mb-score-divider" aria-hidden="true">—</span>
                <div className="mb-score-team">
                  <span className="mb-score-label black">Negro</span>
                  <input
                    type="number" min="0" max="30" inputMode="numeric"
                    value={mb.scoreBlack}
                    onChange={e => mb.setScoreBlack(e.target.value)}
                    placeholder="0"
                    className="mb-score-input"
                    aria-label="Goles del equipo negro"
                  />
                </div>
              </div>

              <div className="mb-winner-row" role="group" aria-label="Ganador">
                {[
                  { key: 'white', label: 'Blanco' },
                  { key: 'tie',   label: 'Empate', icon: 'users' },
                  { key: 'black', label: 'Negro' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={mb.winner === opt.key}
                    className={`mb-winner-btn ${opt.key} ${mb.winner === opt.key ? 'active' : ''}`}
                    onClick={() => mb.setWinner(mb.winner === opt.key ? '' : opt.key)}
                  >
                    {opt.icon ? <AppIcon name={opt.icon} size={13} /> : <span className={`team-badge ${opt.key}`}></span>}
                    {opt.label}
                  </button>
                ))}
              </div>
              {!hasResult && (
                <p className="mb-result-hint">Déjalo vacío para que los jugadores puedan hacer predicciones.</p>
              )}
            </>
          )}
        </StepCard>

        {/* ── SAVE BAR ── */}
        <div className="mb-save-bar">
          {savePending && (
            <p className="mb-save-pending">
              <AppIcon name="info" size={12} /> {savePending}
            </p>
          )}
          <div className="mb-save-actions">
            {mb.editingMatchId && (
              <button type="button" className="mb-save-cancel" onClick={mb.resetMatchForm}>Cancelar</button>
            )}
            <button type="button" className="mb-save-btn" onClick={handleSave} disabled={!canSave || mb.saving}>
              {mb.saving ? 'Guardando...' : mb.editingMatchId ? 'Actualizar partido' : 'Guardar partido'}
            </button>
          </div>
        </div>
      </div>

      {mb.showTvBoard && <TvBoardOverlay mb={mb} getPlayerName={getPlayerName} />}

      {showPollModal && pollOptions && (
        <PollModal
          options={pollOptions}
          pollLink={pollLink}
          creatingPoll={creatingPoll}
          copiedLink={copiedLink}
          getPlayerName={getPlayerName}
          onClose={() => setShowPollModal(false)}
          onRegenerate={handleRegenerateSingle}
          onCreatePoll={handleCreatePoll}
          onCopyLink={handleCopyLink}
          onShareWhatsApp={handleShareWhatsApp}
          onApplyOption={handleApplyOption}
        />
      )}
    </section>
  )
}

/* Chemistry falls back to 50% with no shared matches — don't dress that up as data */
function chemistryDisplay(chemistry) {
  if (!chemistry || chemistry.knownPairs < MIN_CHEMISTRY_PAIRS) {
    return { value: '—', title: 'Sin suficientes partidos juntos para estimar la química' }
  }
  return {
    value: `${chemistry.score.toFixed(0)}%`,
    title: `Basado en ${chemistry.knownPairs} de ${chemistry.totalPairs} parejas con historial`,
  }
}

/* ── Three-Zone: Team column ── */
function DraftTeamZone({ team, label, teamPlayers, teamSize, matchPositions, onRemove, onSwap, onPositionChange, getPlayerName, insights, playerPowerMap, unknownCount = 0 }) {
  const filled = teamPlayers.length
  const isEmpty = filled === 0
  const isWhite = team === 'white'

  /* Only one player's position picker is open at a time */
  const [openPositionFor, setOpenPositionFor] = useState(null)

  const handlePositionPick = (pid, value) => {
    onPositionChange(pid, value)
    setOpenPositionFor(null)
  }

  const chem = chemistryDisplay(insights.chemistry)
  const estimated = unknownCount > 0
  const estimatedTitle = `${unknownCount} jugador${unknownCount === 1 ? '' : 'es'} sin historial: estos promedios son estimados`

  return (
    <div className={`mb-draft-zone dz-team dz-${team}`}>
      <div className="mb-dz-header">
        <span className={`mb-dz-dot ${team}`} />
        <span className="mb-dz-label">{label}</span>
        <span className="mb-dz-count">{filled}/{teamSize}</span>
      </div>

      <div className="mb-dz-body">
        {isEmpty && <p className="mb-dz-empty">Sin jugadores</p>}

        {teamPlayers.map(pid => {
          const power = playerPowerMap[pid]
          const pos = matchPositions[pid] || ''
          const name = getPlayerName(pid)
          const short = POSITION_PILLS.find(p => p.value === pos)?.short
          const picking = openPositionFor === pid
          return (
            <div key={pid} className={`mb-dz-player ${picking ? 'picking' : ''}`}>
              <div className="mb-dz-player-row">
                <span
                  className={`mb-power-dot ${power?.tier || 'unknown'}`}
                  title={power?.known ? `★ ${power.rating?.toFixed(1)} · ${power.played} partidos` : 'Sin partidos registrados'}
                />
                <span className="mb-dz-name">{name}</span>
                <button
                  type="button"
                  className={`mb-pos-chip ${pos ? 'set' : ''}`}
                  onClick={() => setOpenPositionFor(picking ? null : pid)}
                  aria-expanded={picking}
                  title={pos ? getPositionLabel(pos) : 'Asignar posición'}
                  aria-label={`Posición de ${name}: ${pos ? getPositionLabel(pos) : 'sin asignar'}`}
                >
                  {short || 'POS'}
                </button>
                <div className="mb-dz-btns">
                  <button
                    type="button"
                    className="mb-dz-btn swap"
                    onClick={() => onSwap(pid)}
                    title={`Mover a ${isWhite ? 'Negro' : 'Blanco'}`}
                    aria-label={`Mover ${name} al equipo ${isWhite ? 'negro' : 'blanco'}`}
                  >
                    {isWhite ? '→' : '←'}
                  </button>
                  <button
                    type="button"
                    className="mb-dz-btn remove"
                    onClick={() => onRemove(pid)}
                    title="Quitar"
                    aria-label={`Quitar a ${name} del equipo`}
                  >×</button>
                </div>
              </div>
              {picking && (
                <div className="mb-pos-pills" role="group" aria-label={`Posición de ${name}`}>
                  {POSITION_PILLS.map(p => (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={pos === p.value}
                      className={`mb-pos-pill ${pos === p.value ? 'active' : ''}`}
                      onClick={() => handlePositionPick(pid, pos === p.value ? '' : p.value)}
                    >
                      {p.short}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filled > 0 && (
        <div className={`mb-dz-stats ${estimated ? 'estimated' : ''}`} title={estimated ? estimatedTitle : undefined}>
          <span><em>WR</em> {estimated ? '~' : ''}{insights.avgWinRate.toFixed(0)}%</span>
          <span><em>★</em> {estimated ? '~' : ''}{insights.avgRating.toFixed(1)}</span>
          <span title={chem.title}><em>Química</em> {chem.value}</span>
        </div>
      )}
    </div>
  )
}

/* ── Three-Zone: Unassigned pool column ── */
function DraftPoolZone({ unassigned, getPlayerName, onAddToWhite, onAddToBlack, whiteFull, blackFull, playerPowerMap }) {
  return (
    <div className="mb-draft-zone dz-pool">
      <div className="mb-dz-header pool">
        <span className="mb-dz-label">Sin asignar</span>
        <span className="mb-dz-count">{unassigned.length}</span>
      </div>

      <div className="mb-dz-body">
        {unassigned.map(pid => {
          const power = playerPowerMap[pid]
          const name = getPlayerName(pid)
          return (
            <div key={pid} className="mb-dz-pool-player">
              <div className="mb-dz-player-info">
                <span
                  className={`mb-power-dot ${power?.tier || 'unknown'}`}
                  title={power?.known ? `${power.played} partidos` : 'Sin partidos registrados'}
                />
                <span className="mb-dz-name">{name}</span>
                {power?.known
                  ? <span className="mb-dz-rating">★{power.rating.toFixed(1)}</span>
                  : <span className="mb-dz-rating muted">sin datos</span>}
              </div>
              <div className="mb-dz-assign-btns">
                <button
                  type="button"
                  className="mb-assign-btn white"
                  onClick={() => onAddToWhite(pid)}
                  disabled={whiteFull}
                  title="Asignar a Blanco"
                  aria-label={`Asignar a ${name} al equipo blanco`}
                >B</button>
                <button
                  type="button"
                  className="mb-assign-btn black"
                  onClick={() => onAddToBlack(pid)}
                  disabled={blackFull}
                  title="Asignar a Negro"
                  aria-label={`Asignar a ${name} al equipo negro`}
                >N</button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Step Card wrapper ── */
function StepCard({ number, title, subtitle, done, badge, badgeTone, disabled, children }) {
  return (
    <div className={`mb-step ${done ? 'done' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="mb-step-header">
        <div className="mb-step-indicator">
          {done ? <AppIcon name="check" size={13} /> : <span>{number}</span>}
        </div>
        <div className="mb-step-titles">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {badge && <span className={`mb-step-badge ${badgeTone || ''}`}>{badge}</span>}
      </div>
      <div className="mb-step-content">
        {children}
      </div>
    </div>
  )
}

/* ── Compare Card (advanced) ── */
function CompareCard({ team, tone, data, unknownCount = 0 }) {
  const chem = chemistryDisplay(data.chemistry)
  const est = unknownCount > 0 ? '~' : ''
  const rows = [
    { label: 'Win Rate', value: `${est}${data.avgWinRate.toFixed(1)}%` },
    { label: 'Rating',   value: `${est}${data.avgRating.toFixed(2)}` },
    { label: 'MVPs',     value: data.avgMvps.toFixed(1) },
    { label: 'Partidos', value: data.avgPlayed.toFixed(0) },
    { label: 'Química',  value: chem.value, title: chem.title },
  ]
  const missing = data.missingRoles || []
  return (
    <div className={`mb-compare-card ${tone}`}>
      <h4>{team}</h4>
      {rows.map(r => (
        <div key={r.label} className="mb-compare-row" title={r.title}>
          <span>{r.label}</span><strong>{r.value}</strong>
        </div>
      ))}
      {unknownCount > 0 && (
        <div className="mb-compare-estimated">
          ~ {unknownCount} sin historial
        </div>
      )}
      {missing.length > 0 && <div className="mb-compare-missing">Falta: {missing.join(', ')}</div>}
    </div>
  )
}

/* ── TV Board Overlay ── */
function TvBoardOverlay({ mb, getPlayerName }) {
  return (
    <div className="tv-board-overlay" onClick={mb.handleTvOverlayClick}>
      <div className="tv-board" onClick={e => e.stopPropagation()}>
        <div className="tv-board-header">
          <div>
            <h3>Pizarra de partido ({mb.teamSize} vs {mb.teamSize})</h3>
            <p>
              Balance {mb.liveDraftInsights.balanceScore}/100 ·
              Blanco {mb.liveDraftInsights.probability.white}% ·
              Negro {mb.liveDraftInsights.probability.black}%
            </p>
          </div>
          <div className="tv-board-header-actions">
            {mb.selectedTvPlayerId && (
              <button className="tv-close-btn" onClick={() => mb.setSelectedTvPlayerId('')}>
                <AppIcon name="close" size={14} /> Deseleccionar
              </button>
            )}
            <button className="tv-close-btn" onClick={mb.resetTvBoardLayout}>
              <AppIcon name="arrowUp" size={14} /> Reset
            </button>
            <button className="tv-close-btn" onClick={mb.closeTvBoard}>
              <AppIcon name="close" size={14} /> Salir
            </button>
          </div>
        </div>

        <div className="tv-board-kpis">
          <div className="tv-kpi"><span>Pool</span><strong>{mb.selectedPlayers.length}/{mb.requiredPlayers}</strong></div>
          <div className="tv-kpi"><span>Ajuste rol</span><strong>{mb.liveDraftInsights.rolePenalty.toFixed(2)}</strong></div>
          <div className="tv-kpi"><span>Gap prob.</span><strong>{mb.liveDraftInsights.probabilityGap.toFixed(0)}%</strong></div>
          <div className="tv-kpi"><span>Power gap</span><strong>{mb.liveDraftInsights.powerGapPct.toFixed(1)}%</strong></div>
        </div>

        <div className="tv-pitch-wrapper">
          <div ref={mb.tvPitchRef} className="tv-pitch" onPointerDown={mb.handleTvPitchPointerDown}>
            <div className={`tv-half white ${mb.tvDragTeam === 'white' ? 'drag-over' : ''}`}>
              <span className="tv-half-label">Equipo Blanco</span>
            </div>
            <div className="tv-center-line"></div>
            <div className="tv-center-circle"></div>
            <div className="tv-goal-box white"></div>
            <div className="tv-goal-box black"></div>
            <div className="tv-goal white"></div>
            <div className="tv-goal black"></div>
            <div className={`tv-half black ${mb.tvDragTeam === 'black' ? 'drag-over' : ''}`}>
              <span className="tv-half-label">Equipo Negro</span>
            </div>
            {mb.tvBoardPlayers.map(player => (
              <button
                key={`tv-chip-${player.playerId}`}
                type="button"
                data-player-id={player.playerId}
                className={`tv-player-chip ${player.team} ${mb.draggingTvPlayerId === player.playerId ? 'dragging' : ''} ${mb.selectedTvPlayerId === player.playerId ? 'selected' : ''}`}
                onPointerDown={event => mb.handleTvPointerDown(event, player.playerId)}
                onContextMenu={event => event.preventDefault()}
                style={{ left: `${player.x}%`, top: `${player.y}%` }}
                title={`${getPlayerName(player.playerId)} · ${getPositionLabel(player.position) || 'Sin posicion'}`}
              >
                <span className="tv-chip-name">{getPlayerName(player.playerId)}</span>
                <span className="tv-chip-role">{getPositionLabel(player.position) || 'Sin posicion'}</span>
              </button>
            ))}
          </div>
          <div className="tv-board-legend">
            <span><strong>Como usar:</strong> toca una ficha para seleccionarla, arrastra para moverla o toca una zona del campo para recolocarla.</span>
            <span>
              {mb.selectedTvPlayerId
                ? `Seleccionado: ${getPlayerName(mb.selectedTvPlayerId)} · ${getPositionLabel(mb.matchPositions[mb.selectedTvPlayerId]) || 'Sin posicion'}`
                : 'Selecciona una ficha para mover con mayor precision.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Active Polls Panel ── */
function ActivePolls({ polls, getPlayerName }) {
  const [expanded, setExpanded] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const handleCopy = (pollId) => {
    const url = `${window.location.origin}/vote/${pollId}`
    navigator.clipboard?.writeText(url).then(() => {
      setCopiedId(pollId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const handleShare = (poll) => {
    const url = `${window.location.origin}/vote/${poll.id}`
    const text = `⚽ *LUKTO - Vota por el mejor armado*\n\nElige tu opción favorita para el próximo partido:\n${url}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  const handleDelete = async (pollId) => {
    if (!confirm('¿Eliminar esta encuesta?')) return
    setDeleting(pollId)
    try { await deleteDoc(doc(db, 'matches', pollId)) }
    catch (e) { console.error(e) }
    finally { setDeleting(null) }
  }

  return (
    <div className="ap-panel">
      <div className="ap-header">
        <h3>Encuestas activas</h3>
        <span className="ap-count">{polls.length}</span>
      </div>
      <div className="ap-list">
        {polls.map(poll => {
          const isOpen = expanded === poll.id
          const opts = Array.isArray(poll.options) ? poll.options : []
          const total = poll.totalVotes || opts.reduce((s, o) => s + (o.votes || 0), 0) || 0
          const winner = total > 0
            ? opts.reduce((best, o, i) => (o.votes || 0) > (best.votes || 0) ? { ...o, idx: i } : best, { votes: 0, idx: 0 })
            : null
          return (
            <div key={poll.id} className={`ap-card ${isOpen ? 'open' : ''}`}>
              <div className="ap-card-head" onClick={() => setExpanded(isOpen ? null : poll.id)}>
                <div className="ap-card-info">
                  <span className="ap-card-title">{poll.matchFormat} · {poll.matchDate ? formatPollDate(poll.matchDate) : 'Sin fecha'}</span>
                  <span className="ap-card-votes">{total} voto{total !== 1 ? 's' : ''}</span>
                </div>
                {winner && total > 0 && <span className="ap-leading">Lidera: Opción {winner.idx + 1}</span>}
                <span className={`ap-chevron ${isOpen ? 'open' : ''}`}>›</span>
              </div>
              {isOpen && (
                <div className="ap-card-body">
                  <div className="ap-options">
                    {opts.map((opt, idx) => {
                      const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0
                      const isLeading = total > 0 && (opt.votes || 0) === Math.max(...opts.map(o => o.votes || 0)) && (opt.votes || 0) > 0
                      return (
                        <div key={idx} className={`ap-option ${isLeading ? 'leading' : ''}`}>
                          <div className="ap-option-head">
                            <strong>Opción {idx + 1}</strong>
                            <span className="ap-option-balance">{opt.balanceScore}/100</span>
                            <span className="ap-option-votes">{opt.votes || 0} votos · {pct}%</span>
                          </div>
                          <div className="ap-bar-track">
                            <div className={`ap-bar-fill ${isLeading ? 'leading' : ''}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="ap-teams-mini">
                            <div className="ap-team-mini">
                              <span className="team-badge white"></span>
                              {opt.teamWhite?.map(pid => <span key={pid} className="ap-player">{poll.playerNames?.[pid] || getPlayerName(pid)}</span>)}
                            </div>
                            <div className="ap-team-mini">
                              <span className="team-badge black"></span>
                              {opt.teamBlack?.map(pid => <span key={pid} className="ap-player">{poll.playerNames?.[pid] || getPlayerName(pid)}</span>)}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="ap-actions">
                    <button className="ap-btn copy" onClick={() => handleCopy(poll.id)}>
                      {copiedId === poll.id ? '✓ Copiado' : 'Copiar enlace'}
                    </button>
                    <button className="ap-btn whatsapp" onClick={() => handleShare(poll)}>WhatsApp</button>
                    <button className="ap-btn delete" onClick={() => handleDelete(poll.id)} disabled={deleting === poll.id}>
                      {deleting === poll.id ? '...' : 'Eliminar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatPollDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch { return dateStr }
}

/* ── Poll Modal ── */
function PollModal({ options, pollLink, creatingPoll, copiedLink, getPlayerName, onClose, onRegenerate, onCreatePoll, onCopyLink, onShareWhatsApp, onApplyOption }) {
  return (
    <div className="poll-overlay" onClick={onClose}>
      <div className="poll-modal" onClick={e => e.stopPropagation()}>
        <div className="poll-modal-header">
          <div>
            <h3>Opciones de armado</h3>
            <p>3 opciones generadas. Edita, regenera o comparte para votar.</p>
          </div>
          <button className="poll-close" onClick={onClose}>×</button>
        </div>
        <div className="poll-options-list">
          {options.map((opt, idx) => (
            <div key={idx} className="poll-option-card">
              <div className="poll-option-top">
                <span className="poll-option-num">Opción {idx + 1}</span>
                <span className={`poll-option-score ${opt.balanceScore >= 80 ? 'good' : opt.balanceScore >= 65 ? 'medium' : 'bad'}`}>
                  {opt.balanceScore}/100
                </span>
                <span className="poll-option-prob">{opt.probability.white}% vs {opt.probability.black}%</span>
              </div>
              <div className="poll-teams-row">
                <div className="poll-team white">
                  <div className="poll-team-label"><span className="team-badge white"></span> Blanco</div>
                  {opt.teamWhite.map(pid => (
                    <div key={pid} className="poll-player">
                      <span>{getPlayerName(pid)}</span>
                      {opt.positions?.[pid] && <small>{getPositionLabel(opt.positions[pid])}</small>}
                    </div>
                  ))}
                </div>
                <div className="poll-team black">
                  <div className="poll-team-label"><span className="team-badge black"></span> Negro</div>
                  {opt.teamBlack.map(pid => (
                    <div key={pid} className="poll-player">
                      <span>{getPlayerName(pid)}</span>
                      {opt.positions?.[pid] && <small>{getPositionLabel(opt.positions[pid])}</small>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="poll-option-actions">
                <button className="poll-opt-btn" onClick={() => onRegenerate(idx)}>
                  <AppIcon name="spark" size={12} /> Regenerar
                </button>
                <button className="poll-opt-btn apply" onClick={() => onApplyOption(opt)}>
                  Usar este armado
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="poll-share-section">
          {!pollLink ? (
            <button className="poll-create-btn" onClick={onCreatePoll} disabled={creatingPoll}>
              {creatingPoll ? 'Creando encuesta...' : 'Crear encuesta y compartir'}
            </button>
          ) : (
            <div className="poll-share-ready">
              <p className="poll-share-label">Enlace listo para compartir:</p>
              <div className="poll-link-row">
                <input type="text" value={pollLink} readOnly className="poll-link-input" onClick={e => e.target.select()} />
                <button className="poll-copy-btn" onClick={onCopyLink}>{copiedLink ? '✓ Copiado' : 'Copiar'}</button>
              </div>
              <button className="poll-whatsapp-btn" onClick={onShareWhatsApp}>Compartir en WhatsApp</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
