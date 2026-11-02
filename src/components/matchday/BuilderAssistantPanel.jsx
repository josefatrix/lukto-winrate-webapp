/**
 * The assistant inside the match builder.
 *
 * It never splits the teams itself: the model returns constraints, the app's
 * own balancer runs them, and what the admin sees is a proposal with a button.
 */
import { useCallback, useMemo, useState } from 'react'

import { useApp } from '../../contexts'
import { useAiAssistant, useStats } from '../../hooks'
import { AssistantSheet } from '../common'
import {
  buildBuilderFacts,
  buildStatsFacts,
  validateAssistantAction,
} from '../../utils/assistantFacts'

const CHIPS = [
  '¿Por qué está desbalanceado?',
  'Armá sin los que perdieron el domingo',
  '¿Quién debería ir al arco?',
  'Separá a los dos más fuertes',
]

const listNames = (ids, nameOf) => ids.map(nameOf).join(', ')

const ProposalCard = ({ accion, nameOf, onApply, onDiscard, applied, failure }) => {
  const changes = []
  if (accion.excluir.length) changes.push(`Sacar a ${listNames(accion.excluir, nameOf)}`)
  if (accion.incluir.length) changes.push(`Llamar a ${listNames(accion.incluir, nameOf)}`)
  if (accion.fijarBlanco.length) changes.push(`Blanco fijo: ${listNames(accion.fijarBlanco, nameOf)}`)
  if (accion.fijarNegro.length) changes.push(`Negro fijo: ${listNames(accion.fijarNegro, nameOf)}`)
  for (const [a, b] of accion.juntar) changes.push(`Juntar a ${nameOf(a)} y ${nameOf(b)}`)
  for (const [a, b] of accion.separar) changes.push(`Separar a ${nameOf(a)} y ${nameOf(b)}`)
  for (const [id, position] of Object.entries(accion.posiciones))
    changes.push(`${nameOf(id)} de ${position}`)
  if (accion.swap) changes.push(`Cambiar ${nameOf(accion.swap.blanco)} ↔ ${nameOf(accion.swap.negro)}`)

  if (!changes.length) return null

  return (
    <div className="as-proposal">
      <p className="as-proposal-title">Propuesta</p>
      <ul>
        {changes.map(change => (
          <li key={change}>{change}</li>
        ))}
      </ul>
      {failure && <p className="as-action-error">{failure}</p>}
      {applied ? (
        <p className="as-notice">Aplicada. Podés deshacerla con el botón de deshacer.</p>
      ) : (
        <div className="as-proposal-buttons">
          <button type="button" className="as-apply" onClick={onApply}>
            Aplicar
          </button>
          <button type="button" className="as-discard" onClick={onDiscard}>
            Descartar
          </button>
        </div>
      )}
    </div>
  )
}

export const BuilderAssistantPanel = ({ mb }) => {
  const { players, matches, timeFilter, userPlayer } = useApp()
  const { stats, filteredStats, getFilteredMatches } = useStats()
  const [open, setOpen] = useState(false)
  const [resolved, setResolved] = useState({})

  const nameOf = useCallback(
    id => players.find(player => player.id === id)?.name || id,
    [players]
  )

  const buildFacts = useCallback(() => {
    const displayStats = timeFilter === 'all' ? stats : filteredStats
    const statsFacts = buildStatsFacts({
      players,
      displayStats,
      matches: timeFilter === 'all' ? matches : getFilteredMatches,
      allMatches: matches,
      timeFilter,
      userPlayerId: userPlayer,
    })
    return buildBuilderFacts(statsFacts, {
      players,
      matchFormat: mb.matchFormat,
      teamSize: mb.teamSize,
      requiredPlayers: mb.requiredPlayers,
      selectedPlayers: mb.selectedPlayers,
      playerPowerMap: mb.playerPowerMap,
      matchPositions: mb.matchPositions,
      liveDraftInsights: mb.liveDraftInsights,
      teamWhite: mb.teamWhite,
      teamBlack: mb.teamBlack,
    })
  }, [players, matches, timeFilter, userPlayer, stats, filteredStats, getFilteredMatches, mb])

  const validateAction = useCallback(
    accion =>
      validateAssistantAction(accion, {
        players,
        selectedPlayers: mb.selectedPlayers,
        requiredPlayers: mb.requiredPlayers,
        teamSize: mb.teamSize,
        teamWhite: mb.teamWhite,
        teamBlack: mb.teamBlack,
      }),
    [players, mb.selectedPlayers, mb.requiredPlayers, mb.teamSize, mb.teamWhite, mb.teamBlack]
  )

  const assistant = useAiAssistant({ mode: 'builder', buildFacts, validateAction })

  /* Keyed by conversation as well as index: "Empezar de nuevo" reuses the
     indexes, and without this the first answer of a new conversation inherits
     the previous one's "Aplicada" and loses its Apply button. */
  const keyFor = useCallback(
    index => `${assistant.conversationId}:${index}`,
    [assistant.conversationId]
  )

  const renderActionIfPending = useCallback(
    (accion, index) => {
      const key = keyFor(index)
      const state = resolved[key]
      if (state === 'discarded') return <p className="as-notice">Propuesta descartada.</p>

      return (
        <ProposalCard
          accion={accion}
          nameOf={nameOf}
          applied={state === 'applied'}
          failure={state?.startsWith?.('error:') ? state.slice(6) : ''}
          onApply={() => {
            /* Re-checked here, not only when the answer arrived: the admin can
               move players around while the model is thinking, and a swap that
               keeps the headcount would otherwise drop a constraint silently. */
            const recheck = validateAction(accion)
            const result = recheck.ok
              ? mb.applyAssistantAction(recheck.accion)
              : { ok: false, reason: `La convocatoria cambió: ${recheck.reason}` }
            setResolved(current => ({
              ...current,
              [key]: result.ok ? 'applied' : `error:${result.reason}`,
            }))
          }}
          onDiscard={() => setResolved(current => ({ ...current, [key]: 'discarded' }))}
        />
      )
    },
    [keyFor, nameOf, resolved, mb, validateAction]
  )

  const hint = useMemo(
    () =>
      mb.selectedPlayers.length === mb.requiredPlayers
        ? 'Pedile que explique o que re-arme'
        : `Convocá ${mb.requiredPlayers} jugadores para pedir cambios`,
    [mb.selectedPlayers.length, mb.requiredPlayers]
  )

  return (
    <div className="mb-assistant">
      <button type="button" className="mb-assistant-toggle" onClick={() => setOpen(true)}>
        <span>Preguntale a Claude</span>
        <span className="mb-assistant-hint">{hint}</span>
      </button>

      <AssistantSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Asistente del armado"
        placeholder="Armá sin los que faltaron…"
        chips={CHIPS}
        assistant={assistant}
        renderAction={renderActionIfPending}
      />
    </div>
  )
}

export default BuilderAssistantPanel
