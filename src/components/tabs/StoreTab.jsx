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
  const xpBoostPending = useMemo(() => {
    if (!user?.uid) return null
    return userLinks?.[user.uid]?.xpBoostPending || null
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
      id: 'nameNeon',
      title: 'Nombre Neon',
      description: 'Tu nombre con glow azul eléctrico.',
      price: 80,
      cosmeticsUpdate: { nameStyle: 'neon' },
      preview: 'neon',
    },
    {
      id: 'nameGlitch',
      title: 'Nombre Glitch',
      description: 'Texto con vibración digital.',
      price: 110,
      cosmeticsUpdate: { nameStyle: 'glitch' },
      preview: 'glitch',
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
    {
      id: 'bannerMonda',
      title: 'Banner Soy la monda',
      description: 'Actitud total con un banner directo.',
      price: 90,
      cosmeticsUpdate: { banner: 'monda' },
      preview: 'banner-monda',
    },
    {
      id: 'bannerJuego',
      title: 'Banner Hay juegooo',
      description: 'Sello de partido pesado.',
      price: 90,
      cosmeticsUpdate: { banner: 'hayjuego' },
      preview: 'banner-hayjuego',
    },
    {
      id: 'bannerAmamar',
      title: 'Banner A mamar',
      description: 'Para los que llegan con hambre.',
      price: 110,
      cosmeticsUpdate: { banner: 'amamar' },
      preview: 'banner-amamar',
    },
    {
      id: 'bannerLegend',
      title: 'Banner Leyenda',
      description: 'El más exclusivo: brillo aurora + corona.',
      price: 220,
      cosmeticsUpdate: { banner: 'legend' },
      preview: 'banner-legend',
    },
    {
      id: 'xp2',
      title: 'XP x2',
      description: 'Duplica el XP del proximo partido.',
      price: 200,
      boostUpdate: { multiplier: 2 },
      preview: 'xp2',
    },
    {
      id: 'xp3',
      title: 'XP x3',
      description: 'Triplica el XP del proximo partido.',
      price: 350,
      boostUpdate: { multiplier: 3 },
      preview: 'xp3',
    },
    {
      id: 'xp4',
      title: 'XP x4',
      description: 'Cuadruplica el XP del proximo partido.',
      price: 600,
      boostUpdate: { multiplier: 4 },
      preview: 'xp4',
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
      <div className="store-hero">
        <div className="store-hero-text">
          <span className="store-tag">Drop 01</span>
          <h2 className="store-title">Lukto Store</h2>
          <p className="store-tagline">Ponte el estilo que mete presión</p>
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
            (item.id === 'nameNeon' && cosmetics.nameStyle === 'neon') ||
            (item.id === 'nameGlitch' && cosmetics.nameStyle === 'glitch') ||
            (item.id === 'avatarGlow' && cosmetics.avatarGlow) ||
            (item.id === 'bannerJunior' && cosmetics.banner === 'junior') ||
            (item.id === 'bannerMonda' && cosmetics.banner === 'monda') ||
            (item.id === 'bannerJuego' && cosmetics.banner === 'hayjuego') ||
            (item.id === 'bannerAmamar' && cosmetics.banner === 'amamar') ||
            (item.id === 'bannerLegend' && cosmetics.banner === 'legend') ||
            (item.id === 'xp2' && (xpBoostPending?.multiplier || 0) >= 2) ||
            (item.id === 'xp3' && (xpBoostPending?.multiplier || 0) >= 3) ||
            (item.id === 'xp4' && (xpBoostPending?.multiplier || 0) >= 4)

          return (
            <div key={item.id} className={`store-card ${owned ? 'owned' : ''}`}>
              <div className="store-preview">
                <div
                  className={`store-avatar-preview ${item.preview === 'glow' ? 'glow' : ''}`}
                >
                  <AvatarImage src={getPlayerPhoto(userPlayer)} name={getPlayerName(userPlayer)} />
                </div>
                <div className="store-name-preview">
                  <span className={item.preview === 'goldName' ? 'gold' : item.preview === 'neon' ? 'neon' : item.preview === 'glitch' ? 'glitch' : ''}>
                    {getPlayerName(userPlayer)}
                  </span>
                </div>
              </div>
              {item.preview?.startsWith('banner-') && (
                <div className={`store-banner-preview ${item.preview}`}>
                  <span>{item.title.replace('Banner ', '')}</span>
                </div>
              )}
              {item.preview?.startsWith('xp') && (
                <div className={`store-xp-preview ${item.preview}`}>
                  <span>{item.title}</span>
                </div>
              )}
              <div className="store-info">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
              <button
                className="store-buy-btn"
                onClick={() =>
                  onSpendLukCoins?.(
                    item.price,
                    item.cosmeticsUpdate
                      ? { cosmeticsUpdate: item.cosmeticsUpdate }
                      : { boostUpdate: item.boostUpdate }
                  )
                }
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
