/**
 * Home Tab — "Hoy"
 * Landing screen: what you have to do right now (next match, open prediction,
 * pending ratings) before any table of numbers.
 */
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../contexts'
import { AppIcon, AvatarImage } from '../common'
import { computeStatsFromMatches } from '../../hooks/useStats'
import { getMatchStartDate, getPositionLabel, isMatchPlayed } from '../../utils/matchConstants'

const DAY_MS = 24 * 60 * 60 * 1000

const COIN_REWARDS = { played: 5, win: 8, mvp: 12, ratedMatch: 4 }

const formatMatchDate = dateStr => {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T12:00:00`)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
}

const formatShortDate = dateStr => {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T12:00:00`)
  if (isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

const formatCountdown = (start, now) => {
  if (!start) return null
  const diff = start.getTime() - now
  if (diff <= 0) {
    // Kick-off has passed. For a few hours it is plausibly being played; after
    // that the match is simply waiting for someone to load its result.
    return diff > -3 * 60 * 60 * 1000 ? 'En juego' : 'Sin resultado aún'
  }
  const days = Math.floor(diff / DAY_MS)
  const hours = Math.floor((diff % DAY_MS) / (60 * 60 * 1000))
  const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  if (days > 0) return `en ${days} d ${hours} h`
  if (hours > 0) return `en ${hours} h ${minutes} min`
  return `en ${Math.max(minutes, 1)} min`
}

export const HomeTab = ({
  onOpenRatingModal,
  onOpenPrediction,
  onOpenProfile,
  onGoToMatches,
  canPredictMatch,
  announcements = [],
  rankingMovers = null,
}) => {
  const {
    players,
    matches,
    ratings,
    predictions,
    user,
    userPlayer,
    handleGoogleLogin,
    getPlayerName,
    getPlayerPhoto,
  } = useApp()

  // A single clock for every countdown on the screen. 30s is enough resolution
  // for a "en 2 h 15 min" label and avoids a re-render every second.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])

  // ── Next match ────────────────────────────────────────────────────────────
  const upcomingMatch = useMemo(() => {
    const pending = matches
      .filter(m => !isMatchPlayed(m) && m.teamWhite?.length && m.teamBlack?.length)
      .map(m => ({ match: m, start: getMatchStartDate(m) }))
      .filter(entry => entry.start)

    if (pending.length === 0) return null

    const future = pending
      .filter(entry => entry.start.getTime() >= now)
      .sort((a, b) => a.start - b.start)
    if (future.length > 0) return future[0].match

    // Nothing in the future: surface the most recent pending one, which is the
    // match that is either being played or still waiting for its result.
    return pending.sort((a, b) => b.start - a.start)[0].match
  }, [matches, now])

  const upcomingStart = upcomingMatch ? getMatchStartDate(upcomingMatch) : null
  const countdown = formatCountdown(upcomingStart, now)

  const myTeam = useMemo(() => {
    if (!upcomingMatch || !userPlayer) return null
    if (upcomingMatch.teamWhite?.includes(userPlayer)) return 'white'
    if (upcomingMatch.teamBlack?.includes(userPlayer)) return 'black'
    return null
  }, [upcomingMatch, userPlayer])

  const myPosition = upcomingMatch && userPlayer ? getPositionLabel(upcomingMatch.positions?.[userPlayer] || '') : ''

  const myPrediction = upcomingMatch && user ? predictions?.[upcomingMatch.id]?.[user.uid] : null
  const predictionsOpen = upcomingMatch ? (canPredictMatch ? canPredictMatch(upcomingMatch) : true) : false
  const predictionCount = upcomingMatch ? Object.keys(predictions?.[upcomingMatch.id] || {}).length : 0

  // ── Pending ratings ───────────────────────────────────────────────────────
  const pendingRatings = useMemo(() => {
    if (!user || !userPlayer) return []
    return matches
      .filter(match => {
        const all = [...(match.teamWhite || []), ...(match.teamBlack || [])]
        if (!all.includes(userPlayer)) return false
        if (match.ratingsOpen === false) return false
        if (!isMatchPlayed(match)) return false
        const hasRated = Object.values(ratings || {}).some(playerRatings =>
          playerRatings.some(
            r => (r.ratedBy === userPlayer || r.odedBy === userPlayer) && r.matchId === match.id
          )
        )
        return !hasRated
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [matches, ratings, user, userPlayer])

  // ── Your week ─────────────────────────────────────────────────────────────
  // Keyed on the calendar day rather than the 30s clock, so the whole ranking
  // is not recomputed twice a minute.
  const dayKey = useMemo(() => new Date(now).toDateString(), [now])

  const weekSummary = useMemo(() => {
    if (!userPlayer) return null

    const startOfToday = new Date(dayKey)
    startOfToday.setHours(0, 0, 0, 0)
    const since = startOfToday.getTime() - 6 * DAY_MS

    const weekMatches = matches.filter(m => {
      const start = getMatchStartDate(m)
      return start && start.getTime() >= since && isMatchPlayed(m)
    })

    const weekStats = computeStatsFromMatches(players, weekMatches, ratings, {
      scopeRatingsToMatches: true,
    })
    const mine = weekStats.find(s => s.id === userPlayer)

    // Current streak across the whole history, not just this week.
    const myHistory = matches
      .filter(m => {
        const all = [...(m.teamWhite || []), ...(m.teamBlack || [])]
        return all.includes(userPlayer) && ['white', 'black', 'tie'].includes(m.winner)
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))

    let streakCount = 0
    let streakType = null
    for (let i = myHistory.length - 1; i >= 0; i -= 1) {
      const match = myHistory[i]
      const inWhite = match.teamWhite?.includes(userPlayer)
      const result =
        match.winner === 'tie' ? 'e' : (inWhite && match.winner === 'white') || (!inWhite && match.winner === 'black') ? 'v' : 'd'
      if (streakType === null) {
        streakType = result
        streakCount = 1
      } else if (result === streakType) {
        streakCount += 1
      } else {
        break
      }
    }

    const weekMatchIds = new Set(weekMatches.map(m => m.id))
    const ratedThisWeek = new Set()
    Object.values(ratings || {}).forEach(playerRatings => {
      playerRatings.forEach(r => {
        if ((r.ratedBy === userPlayer || r.odedBy === userPlayer) && weekMatchIds.has(r.matchId)) {
          ratedThisWeek.add(r.matchId)
        }
      })
    })

    const coins = mine
      ? mine.played * COIN_REWARDS.played +
        mine.wins * COIN_REWARDS.win +
        mine.mvps * COIN_REWARDS.mvp +
        ratedThisWeek.size * COIN_REWARDS.ratedMatch
      : ratedThisWeek.size * COIN_REWARDS.ratedMatch

    return {
      played: mine?.played || 0,
      winRate: mine ? Math.round(mine.winRate) : null,
      rating: mine?.avgRating || null,
      coins,
      streakCount,
      streakType,
    }
  }, [players, matches, ratings, userPlayer, dayKey])

  // ── Ranking movement (computed once in useStats, shared from App) ─────────
  const lastMatch = rankingMovers?.lastMatch || null
  // A match is zero-sum on the table, so "the three biggest shifts" tends to be
  // three players who dropped. Show both directions instead.
  const movers = useMemo(() => {
    const all = rankingMovers?.movers || []
    const risers = all.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 2)
    const fallers = all.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 2)
    return [...risers, ...fallers]
  }, [rankingMovers])

  const announcement = announcements?.[0] || null

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="stats-section home-section">
      {announcement && (
        <div className="user-announcement">
          <div className="user-announcement-icon"><AppIcon name="info" size={16} /></div>
          <p className="user-announcement-text">{announcement.message}</p>
        </div>
      )}

      {!user && (
        <div className="hm-card hm-signin">
          <div className="hm-signin-text">
            <h3>Entra para jugar</h3>
            <p>Inicia sesión con Google para predecir partidos, calificar a tus compañeros y ganar LukCoins.</p>
          </div>
          <button className="hm-btn hm-btn-primary" onClick={handleGoogleLogin}>Entrar con Google</button>
        </div>
      )}

      {user && !userPlayer && (
        <div className="hm-card hm-signin">
          <div className="hm-signin-text">
            <h3>Falta vincular tu cuenta</h3>
            <p>Un admin tiene que vincularte con tu jugador para que puedas predecir y calificar.</p>
          </div>
        </div>
      )}

      {/* ── Próximo partido ── */}
      {upcomingMatch ? (
        <div className="hm-card hm-next">
          <div className="hm-next-head">
            <span className="hm-eyebrow">Próximo partido</span>
            {countdown && <span className="hm-countdown">{countdown}</span>}
          </div>

          <div className="hm-next-body">
            <div className="hm-next-meta">
              <span className="hm-next-date">{formatMatchDate(upcomingMatch.date)}</span>
              {upcomingMatch.time && <><span aria-hidden="true">·</span><span>{upcomingMatch.time}</span></>}
              {upcomingMatch.venue && <><span aria-hidden="true">·</span><span>{upcomingMatch.venue}</span></>}
              {upcomingMatch.format && <><span aria-hidden="true">·</span><span>{upcomingMatch.format}</span></>}
            </div>

            <div className="hm-fixture">
              <div className="hm-team">
                <span className="hm-team-dot white" />
                <span className="hm-team-name">Blanco</span>
              </div>
              <span className="hm-vs">VS</span>
              <div className="hm-team right">
                <span className="hm-team-name">Negro</span>
                <span className="hm-team-dot black" />
              </div>
            </div>

            {myTeam && (
              <div className="hm-your-side">
                <span>Juegas en</span>
                <span className={`hm-side-chip ${myTeam}`}>{myTeam === 'white' ? 'Blanco' : 'Negro'}</span>
                {myPosition && <span className="hm-side-pos">· {myPosition}</span>}
              </div>
            )}
          </div>

          {user && userPlayer && (
            <div className="hm-next-action">
              {myPrediction ? (
                <div className="hm-pred-done">
                  <span className="hm-pred-icon" aria-hidden="true">
                    <AppIcon name="check" size={14} />
                  </span>
                  <div className="hm-pred-text">
                    <strong>Predijiste {myPrediction.prediction === 'white' ? 'Blanco' : 'Negro'}</strong>
                    <span>
                      {myPrediction.lukCoinsBet ?? myPrediction.xpBet ?? 0} LC apostadas
                      {predictionCount > 1 ? ` · ${predictionCount} predicciones en total` : ''}
                    </span>
                  </div>
                </div>
              ) : predictionsOpen ? (
                <>
                  <span className="hm-action-label">Tu predicción</span>
                  <div className="hm-pred-picks">
                    <button
                      className="hm-pick-btn"
                      onClick={() => onOpenPrediction?.(upcomingMatch, 'white')}
                    >
                      Gana Blanco
                    </button>
                    <button
                      className="hm-pick-btn"
                      onClick={() => onOpenPrediction?.(upcomingMatch, 'black')}
                    >
                      Gana Negro
                    </button>
                  </div>
                </>
              ) : (
                <p className="hm-muted-note">Las predicciones se cierran 10 minutos antes del partido.</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="hm-card hm-empty-next">
          <div className="hm-empty-icon" aria-hidden="true"><AppIcon name="ball" size={20} /></div>
          <div>
            <h3>Sin partido programado</h3>
            <p>Cuando un admin cree el próximo partido, aparecerá aquí para que puedas predecir.</p>
          </div>
        </div>
      )}

      {/* ── Pendientes ── */}
      {user && userPlayer && (
        pendingRatings.length > 0 ? (
          <div className="hm-card hm-pending">
            <div className="hm-pending-head">
              <div className="hm-pending-icon" aria-hidden="true">
                <AppIcon name="star" size={18} />
              </div>
              <div className="hm-pending-copy">
                <h3>
                  {pendingRatings.length === 1
                    ? 'Te falta calificar 1 partido'
                    : `Te faltan ${pendingRatings.length} partidos por calificar`}
                </h3>
                <p>Ganas +{COIN_REWARDS.ratedMatch} LC por cada partido que califiques.</p>
              </div>
            </div>
            <ul className="hm-pending-list">
              {pendingRatings.slice(0, 3).map(match => (
                <li key={match.id} className="hm-pending-item">
                  <div className="hm-pending-info">
                    <span className="hm-pending-date">{formatShortDate(match.date)}</span>
                    <span className="hm-pending-venue">{match.venue || 'Partido'}</span>
                  </div>
                  <button className="hm-btn hm-btn-primary hm-btn-sm" onClick={() => onOpenRatingModal?.(match)}>
                    Calificar
                  </button>
                </li>
              ))}
            </ul>
            {pendingRatings.length > 3 && (
              <button className="hm-link-btn" onClick={onGoToMatches}>
                Ver los {pendingRatings.length} partidos
              </button>
            )}
          </div>
        ) : (
          <div className="hm-card hm-allclear">
            <div className="hm-allclear-icon" aria-hidden="true"><AppIcon name="check" size={18} /></div>
            <div>
              <h3>Estás al día</h3>
              <p>No tienes calificaciones pendientes.</p>
            </div>
          </div>
        )
      )}

      {/* ── Tu semana ── */}
      {user && userPlayer && weekSummary && (
        <div className="hm-block">
          <h3 className="section-title">Tu semana</h3>
          <div className="hm-kpis">
            <div className="hm-kpi">
              <span className={`hm-kpi-value ${weekSummary.streakType === 'v' ? 'good' : weekSummary.streakType === 'd' ? 'bad' : ''}`}>
                {weekSummary.streakCount || '—'}
              </span>
              <span className="hm-kpi-label">
                {weekSummary.streakType === 'v' ? 'Racha V' : weekSummary.streakType === 'd' ? 'Racha D' : 'Racha'}
              </span>
            </div>
            <div className="hm-kpi">
              <span className="hm-kpi-value">{weekSummary.winRate !== null ? `${weekSummary.winRate}%` : '—'}</span>
              <span className="hm-kpi-label">WR 7d</span>
            </div>
            <div className="hm-kpi">
              <span className={`hm-kpi-value ${weekSummary.rating && parseFloat(weekSummary.rating) >= 7.5 ? 'good' : ''}`}>
                {weekSummary.rating || '—'}
              </span>
              <span className="hm-kpi-label">Rating</span>
            </div>
            <div className="hm-kpi">
              <span className="hm-kpi-value coin">{weekSummary.coins > 0 ? `+${weekSummary.coins}` : '—'}</span>
              <span className="hm-kpi-label">LukCoins</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Movimientos del ranking ── */}
      {movers.length > 0 && (
        <div className="hm-block">
          <div className="hm-block-head">
            <h3 className="section-title">Se movió el ranking</h3>
            {lastMatch && <span className="hm-block-note">tras el {formatShortDate(lastMatch.date)}</span>}
          </div>
          <div className="hm-movers">
            {movers.map(mover => (
              <button
                key={mover.id}
                className="hm-mover"
                onClick={() => onOpenProfile?.(mover.id)}
              >
                <span className="hm-mover-pos">{mover.position}</span>
                <AvatarImage
                  src={getPlayerPhoto(mover.id)}
                  name={getPlayerName(mover.id)}
                  imgClassName="hm-mover-avatar"
                  fallbackClassName="hm-mover-avatar-ph"
                />
                <div className="hm-mover-info">
                  <span className="hm-mover-name">{mover.name}</span>
                  <span className="hm-mover-note">
                    {mover.avgRating ? `${mover.avgRating} ★ de promedio` : 'sin calificaciones aún'}
                  </span>
                </div>
                <span className={`hm-mover-delta ${mover.delta > 0 ? 'up' : 'down'}`}>
                  {mover.delta > 0 ? `+${mover.delta}` : mover.delta}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default HomeTab
