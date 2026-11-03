/**
 * The assistant inside the match builder.
 *
 * It never splits the teams itself: the model returns constraints, the app's
 * own balancer runs them, and what the admin sees is a proposal with a button.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  'Arma sin los que perdieron el domingo',
  '¿Quién debería ir al arco?',
  'Separa a los dos más fuertes',
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
        <p className="as-notice">Aplicada. Puedes deshacerla con el botón de deshacer.</p>
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

/* Lo que se le pide a Claude cuando se pulsa «Armar con Claude». No le
   decimos cómo repartir: le pedimos las condiciones, que es lo único que el
   balanceador no puede deducir solo. */
export const ARM_PROMPT =
  'Arma los equipos de esta convocatoria. Mira el poder de cada uno, las posiciones, ' +
  'quién viene jugando bien y qué parejas funcionan, y devuelve las condiciones del ' +
  'reparto en una acción. Explica en dos o tres frases por qué los armaste así.'

export const BuilderAssistantPanel = ({ mb, open, onOpenChange, armRequest }) => {
  const { players, matches, timeFilter, userPlayer } = useApp()
  const { stats, filteredStats, getFilteredMatches } = useStats()
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

  const fallbackToBalancer = useCallback(() => {
    mb.suggestBalancedTeams({ preserveLockedCaptains: mb.preserveCaptains })
  }, [mb])

  /* «Armar con Claude»: una petición con un identificador que sube de número,
     para distinguir dos pulsaciones seguidas. */
  const servedRef = useRef(0)
  const awaitingArmRef = useRef(false)

  useEffect(() => {
    if (!armRequest || armRequest.id === servedRef.current) return
    servedRef.current = armRequest.id

    /* Si no hay cupo o la conversación llegó al tope, no dejamos al admin sin
       equipos: reparte el balanceador, que es lo que haría el otro botón. */
    if (assistant.quotaExhausted || assistant.turnLimitReached) {
      fallbackToBalancer()
      return
    }
    awaitingArmRef.current = true
    onOpenChange(true)
    assistant.ask(ARM_PROMPT, { display: 'Arma los equipos' })
  }, [armRequest, assistant, fallbackToBalancer, onOpenChange])

  /* La respuesta a ese botón se aplica sola: el admin pidió equipos, no una
     propuesta que después tenga que aceptar. */
  useEffect(() => {
    if (!awaitingArmRef.current || assistant.loading) return

    if (assistant.error) {
      awaitingArmRef.current = false
      fallbackToBalancer()
      return
    }

    const last = assistant.messages.at(-1)
    if (!last || last.role !== 'assistant') return
    awaitingArmRef.current = false

    const applied = last.accion ? mb.applyAssistantAction(last.accion) : { ok: false }
    if (!applied.ok) fallbackToBalancer()
  }, [assistant.messages, assistant.loading, assistant.error, mb, fallbackToBalancer])

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
        ? 'Pídele que explique o que re-arme'
        : `Convoca ${mb.requiredPlayers} jugadores para pedir cambios`,
    [mb.selectedPlayers.length, mb.requiredPlayers]
  )

  return (
    <div className="mb-assistant">
      <button type="button" className="mb-assistant-toggle" onClick={() => onOpenChange(true)}>
        <span>Pregúntale a Lucato</span>
        <span className="mb-assistant-hint">{hint}</span>
      </button>

      <AssistantSheet
        open={open}
        onClose={() => onOpenChange(false)}
        emptyHint="Pídele que explique el reparto, que lo rehaga con condiciones, o que cambie a alguien. Los equipos los calcula el balanceador; Lucato decide las condiciones."

        title="Lucato · armado"
        placeholder="Arma sin los que faltaron…"
        chips={CHIPS}
        assistant={assistant}
        renderAction={renderActionIfPending}
      />
    </div>
  )
}

export default BuilderAssistantPanel
