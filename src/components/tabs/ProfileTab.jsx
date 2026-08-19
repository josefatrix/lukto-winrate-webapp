/**
 * Profile Tab
 * Your own profile as a real screen instead of a modal, with the store — which
 * already existed but was never mounted — reachable right next to the LukCoins
 * you earn.
 */
import { useState } from 'react'
import { useApp } from '../../contexts'
import { PlayerProfileModal } from '../common'
import { StoreTab } from './StoreTab'

const VIEWS = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'tienda', label: 'Tienda' },
]

export const ProfileTab = ({
  lukCoins = 0,
  onSpendLukCoins,
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
  const [view, setView] = useState('perfil')

  if (!user) {
    return (
      <section className="stats-section">
        <div className="hm-card hm-signin">
          <div className="hm-signin-text">
            <h3>Entra para ver tu perfil</h3>
            <p>Inicia sesión con Google para ver tus estadísticas, tus logros y la tienda.</p>
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
      <div className="pt-switch" role="tablist" aria-label="Secciones del perfil">
        {VIEWS.map(item => (
          <button
            key={item.id}
            role="tab"
            aria-selected={view === item.id}
            className={`pt-switch-btn ${view === item.id ? 'active' : ''}`}
            onClick={() => setView(item.id)}
          >
            {item.label}
            {item.id === 'tienda' && <span className="pt-switch-coins">{lukCoins} LC</span>}
          </button>
        ))}
      </div>

      {view === 'perfil' ? (
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
      ) : (
        <StoreTab lukCoins={lukCoins} onSpendLukCoins={onSpendLukCoins} />
      )}
    </section>
  )
}

export default ProfileTab
