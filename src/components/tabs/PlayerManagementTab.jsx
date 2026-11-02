import { useMemo, useState } from 'react'

import '../../styles/player-management.css'
import '../../styles/players.css'
import { AvatarImage } from '../common/AvatarImage'

const FILTERS = [
  ['active', 'Activos'],
  ['archived', 'Archivados'],
  ['all', 'Todos'],
]

const normalize = value =>
  String(value || '')
    .trim()
    .toLowerCase()

const accountName = ([userId, link]) =>
  link?.userName || link?.odedByName || link?.userEmail || link?.odedByEmail || userId

const playerSearchText = player => normalize([player.name, ...(player.aliases || [])].join(' '))

const matchIncludesPlayer = (match, playerId) =>
  match?.teamWhite?.includes(playerId) || match?.teamBlack?.includes(playerId)

const getPlayerName = (players, playerId) =>
  players.find(player => player.id === playerId)?.name || 'Jugador desconocido'

const matchLabel = match =>
  [match?.date, match?.time, match?.venue || match?.location || match?.id]
    .filter(Boolean)
    .join(' - ') || 'Partido sin fecha'

const getPlayerSummary = ({ playerId, matches, ratings, links }) => {
  const affectedMatches = matches.filter(match => matchIncludesPlayer(match, playerId))
  const receivedRatings = ratings[playerId] || []
  const givenRatings = Object.values(ratings)
    .flat()
    .filter(rating => rating.ratedBy === playerId)
  const linkedAccounts = links.filter(([, link]) => link?.playerId === playerId)

  return {
    affectedMatches,
    givenRatings,
    linkedAccounts,
    receivedRatings,
  }
}

const getMergePreview = ({ sourceId, targetId, matches, ratings, userLinks }) => {
  if (!sourceId || !targetId || sourceId === targetId) return null

  const links = Object.entries(userLinks || {})
  const source = getPlayerSummary({ playerId: sourceId, matches, ratings, links })
  const target = getPlayerSummary({ playerId: targetId, matches, ratings, links })
  const sourceMatchIds = new Set(source.affectedMatches.map(match => match.id))
  const targetMatchIds = new Set(target.affectedMatches.map(match => match.id))
  const sharedMatchIds = [...sourceMatchIds].filter(matchId => targetMatchIds.has(matchId))
  const targetReceivedKeys = new Set(
    target.receivedRatings.map(rating => `${rating.matchId}:${rating.ratedBy}`)
  )
  const duplicateReceivedRatings = source.receivedRatings.filter(rating =>
    targetReceivedKeys.has(`${rating.matchId}:${rating.ratedBy}`)
  )

  return {
    accounts: source.linkedAccounts.length,
    accountNames: source.linkedAccounts.map(accountName),
    conflicts: [
      ...(sharedMatchIds.length
        ? [
            `Ambos jugadores aparecen en ${sharedMatchIds.length} partidos existentes: ${sharedMatchIds
              .slice(0, 4)
              .join(', ')}${sharedMatchIds.length > 4 ? ' y más' : ''}.`,
          ]
        : []),
      ...(duplicateReceivedRatings.length
        ? [`${duplicateReceivedRatings.length} calificaciones recibidas comparten el mismo partido y calificador.`]
        : []),
      ...(source.linkedAccounts.length && target.linkedAccounts.length
        ? [
            'Ambos jugadores ya tienen cuentas vinculadas. Una fusión real necesitaría revisión de política de cuentas.',
          ]
        : []),
    ],
    givenRatings: source.givenRatings.length,
    matchLabels: source.affectedMatches.slice(0, 5).map(matchLabel),
    matches: source.affectedMatches.length,
    receivedRatings: source.receivedRatings.length,
  }
}

export const PlayerManagementTab = ({
  players = [],
  userLinks = {},
  matches = [],
  ratings = {},
  onEdit,
  onAdd,
  onArchive,
  onRestore,
  getPlayerPhoto,
}) => {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('active')
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')

  const links = useMemo(() => Object.entries(userLinks || {}), [userLinks])
  const linkedByPlayer = useMemo(() => {
    const grouped = new Map()
    links.forEach(entry => {
      const playerId = entry[1]?.playerId
      if (!playerId) return
      grouped.set(playerId, [...(grouped.get(playerId) || []), entry])
    })
    return grouped
  }, [links])

  const rows = useMemo(() => {
    const search = normalize(query)
    return [...players]
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
      .filter(player => {
        const archived = !!player.archived
        if (filter === 'active' && archived) return false
        if (filter === 'archived' && !archived) return false
        if (!search) return true
        return playerSearchText(player).includes(search)
      })
      .map(player => {
        const playerMatches = matches.filter(match => matchIncludesPlayer(match, player.id))
        const receivedRatings = ratings[player.id] || []
        const givenRatings = Object.values(ratings)
          .flat()
          .filter(rating => rating.ratedBy === player.id)
        const linkedAccounts = linkedByPlayer.get(player.id) || []
        return { player, playerMatches, receivedRatings, givenRatings, linkedAccounts }
      })
  }, [filter, linkedByPlayer, matches, players, query, ratings])

  const duplicateLinkedAccounts = useMemo(
    () =>
      players
        .map(player => ({ player, linkedAccounts: linkedByPlayer.get(player.id) || [] }))
        .filter(row => row.linkedAccounts.length > 1),
    [linkedByPlayer, players]
  )

  const mergePreview = getMergePreview({ sourceId, targetId, matches, ratings, userLinks })
  const activePlayers = players.filter(player => !player.archived)
  const archivedPlayers = players.filter(player => player.archived)
  const selectablePlayers = [...players].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''))
  )

  return (
    <section className="pm-root">
      <header className="pm-header">
        <div>
          <span className="pm-eyebrow">Espacio de administración</span>
          <h1>Gestión de jugadores</h1>
          <p>
            Archiva jugadores para quitarlos de la selección activa sin perder partidos,
            calificaciones ni historial de cuentas.
          </p>
        </div>
        <button className="pm-primary" onClick={onAdd}>
          Agregar jugador
        </button>
      </header>

      <div className="pm-summary" aria-label="Resumen del directorio de jugadores">
        <div>
          <span>Activos</span>
          <strong>{activePlayers.length}</strong>
        </div>
        <div>
          <span>Archivados</span>
          <strong>{archivedPlayers.length}</strong>
        </div>
        <div>
          <span>Cuentas vinculadas</span>
          <strong>{links.filter(([, link]) => link?.playerId).length}</strong>
        </div>
      </div>

      {duplicateLinkedAccounts.length > 0 && (
        <section className="pm-warning" aria-label="Cuentas vinculadas duplicadas">
          <h2>Hay cuentas vinculadas duplicadas por revisar</h2>
          {duplicateLinkedAccounts.map(({ player, linkedAccounts }) => (
            <p key={player.id}>
              <strong>{player.name}</strong> está vinculado a{' '}
              {linkedAccounts.map(accountName).join(', ')}.
            </p>
          ))}
        </section>
      )}

      <section className="pm-controls" aria-label="Filtros de jugadores">
        <label className="pm-search">
          <span>Buscar jugadores o alias</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Nombre o alias"
          />
        </label>
        <div className="pm-filter" role="group" aria-label="Filtro de estado del jugador">
          {FILTERS.map(([id, label]) => (
            <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="pm-list" aria-live="polite">
        {rows.length ? (
          rows.map(({ player, playerMatches, receivedRatings, givenRatings, linkedAccounts }) => {
            const archived = !!player.archived
            return (
              <article className={`pm-player ${archived ? 'pm-archived' : ''}`} key={player.id}>
                <AvatarImage
                  src={getPlayerPhoto?.(player.id)}
                  name={player.name}
                  imgClassName="pm-avatar"
                  fallbackClassName="pm-avatar"
                />
                <div className="pm-player-main">
                  <div className="pm-name-row">
                    <h2>{player.name}</h2>
                    <span className={archived ? 'pm-status pm-status-archived' : 'pm-status'}>
                      {archived ? 'Archivado' : 'Activo'}
                    </span>
                  </div>
                  {player.aliases?.length > 0 && (
                    <p className="pm-aliases">Alias: {player.aliases.join(', ')}</p>
                  )}
                  {linkedAccounts.length > 1 && (
                    <p className="pm-duplicate">
                      Varias cuentas vinculadas: {linkedAccounts.map(accountName).join(', ')}
                    </p>
                  )}
                </div>
                <div className="pm-player-meta" aria-label={`Resumen del historial de ${player.name}`}>
                  <span>{playerMatches.length} partidos</span>
                  <span>{receivedRatings.length} calificaciones recibidas</span>
                  <span>{givenRatings.length} calificaciones dadas</span>
                  <span>{linkedAccounts.length} cuentas</span>
                </div>
                <div className="pm-actions">
                  <button
                    className="pm-icon-button"
                    onClick={() => onEdit?.(player)}
                    aria-label={`Editar ${player.name}`}
                    title={`Editar ${player.name}`}
                  >
                    Editar
                  </button>
                  {archived ? (
                    <button
                      className="pm-icon-button pm-restore"
                      onClick={() => onRestore?.(player.id, player.name)}
                      aria-label={`Restaurar ${player.name}`}
                      title={`Restaurar ${player.name}`}
                    >
                      Restaurar
                    </button>
                  ) : (
                    <button
                      className="pm-icon-button pm-archive"
                      onClick={() => onArchive?.(player.id, player.name)}
                      aria-label={`Archivar ${player.name}. El historial de partidos y calificaciones se conservará.`}
                      title={`Archivar ${player.name}`}
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </article>
            )
          })
        ) : (
          <div className="pm-empty">
            <h2>No se encontraron jugadores</h2>
            <p>Prueba otra búsqueda o filtro de estado.</p>
          </div>
        )}
      </div>

      <section className="pm-merge">
        <div className="pm-merge-head">
          <div>
            <span className="pm-eyebrow">Solo vista previa</span>
            <h2>Vista previa de fusión de jugadores duplicados</h2>
          </div>
          <p>
            Esta vista solo estima el impacto. No cambia jugadores, partidos, calificaciones ni
            cuentas vinculadas.
          </p>
        </div>
        <div className="pm-merge-controls">
          <label>
            Jugador origen
            <select value={sourceId} onChange={event => setSourceId(event.target.value)}>
              <option value="">Elige origen</option>
              {selectablePlayers.map(player => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Jugador destino
            <select value={targetId} onChange={event => setTargetId(event.target.value)}>
              <option value="">Elige destino</option>
              {selectablePlayers.map(player => (
                <option key={player.id} value={player.id} disabled={player.id === sourceId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {mergePreview ? (
          <div className="pm-preview">
            <div>
              <span>Partidos por revisar</span>
              <strong>{mergePreview.matches}</strong>
            </div>
            <div>
              <span>Calificaciones recibidas</span>
              <strong>{mergePreview.receivedRatings}</strong>
            </div>
            <div>
              <span>Calificaciones dadas</span>
              <strong>{mergePreview.givenRatings}</strong>
            </div>
            <div>
              <span>Cuentas vinculadas</span>
              <strong>{mergePreview.accounts}</strong>
            </div>
            <div className="pm-conflicts">
              <span>Partidos afectados</span>
              {mergePreview.matchLabels.length ? (
                <ul>
                  {mergePreview.matchLabels.map(label => (
                    <li key={label}>{label}</li>
                  ))}
                  {mergePreview.matches > mergePreview.matchLabels.length && (
                    <li>{mergePreview.matches - mergePreview.matchLabels.length} partidos más</li>
                  )}
                </ul>
              ) : (
                <p>Ningún partido referencia al jugador origen.</p>
              )}
            </div>
            <div className="pm-conflicts">
              <span>Cuentas afectadas</span>
              {mergePreview.accountNames.length ? (
                <ul>
                  {mergePreview.accountNames.map(name => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : (
                <p>Ninguna cuenta vinculada referencia al jugador origen.</p>
              )}
            </div>
            <div className="pm-conflicts">
              <span>Conflictos</span>
              {mergePreview.conflicts.length ? (
                <ul>
                  {mergePreview.conflicts.map(conflict => (
                    <li key={conflict}>{conflict}</li>
                  ))}
                </ul>
              ) : (
                <p>No se detectaron conflictos evidentes para esta vista previa.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="pm-muted">
            Elige un origen y un destino diferente para previsualizar una posible limpieza de duplicados.
          </p>
        )}
        {sourceId && targetId && sourceId !== targetId && (
          <p className="pm-muted">
            Previsualizando {getPlayerName(players, sourceId)} hacia {getPlayerName(players, targetId)}.
            Aquí no hay acción de fusión disponible.
          </p>
        )}
      </section>
    </section>
  )
}

export default PlayerManagementTab
