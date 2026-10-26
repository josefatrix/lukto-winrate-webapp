/**
 * Profile Tab
 * Your own profile as a real screen instead of a modal.
 */
import { useApp } from '../../contexts'
import { PlayerProfileModal } from '../common'

export const ProfileTab = ({
  players,
  stats,
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

  if (!user) {
    return (
      <section className="stats-section">
        <div className="hm-card hm-signin">
          <div className="hm-signin-text">
            <h3>Entra para ver tu perfil</h3>
            <p>Inicia sesión con Google para ver tus estadísticas y tus logros.</p>
          </div>
          <button className="hm-btn hm-btn-primary" onClick={handleGoogleLogin}>Entrar con Google</button>
        </div>
      </section>
    )
  }

  if (!userPlayer) {
    return (
      <section className="stats-section">
        <div className="hm-card hm-signin">
          <div className="hm-signin-text">
            <h3>Falta vincular tu cuenta</h3>
            <p>Un admin tiene que vincularte con tu jugador para que tu perfil tenga estadísticas.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="stats-section profile-tab">
      <PlayerProfileModal
          asPage
          show
          playerId={userPlayer}
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
    </section>
  )
}

export default ProfileTab
