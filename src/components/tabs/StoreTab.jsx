/**
 * Store Tab Component
 * Lukto Store for cosmetics and boosts
 */
import { useMemo } from 'react'
import { useApp } from '../../contexts'
import { AvatarImage, EmptyState } from '../common'

export const StoreTab = ({ lukCoins = 0, onSpendLukCoins }) => {
  const { user, userPlayer, userLinks, getPlayerName, getPlayerPhoto } = useApp()

  const cosmetics = useMemo(() => {
    if (!user?.uid) return {}
    return userLinks?.[user.uid]?.cosmetics || {}
  }, [user, userLinks])

  const items = [
    {
      id: 'goldName',
      title: 'Nombre Dorado',
      description: 'Tu nombre brilla en oro en tu perfil.',
      price: 50,
      cosmeticsUpdate: { goldName: true },
      preview: 'goldName',
    },
    {
      id: 'avatarGlow',
      title: 'Avatar Glow',
      description: 'Brillo sutil alrededor de tu avatar.',
      price: 75,
      cosmeticsUpdate: { avatarGlow: true },
      preview: 'glow',
    },
    {
      id: 'bannerJunior',
      title: 'Banner Junior',
      description: 'Banner de perfil inspirado en el escudo Junior.',
      price: 120,
      cosmeticsUpdate: { banner: 'junior' },
      preview: 'banner-junior',
    },
  ]

  if (!user) {
    return (
      <section className="stats-section">
        <EmptyState
          type="noAccess"
          title="Inicia sesión para comprar"
          description="Conéctate para usar la tienda y tus LukCoins."
        />
      </section>
    )
  }

  if (!userPlayer) {
    return (
      <section className="stats-section">
        <EmptyState
          type="noStats"
          title="Vincula tu cuenta"
          description="Necesitas vincular tu usuario a un jugador para comprar."
        />
      </section>
    )
  }

  return (
    <section className="stats-section store-section">
      <div className="store-header">
        <div>
          <h2 className="section-title">Lukto Store</h2>
          <p className="section-subtitle">Cosméticos y mejoras con LukCoins</p>
        </div>
        <div className="store-balance">
          <span className="store-balance-label">Saldo</span>
          <span className="store-balance-value">{lukCoins} LC</span>
        </div>
      </div>

      <div className="store-grid">
        {items.map(item => {
          const owned =
            (item.id === 'goldName' && cosmetics.goldName) ||
            (item.id === 'avatarGlow' && cosmetics.avatarGlow) ||
            (item.id === 'bannerJunior' && cosmetics.banner === 'junior')

          return (
            <div key={item.id} className={`store-card ${owned ? 'owned' : ''}`}>
              <div className="store-preview">
                <div
                  className={`store-avatar-preview ${item.preview === 'glow' ? 'glow' : ''}`}
                >
                  <AvatarImage src={getPlayerPhoto(userPlayer)} name={getPlayerName(userPlayer)} />
                </div>
                <div className="store-name-preview">
                  <span className={item.preview === 'goldName' ? 'gold' : ''}>
                    {getPlayerName(userPlayer)}
                  </span>
                </div>
              </div>
              {item.preview === 'banner-junior' && (
                <div className="store-banner-preview banner-junior">
                  <span>Banner Junior</span>
                </div>
              )}
              <div className="store-info">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <button
                className="store-buy-btn"
                onClick={() => onSpendLukCoins?.(item.price, item.cosmeticsUpdate)}
                disabled={owned || lukCoins < item.price}
              >
                {owned ? 'Comprado' : `${item.price} LC`}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default StoreTab
