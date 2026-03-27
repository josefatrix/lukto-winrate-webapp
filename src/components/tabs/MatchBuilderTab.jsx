import { useState, useMemo, useCallback } from 'react'
import { useApp } from '../../contexts'
import { AppIcon } from '../common'
import { getPositionLabel } from '../../utils/matchConstants'
import { doc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'

export function MatchBuilderTab({ mb }) {
  const { getPlayerName, setActiveTab, teamPolls } = useApp()

  const [presetName, setPresetName] = useState('')
  const [showPresets, setShowPresets] = useState(false)
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false)

  // Poll state
  const [pollOptions, setPollOptions] = useState(null)
  const [showPollModal, setShowPollModal] = useState(false)
  const [pollLink, setPollLink] = useState('')
  const [creatingPoll, setCreatingPoll] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  const presets = mb.loadPresets()
  const insights = mb.liveDraftInsights

  const poolReady = mb.selectedPlayers.length === mb.requiredPlayers
  const teamsReady = mb.teamWhite.length === mb.teamSize && mb.teamBlack.length === mb.teamSize
  const canSave = mb.matchDate && poolReady && teamsReady

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
    if (pollId) {
      const url = `${window.location.origin}/vote/${pollId}`
      setPollLink(url)
    }
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
      if (!mb.teamWhite.includes(pid) && !mb.teamBlack.includes(pid)) {
        mb.handlePlayerToggle(pid, 'white')
      }
    })
    option.teamBlack.forEach(pid => {
      if (!mb.teamWhite.includes(pid) && !mb.teamBlack.includes(pid)) {
        mb.handlePlayerToggle(pid, 'black')
      }
    })
    setShowPollModal(false)
  }, [mb])

  const topAlerts = useMemo(() =>
    insights.alerts.filter(a => a.tone === 'danger' || a.tone === 'warning'),
  [insights.alerts])

  return (
    <section className="stats-section">
      <h2 className="section-title">
        {mb.editingMatchId ? 'Editar Partido' : 'Nuevo Partido'}
      </h2>

      {/* ── Active Polls ── */}
      {teamPolls.length > 0 && (
        <ActivePolls polls={teamPolls} getPlayerName={getPlayerName} />
      )}

      <div className="mb-wizard">
        {/* ── STEP 0: Match Info ── */}
        <StepCard
          number={0}
          title="Datos del partido"
          subtitle="Fecha, hora y formato"
          done={!!mb.matchDate}
        >
          <div className="mb-info-grid">
            <div className="mb-field">
              <label>Fecha</label>
              <input type="date" value={mb.matchDate} onChange={e => mb.setMatchDate(e.target.value)} />
            </div>
            <div className="mb-field">
              <label>Hora</label>
              <input type="time" value={mb.matchTime} onChange={e => mb.setMatchTime(e.target.value)} />
            </div>
            <div className="mb-field">
              <label>Lugar</label>
              <input type="text" value={mb.matchVenue} onChange={e => mb.setMatchVenue(e.target.value)} placeholder="LUKTO" />
            </div>
          </div>
          <div className="mb-format-row">
            {mb.MATCH_FORMAT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                className={`mb-format-btn ${mb.matchFormat === opt.value ? 'active' : ''}`}
                onClick={() => mb.handleMatchFormatChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </StepCard>

        {/* ── STEP 1: Player Pool ── */}
        <StepCard
          number={1}
          title="Convocatoria"
          subtitle={`${mb.selectedPlayers.length} de ${mb.requiredPlayers} jugadores`}
          done={poolReady}
          badge={poolReady ? 'Listo' : `${mb.requiredPlayers - mb.selectedPlayers.length} faltan`}
          badgeTone={poolReady ? 'good' : 'neutral'}
        >
          <input
            type="text"
            value={mb.poolSearch}
            onChange={e => mb.setPoolSearch(e.target.value)}
            placeholder="Buscar jugador por nombre..."
            className="mb-search"
          />

          {/* Presets */}
          <div className="mb-presets-row">
            <button className="mb-preset-toggle" onClick={() => setShowPresets(!showPresets)}>
              <AppIcon name="note" size={12} />
              {showPresets ? 'Ocultar convocatorias' : 'Convocatorias guardadas'}
            </button>
            {mb.selectedPlayers.length > 0 && !showPresets && (
              <button className="mb-action-sm danger" onClick={mb.clearSelectedPlayers}>
                <AppIcon name="trash" size={11} /> Limpiar
              </button>
            )}
          </div>

          {showPresets && (
            <div className="mb-presets-panel">
              {presets.length > 0 ? (
                <div className="mb-preset-list">
                  {presets.map(p => (
                    <div key={p.name} className="mb-preset-item">
                      <button className="mb-preset-load" onClick={() => { mb.applyPreset(p); setShowPresets(false) }}>
                        <span className="mb-preset-name">{p.name}</span>
                        <span className="mb-preset-count">{p.playerIds.length} jugadores</span>
                      </button>
                      <button className="mb-preset-delete" onClick={() => mb.deletePreset(p.name)} title="Eliminar">×</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-preset-empty">No hay convocatorias guardadas todavía.</p>
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
                  className="mb-action-sm primary"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim() || mb.selectedPlayers.length === 0}
                >
                  Guardar
                </button>
              </div>
            </div>
          )}

          {/* Pool progress bar */}
          <div className="mb-pool-progress">
            <div
              className={`mb-pool-bar ${poolReady ? 'ready' : ''}`}
              style={{ width: `${Math.min(100, (mb.selectedPlayers.length / mb.requiredPlayers) * 100)}%` }}
            />
          </div>

          <div className="player-select-grid">
            {mb.filteredPoolPlayers.map(player => {
              const isSelected = mb.selectedPlayers.includes(player.id)
              const isDisabled = !isSelected && mb.selectedPlayers.length >= mb.requiredPlayers
              return (
                <button
                  key={player.id}
                  className={`player-chip ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                  onClick={() => mb.handlePoolPlayerToggle(player.id)}
                  disabled={isDisabled}
                >
                  {player.name}
                </button>
              )
            })}
          </div>
        </StepCard>

        {/* ── STEP 2: Build Teams ── */}
        <StepCard
          number={2}
          title="Armar equipos"
          subtitle={teamsReady ? `${insights.balanceBand.label} · Balance ${insights.balanceScore}/100` : 'Auto-balance o selección manual'}
          done={teamsReady}
          badge={teamsReady ? `${insights.balanceScore}/100` : undefined}
          badgeTone={teamsReady ? insights.balanceBand.tone : 'neutral'}
          disabled={!poolReady}
        >
          {/* Balance meter (only show when there's something to balance) */}
          {(mb.teamWhite.length > 0 || mb.teamBlack.length > 0) && (
            <div className="mb-balance-strip">
              <div className="mb-balance-bar-track">
                <div
                  className={`mb-balance-bar-fill ${insights.balanceBand.tone}`}
                  style={{ width: `${insights.balanceScore}%` }}
                />
              </div>
              <div className="mb-balance-labels">
                <span className={`mb-balance-tag ${insights.balanceBand.tone}`}>{insights.balanceBand.label}</span>
                <span className="mb-balance-prob">
                  {insights.probability.white}% vs {insights.probability.black}%
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mb-actions-row">
            <button
              className="mb-action primary"
              onClick={() => mb.suggestBalancedTeams({ preserveLockedCaptains: mb.preserveCaptains })}
              disabled={!poolReady}
            >
              <AppIcon name="spark" size={14} /> Auto-balance
            </button>
            <button
              className="mb-action"
              onClick={mb.clearCurrentTeams}
              disabled={mb.teamWhite.length === 0 && mb.teamBlack.length === 0}
            >
              <AppIcon name="close" size={13} /> Limpiar
            </button>
            <button className="mb-action" onClick={mb.openTvBoard} disabled={!poolReady}>
              <AppIcon name="note" size={13} /> Pizarra
            </button>
            <button className="mb-action poll" onClick={handleGeneratePoll} disabled={!poolReady}>
              <AppIcon name="users" size={13} /> Votar armado
            </button>
          </div>

          {/* Quick alerts (only critical ones, inline) */}
          {topAlerts.length > 0 && teamsReady && (
            <div className="mb-quick-alerts">
              {topAlerts.map((a, i) => (
                <div key={i} className={`mb-quick-alert ${a.tone}`}>
                  <AppIcon name={a.tone === 'danger' ? 'close' : 'info'} size={11} />
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          )}

          {/* Swap suggestions (shown prominently only when beneficial) */}
          {teamsReady && insights.swapSuggestions.length > 0 && (
            <div className="mb-swaps">
              <span className="mb-swaps-label">Mejoras sugeridas:</span>
              {insights.swapSuggestions.map((swap, idx) => (
                <button
                  key={`${swap.whiteOut}-${swap.blackOut}-${idx}`}
                  className="mb-swap-btn"
                  onClick={() => mb.applySwapSuggestion(swap.whiteOut, swap.blackOut)}
                >
                  {getPlayerName(swap.whiteOut)} ↔ {getPlayerName(swap.blackOut)}
                  <span className="mb-swap-gain">+{swap.improvement.toFixed(0)}</span>
                </button>
              ))}
            </div>
          )}

          {/* Teams side by side */}
          <div className="mb-teams-grid">
            <TeamColumn
              label="Blanco"
              team="white"
              teamPlayers={mb.teamWhite}
              teamSize={mb.teamSize}
              selectedPlayers={mb.selectedPlayers}
              otherTeam={mb.teamBlack}
              matchPositions={mb.matchPositions}
              onToggle={mb.handlePlayerToggle}
              onPositionChange={(pid, val) => mb.setMatchPositions(prev => ({ ...prev, [pid]: val }))}
              positionOptions={mb.POSITION_OPTIONS}
              getPlayerName={getPlayerName}
              insights={insights.white}
            />
            <TeamColumn
              label="Negro"
              team="black"
              teamPlayers={mb.teamBlack}
              teamSize={mb.teamSize}
              selectedPlayers={mb.selectedPlayers}
              otherTeam={mb.teamWhite}
              matchPositions={mb.matchPositions}
              onToggle={mb.handlePlayerToggle}
              onPositionChange={(pid, val) => mb.setMatchPositions(prev => ({ ...prev, [pid]: val }))}
              positionOptions={mb.POSITION_OPTIONS}
              getPlayerName={getPlayerName}
              insights={insights.black}
            />
          </div>

          {/* Captain lock (collapsed, secondary) */}
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
                >
                  <option value="">Cap. negro</option>
                  {mb.selectedPlayers.filter(pid => pid !== mb.lockedWhiteCaptain).map(pid => (
                    <option key={`cb-${pid}`} value={pid}>{getPlayerName(pid)}</option>
                  ))}
                </select>
              </div>
            </div>
          </details>

          {/* Advanced insights (collapsed by default) */}
          {teamsReady && (
            <details className="mb-advanced-detail" open={showAdvancedInsights} onToggle={e => setShowAdvancedInsights(e.currentTarget.open)}>
              <summary>Análisis detallado</summary>
              <div className="mb-advanced-body">
                <div className="mb-compare-grid">
                  <CompareCard team="Blanco" tone="white" data={insights.white} />
                  <CompareCard team="Negro" tone="black" data={insights.black} />
                </div>
                <div className="mb-kpis-row">
                  <MiniKpi label="Pool" value={`${insights.completionPct.toFixed(0)}%`} />
                  <MiniKpi label="Asignación" value={`${insights.assignmentPct.toFixed(0)}%`} />
                  <MiniKpi label="Power gap" value={`${insights.powerGapPct.toFixed(1)}%`} />
                  <MiniKpi label="Rol penalty" value={insights.rolePenalty.toFixed(2)} />
                </div>
                {insights.duelStats.knownDuels > 0 && (
                  <p className="mb-duel-hint">
                    Historial cruzado: {insights.duelStats.whitePct.toFixed(0)}% victorias blanco en duelos previos
                  </p>
                )}
              </div>
            </details>
          )}
        </StepCard>

        {/* ── STEP 3: Result ── */}
        <StepCard
          number={3}
          title="Resultado"
          subtitle="Marcador y ganador (opcional)"
          done={!!mb.winner || (mb.scoreWhite !== '' && mb.scoreBlack !== '')}
          disabled={!teamsReady}
        >
          <div className="mb-score-row">
            <div className="mb-score-team">
              <span className="mb-score-label white">Blanco</span>
              <input
                type="number" min="0" max="30"
                value={mb.scoreWhite}
                onChange={e => mb.setScoreWhite(e.target.value)}
                placeholder="0"
                className="mb-score-input"
              />
            </div>
            <span className="mb-score-divider">—</span>
            <div className="mb-score-team">
              <span className="mb-score-label black">Negro</span>
              <input
                type="number" min="0" max="30"
                value={mb.scoreBlack}
                onChange={e => mb.setScoreBlack(e.target.value)}
                placeholder="0"
                className="mb-score-input"
              />
            </div>
          </div>

          <div className="mb-winner-row">
            {[
              { key: 'white', label: 'Blanco', icon: null },
              { key: 'tie', label: 'Empate', icon: 'users' },
              { key: 'black', label: 'Negro', icon: null },
            ].map(opt => (
              <button
                key={opt.key}
                className={`mb-winner-btn ${opt.key} ${mb.winner === opt.key ? 'active' : ''}`}
                onClick={() => mb.setWinner(mb.winner === opt.key ? '' : opt.key)}
              >
                {opt.icon ? <AppIcon name={opt.icon} size={13} /> : <span className={`team-badge ${opt.key}`}></span>}
                {opt.label}
              </button>
            ))}
          </div>
          {!mb.winner && !mb.scoreWhite && !mb.scoreBlack && (
            <p className="mb-result-hint">Déjalo vacío para que los jugadores puedan hacer predicciones.</p>
          )}
        </StepCard>

        {/* ── SAVE BAR ── */}
        <div className="mb-save-bar">
          {mb.editingMatchId && (
            <button className="mb-save-cancel" onClick={mb.resetMatchForm}>Cancelar</button>
          )}
          <button className="mb-save-btn" onClick={handleSave} disabled={!canSave || mb.saving}>
            {mb.saving
              ? 'Guardando...'
              : mb.editingMatchId
                ? 'Actualizar partido'
                : 'Guardar partido'}
          </button>
        </div>
      </div>

      {/* TV Board */}
      {mb.showTvBoard && <TvBoardOverlay mb={mb} getPlayerName={getPlayerName} />}

      {/* Poll Modal */}
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

/* ── Team Column (assignment + positions) ── */
function TeamColumn({
  label, team, teamPlayers, teamSize, selectedPlayers,
  otherTeam, matchPositions, onToggle, onPositionChange,
  positionOptions, getPlayerName, insights,
}) {
  const unassigned = selectedPlayers.filter(pid => !teamPlayers.includes(pid) && !otherTeam.includes(pid))

  return (
    <div className={`mb-team-col ${team}`}>
      <div className="mb-team-head">
        <span className={`team-badge ${team}`}></span>
        <span className="mb-team-title">{label}</span>
        <span className="mb-team-count">{teamPlayers.length}/{teamSize}</span>
      </div>

      {/* Assigned players with positions */}
      <div className="mb-team-roster">
        {teamPlayers.map(pid => (
          <div key={pid} className="mb-roster-row">
            <button className="mb-roster-remove" onClick={() => onToggle(pid, team)} title="Quitar del equipo">×</button>
            <span className="mb-roster-name">{getPlayerName(pid)}</span>
            <select
              className="mb-roster-pos"
              value={matchPositions[pid] || ''}
              onChange={e => onPositionChange(pid, e.target.value)}
            >
              {positionOptions.map(opt => (
                <option key={opt.value || 'none'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        ))}
        {teamPlayers.length === 0 && (
          <p className="mb-team-empty">Toca jugadores abajo para agregar</p>
        )}
      </div>

      {/* Available (unassigned) players */}
      {unassigned.length > 0 && teamPlayers.length < teamSize && (
        <div className="mb-team-available">
          {unassigned.map(pid => (
            <button key={pid} className="mb-avail-chip" onClick={() => onToggle(pid, team)}>
              + {getPlayerName(pid)}
            </button>
          ))}
        </div>
      )}

      {/* Mini stats under the team */}
      {teamPlayers.length > 0 && (
        <div className="mb-team-mini-stats">
          <span>WR {insights.avgWinRate.toFixed(0)}%</span>
          <span>Rtg {insights.avgRating.toFixed(1)}</span>
          <span>Quím {insights.chemistry.score.toFixed(0)}%</span>
        </div>
      )}
    </div>
  )
}

/* ── Compare Card (advanced) ── */
function CompareCard({ team, tone, data }) {
  const rows = [
    { label: 'Win Rate', value: `${data.avgWinRate.toFixed(1)}%` },
    { label: 'Rating', value: data.avgRating.toFixed(2) },
    { label: 'MVPs', value: data.avgMvps.toFixed(1) },
    { label: 'Partidos', value: data.avgPlayed.toFixed(0) },
    { label: 'Química', value: `${data.chemistry.score.toFixed(0)}%` },
  ]
  const missing = data.missingRoles || []

  return (
    <div className={`mb-compare-card ${tone}`}>
      <h4>{team}</h4>
      {rows.map(r => (
        <div key={r.label} className="mb-compare-row">
          <span>{r.label}</span><strong>{r.value}</strong>
        </div>
      ))}
      {missing.length > 0 && (
        <div className="mb-compare-missing">
          Falta: {missing.join(', ')}
        </div>
      )}
    </div>
  )
}

/* ── Mini KPI ── */
function MiniKpi({ label, value }) {
  return (
    <div className="mb-mini-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
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
    try {
      await deleteDoc(doc(db, 'matches', pollId))
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(null)
    }
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
                {winner && total > 0 && (
                  <span className="ap-leading">Lidera: Opción {winner.idx + 1}</span>
                )}
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
                              {opt.teamWhite?.map(pid => (
                                <span key={pid} className="ap-player">{poll.playerNames?.[pid] || getPlayerName(pid)}</span>
                              ))}
                            </div>
                            <div className="ap-team-mini">
                              <span className="team-badge black"></span>
                              {opt.teamBlack?.map(pid => (
                                <span key={pid} className="ap-player">{poll.playerNames?.[pid] || getPlayerName(pid)}</span>
                              ))}
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
                    <button className="ap-btn whatsapp" onClick={() => handleShare(poll)}>
                      WhatsApp
                    </button>
                    <button
                      className="ap-btn delete"
                      onClick={() => handleDelete(poll.id)}
                      disabled={deleting === poll.id}
                    >
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
  } catch {
    return dateStr
  }
}

/* ── Poll Modal ── */
function PollModal({
  options, pollLink, creatingPoll, copiedLink, getPlayerName,
  onClose, onRegenerate, onCreatePoll, onCopyLink, onShareWhatsApp, onApplyOption,
}) {
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
                <button className="poll-copy-btn" onClick={onCopyLink}>
                  {copiedLink ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <button className="poll-whatsapp-btn" onClick={onShareWhatsApp}>
                Compartir en WhatsApp
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
