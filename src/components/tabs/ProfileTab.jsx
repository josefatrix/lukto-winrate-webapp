/**
 * Profile Tab
 * Your own profile as a real screen, plus a quick player switcher to inspect
 * any player's full scouting card.
 */
import { useState, useEffect } from 'react'
import { useApp } from '../../contexts'
import { PlayerProfileModal, AvatarImage } from '../common'

export const ProfileTab = ({
  players = [],
  stats = [],
  matches,
  ratings,
  predictions,
  userLinks,
  positionAnalytics,
  getPlayerPhoto,
  getPlayerName,
  calculateXP,
  getRank,
}) => {
  const { user, userPlayer, handleGoogleLogin } = useApp()

  // Default to the logged-in user's linked player, or #1 in ranking
  const defaultPlayerId = userPlayer || stats?.[0]?.id || players?.[0]?.id || null
  const [selectedId, setSelectedId] = useState(defaultPlayerId)

  useEffect(() => {
    if (userPlayer) {
      setSelectedId(userPlayer)
    } else if (!selectedId && (stats?.[0]?.id || players?.[0]?.id)) {
      setSelectedId(stats?.[0]?.id || players?.[0]?.id)
    }
  }, [userPlayer, stats, players, selectedId])

  const activePlayerId = selectedId || defaultPlayerId

  // Order players by ranking position first
  const orderedPlayers = stats?.length > 0
    ? [...stats]
        .sort((a, b) => (parseFloat(b.rankingScore) || 0) - (parseFloat(a.rankingScore) || 0))
        .map(s => players.find(p => p.id === s.id))
        .filter(Boolean)
    : players

  return (
    <section className="stats-section profile-tab">
      {!user && (
        <div className="hm-card hm-signin profile-account-banner">
          <div className="hm-signin-text">
            <h3>Inicia sesión para vincular tu perfil</h3>
            <p>Conecta tu cuenta de Google para destacar tus estadísticas, predicciones y logros personales.</p>
          </div>
          <button className="hm-btn hm-btn-primary" onClick={handleGoogleLogin}>Entrar con Google</button>
        </div>
      )}

      {user && !userPlayer && (
        <div className="hm-card hm-signin profile-account-banner">
          <div className="hm-signin-text">
            <h3>Cuenta pendiente de vincular</h3>
            <p>Un administrador puede vincular tu cuenta con tu jugador. Mientras tanto, puedes explorar cualquier perfil abajo.</p>
          </div>
        </div>
      )}

      {orderedPlayers.length > 1 && (
        <div className="profile-switcher-bar" aria-label="Seleccionar jugador">
          <div className="profile-switcher-head">
            <span className="profile-switcher-label">Explorar jugador</span>
            {userPlayer && selectedId !== userPlayer && (
              <button
                type="button"
                className="profile-switcher-me-btn"
                onClick={() => setSelectedId(userPlayer)}
              >
                Volver a mi perfil
              </button>
            )}
          </div>
          <div className="profile-switcher-Row">
            {orderedPlayers.map((p, idx) => {
              const isSelected = p.id === activePlayerId
              const isMe = userPlayer && p.id === userPlayer
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`profile-switcher-chip ${isSelected ? 'active' : ''} ${isMe ? 'is-me' : ''}`}
                  onClick={() => setSelectedId(p.id)}
                >
                  <span className="psc-pos">#{idx + 1}</span>
                  <AvatarImage
                    src={getPlayerPhoto(p.id)}
                    name={p.name}
                    imgClassName="psc-avatar"
                    fallbackClassName="psc-avatar-ph"
                  />
                  <span className="psc-name">{p.name.split(' ')[0]}</span>
                  {isMe && <span className="psc-you">Tú</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {activePlayerId && (
        <PlayerProfileModal
          asPage
          show
          playerId={activePlayerId}
          onClose={() => {}}
          players={players}
          stats={stats}
          matches={matches}
          ratings={ratings}
          predictions={predictions}
          userLinks={userLinks}
          positionAnalytics={positionAnalytics}
          getPlayerPhoto={getPlayerPhoto}
          getPlayerName={getPlayerName}
          calculateXP={calculateXP}
          getRank={getRank}
        />
      )}
    </section>
  )
}

export default ProfileTab
