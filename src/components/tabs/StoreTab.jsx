/**
 * Store Tab Component
 * Premium Lukto Store with bundles, preview and progression blocks
 */
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../contexts'
import { AvatarFigure3D, EmptyState, AppIcon, createAvatarState } from '../common'

const DAILY_OFFER_DISCOUNT = 28
const RARITY_ORDER = { common: 1, rare: 2, epic: 3, mythic: 4 }
const RARITY_LABELS = {
  common: 'Comun',
  rare: 'Raro',
  epic: 'Epico',
  mythic: 'Legendario',
}
const CATEGORY_OPTIONS = [
  { key: 'all', label: 'Todo' },
  { key: 'name', label: 'Nombres' },
  { key: 'avatar', label: 'Avatar Kit' },
  { key: 'banner', label: 'Banners' },
  { key: 'boost', label: 'Boost XP' },
]

const STORE_ITEMS = [
  {
    id: 'goldName',
    title: 'Nombre Dorado',
    description: 'Nombre premium en oro para perfil y ranking.',
    price: 50,
    category: 'name',
    rarity: 'rare',
    cosmeticsUpdate: { goldName: true },
    featuredScore: 75,
  },
  {
    id: 'nameNeon',
    title: 'Nombre Neon',
    description: 'Nombre con glow electrico azul.',
    price: 80,
    category: 'name',
    rarity: 'epic',
    cosmeticsUpdate: { nameStyle: 'neon' },
    featuredScore: 85,
  },
  {
    id: 'nameGlitch',
    title: 'Nombre Glitch',
    description: 'Efecto digital para destacar en cada card.',
    price: 110,
    category: 'name',
    rarity: 'epic',
    cosmeticsUpdate: { nameStyle: 'glitch' },
    featuredScore: 90,
  },
  {
    id: 'avatarGlow',
    title: 'Avatar Glow',
    description: 'Halo de energia alrededor de tu avatar.',
    price: 75,
    category: 'avatar',
    rarity: 'rare',
    cosmeticsUpdate: { avatarGlow: true },
    featuredScore: 70,
  },
  {
    id: 'jerseyClassicStripes',
    title: 'Camiseta Rojiblanca',
    description: 'Diseño de rayas rojas y blancas estilo clasico.',
    price: 170,
    category: 'avatar',
    rarity: 'epic',
    avatarUnlock: { slot: 'jersey', value: 'classic_stripes', autoEquip: true },
    featuredScore: 97,
  },
  {
    id: 'jerseyBlackout',
    title: 'Camiseta Blackout',
    description: 'Kit oscuro para estilo sobrio en la cancha.',
    price: 145,
    category: 'avatar',
    rarity: 'epic',
    avatarUnlock: { slot: 'jersey', value: 'blackout', autoEquip: true },
    featuredScore: 87,
  },
  {
    id: 'jerseyMintWave',
    title: 'Camiseta Mint Wave',
    description: 'Paleta turquesa premium con detalle moderno.',
    price: 130,
    category: 'avatar',
    rarity: 'rare',
    avatarUnlock: { slot: 'jersey', value: 'mint_wave', autoEquip: true },
    featuredScore: 82,
  },
  {
    id: 'jerseyJunior',
    title: 'Camiseta Tiburón',
    description: 'Edición mítica a rayas rojiblancas con detalles azules.',
    price: 250,
    category: 'avatar',
    rarity: 'mythic',
    avatarUnlock: { slot: 'jersey', value: 'junior', autoEquip: true },
    featuredScore: 99,
  },
  {
    id: 'companionPinEyes',
    title: 'Pin con Ojos',
    description: 'Transforma tu avatar completo en un pin con ojos.',
    price: 95,
    category: 'avatar',
    rarity: 'rare',
    avatarUnlock: { slot: 'companion', value: 'pin_eyes', autoEquip: true },
    featuredScore: 80,
  },
  {
    id: 'bannerJunior',
    title: 'Banner Junior',
    description: 'Estilo clasico inspirado en el escudo juniorista.',
    price: 120,
    category: 'banner',
    rarity: 'epic',
    cosmeticsUpdate: { banner: 'junior' },
    featuredScore: 84,
  },
  {
    id: 'bannerMonda',
    title: 'Banner Soy la monda',
    description: 'Banner corto y directo para meter presencia.',
    price: 90,
    category: 'banner',
    rarity: 'rare',
    cosmeticsUpdate: { banner: 'monda' },
    featuredScore: 72,
  },
  {
    id: 'bannerJuego',
    title: 'Banner Hay juegooo',
    description: 'Para partidos pesados y noches de nivel.',
    price: 90,
    category: 'banner',
    rarity: 'rare',
    cosmeticsUpdate: { banner: 'hayjuego' },
    featuredScore: 74,
  },
  {
    id: 'bannerAmamar',
    title: 'Banner A mamar',
    description: 'Actitud frontal para calentamiento competitivo.',
    price: 110,
    category: 'banner',
    rarity: 'epic',
    cosmeticsUpdate: { banner: 'amamar' },
    featuredScore: 88,
  },
  {
    id: 'bannerLegend',
    title: 'Banner Leyenda',
    description: 'Drop exclusivo con estilo de maximo nivel.',
    price: 220,
    category: 'banner',
    rarity: 'mythic',
    cosmeticsUpdate: { banner: 'legend' },
    featuredScore: 99,
    limited: true,
  },
  {
    id: 'xp2',
    title: 'XP x2',
    description: 'Duplica el XP del proximo partido finalizado.',
    price: 200,
    category: 'boost',
    rarity: 'rare',
    boostUpdate: { multiplier: 2 },
    featuredScore: 78,
  },
  {
    id: 'xp3',
    title: 'XP x3',
    description: 'Triplica el XP del proximo partido finalizado.',
    price: 350,
    category: 'boost',
    rarity: 'epic',
    boostUpdate: { multiplier: 3 },
    featuredScore: 91,
  },
  {
    id: 'xp4',
    title: 'XP x4',
    description: 'Multiplicador maximo para subir rapido de rango.',
    price: 600,
    category: 'boost',
    rarity: 'mythic',
    boostUpdate: { multiplier: 4 },
    featuredScore: 96,
    limited: true,
  },
]

const STORE_BUNDLES = [
  {
    id: 'starter-style',
    title: 'Starter Style',
    description: 'Entrada premium para cambiar tu perfil completo.',
    itemIds: ['goldName', 'avatarGlow', 'bannerMonda', 'jerseyMintWave'],
    discountPct: 20,
    rarity: 'rare',
  },
  {
    id: 'matchday-pack',
    title: 'Matchday Pack',
    description: 'Modo partido con look agresivo y boost x2.',
    itemIds: ['nameNeon', 'bannerJuego', 'xp2'],
    discountPct: 18,
    rarity: 'epic',
  },
  {
    id: 'legend-loadout',
    title: 'Legend Loadout',
    description: 'Pack elite con camiseta clasica, leyenda y XP x3.',
    itemIds: ['jerseyClassicStripes', 'nameGlitch', 'bannerLegend', 'xp3'],
    discountPct: 24,
    rarity: 'mythic',
    limited: true,
  },
]

const BANNER_TEXT_MAP = {
  junior: 'Junior',
  monda: 'Soy la monda',
  hayjuego: 'Hay juegooo',
  amamar: 'A mamar',
  legend: 'Leyenda',
}

const buildAvatarUpdateFromItems = items => {
  const inventoryAdd = {}
  const loadoutPatch = {}

  items.forEach(item => {
    if (!item.avatarUnlock) return
    const { slot, value, autoEquip = true } = item.avatarUnlock
    if (!slot || !value) return
    if (!inventoryAdd[slot]) inventoryAdd[slot] = []
    inventoryAdd[slot].push(value)
    if (autoEquip) loadoutPatch[slot] = value
  })

  if (!Object.keys(inventoryAdd).length && !Object.keys(loadoutPatch).length) return null
  return {
    inventoryAdd,
    loadoutPatch: Object.keys(loadoutPatch).length ? loadoutPatch : null,
  }
}

const isItemOwned = (item, cosmetics = {}, xpBoostPending = null, avatarInventory = {}) => {
  if (item.avatarUnlock) {
    const slotInventory = avatarInventory?.[item.avatarUnlock.slot] || {}
    return !!slotInventory[item.avatarUnlock.value]
  }
  if (item.id === 'goldName') return !!cosmetics.goldName
  if (item.id === 'nameNeon') return cosmetics.nameStyle === 'neon'
  if (item.id === 'nameGlitch') return cosmetics.nameStyle === 'glitch'
  if (item.id === 'avatarGlow') return !!cosmetics.avatarGlow
  if (item.id === 'bannerJunior') return cosmetics.banner === 'junior'
  if (item.id === 'bannerMonda') return cosmetics.banner === 'monda'
  if (item.id === 'bannerJuego') return cosmetics.banner === 'hayjuego'
  if (item.id === 'bannerAmamar') return cosmetics.banner === 'amamar'
  if (item.id === 'bannerLegend') return cosmetics.banner === 'legend'
  if (item.id === 'xp2') return (xpBoostPending?.multiplier || 0) >= 2
  if (item.id === 'xp3') return (xpBoostPending?.multiplier || 0) >= 3
  if (item.id === 'xp4') return (xpBoostPending?.multiplier || 0) >= 4
  return false
}

const isAvatarItemEquipped = (item, avatarLoadout = {}) => {
  if (!item.avatarUnlock) return false
  return avatarLoadout[item.avatarUnlock.slot] === item.avatarUnlock.value
}

const applyAvatarUpdateToLoadout = (avatarLoadout, avatarUpdate) => {
  if (!avatarUpdate?.loadoutPatch) return avatarLoadout
  return { ...avatarLoadout, ...avatarUpdate.loadoutPatch }
}

const formatCountdown = msLeft => {
  if (msLeft <= 0) return '00:00:00'
  const totalSeconds = Math.floor(msLeft / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

const getSortComparator = (sortBy, ownedMap) => {
  const baseOwnershipSort = (a, b) => {
    const aOwned = ownedMap[a.id] ? 1 : 0
    const bOwned = ownedMap[b.id] ? 1 : 0
    return aOwned - bOwned
  }

  if (sortBy === 'priceAsc') {
    return (a, b) => baseOwnershipSort(a, b) || a.price - b.price || a.title.localeCompare(b.title)
  }
  if (sortBy === 'priceDesc') {
    return (a, b) => baseOwnershipSort(a, b) || b.price - a.price || a.title.localeCompare(b.title)
  }
  if (sortBy === 'rarity') {
    return (a, b) =>
      baseOwnershipSort(a, b) ||
      (RARITY_ORDER[b.rarity] || 0) - (RARITY_ORDER[a.rarity] || 0) ||
      a.price - b.price
  }
  if (sortBy === 'name') {
    return (a, b) => baseOwnershipSort(a, b) || a.title.localeCompare(b.title)
  }
  return (a, b) => baseOwnershipSort(a, b) || b.featuredScore - a.featuredScore || a.price - b.price
}

export const StoreTab = ({ lukCoins = 0, onSpendLukCoins }) => {
  const {
    user,
    userPlayer,
    userLinks,
    matches,
    ratings,
    getPlayerName,
  } = useApp()

  const [selectedKey, setSelectedKey] = useState('offer')
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState('featured')
  const [busyKey, setBusyKey] = useState('')
  const [pulseKey, setPulseKey] = useState('')
  const [nowTs, setNowTs] = useState(() => Date.now())

  const cosmetics = useMemo(() => {
    if (!user?.uid) return {}
    return userLinks?.[user.uid]?.cosmetics || {}
  }, [user, userLinks])

  const xpBoostPending = useMemo(() => {
    if (!user?.uid) return null
    return userLinks?.[user.uid]?.xpBoostPending || null
  }, [user, userLinks])

  const avatarState = useMemo(() => {
    if (!user?.uid) return createAvatarState({})
    return createAvatarState(userLinks?.[user.uid]?.avatar || {})
  }, [user, userLinks])

  const avatarLoadout = avatarState.loadout
  const avatarInventory = avatarState.inventory

  const purchaseHistory = useMemo(() => {
    if (!user?.uid) return []
    return (userLinks?.[user.uid]?.purchaseHistory || []).slice(0, 6)
  }, [user, userLinks])

  useEffect(() => {
    const interval = window.setInterval(() => setNowTs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const ownedMap = useMemo(() => {
    const map = {}
    STORE_ITEMS.forEach(item => {
      map[item.id] = isItemOwned(item, cosmetics, xpBoostPending, avatarInventory)
    })
    return map
  }, [cosmetics, xpBoostPending, avatarInventory])

  const itemsById = useMemo(() => {
    const map = {}
    STORE_ITEMS.forEach(item => {
      map[item.id] = item
    })
    return map
  }, [])

  const dailyOffer = useMemo(() => {
    const candidates = STORE_ITEMS.filter(item => !ownedMap[item.id])
      .sort((a, b) => b.featuredScore - a.featuredScore || a.price - b.price)
    if (!candidates.length) return null

    const item = candidates[0]
    const discountedPrice = Math.max(15, Math.round(item.price * (1 - DAILY_OFFER_DISCOUNT / 100)))
    return {
      ...item,
      key: 'offer',
      kind: 'offer',
      price: discountedPrice,
      originalPrice: item.price,
      discountPct: DAILY_OFFER_DISCOUNT,
      limited: true,
    }
  }, [ownedMap])

  const bundles = useMemo(() => {
    return STORE_BUNDLES.map(bundle => {
      const bundleItems = bundle.itemIds
        .map(itemId => itemsById[itemId])
        .filter(Boolean)
      const basePrice = bundleItems.reduce((sum, item) => sum + item.price, 0)
      const finalPrice = Math.max(25, Math.round(basePrice * (1 - bundle.discountPct / 100)))
      const ownedCount = bundleItems.filter(item => ownedMap[item.id]).length
      const fullyOwned = ownedCount === bundleItems.length
      const cosmeticsUpdate = bundleItems.reduce((acc, item) => {
        if (item.cosmeticsUpdate) {
          return { ...acc, ...item.cosmeticsUpdate }
        }
        return acc
      }, {})
      const avatarUpdate = buildAvatarUpdateFromItems(bundleItems)
      const boostMultiplier = bundleItems.reduce((acc, item) => {
        return Math.max(acc, item.boostUpdate?.multiplier || 0)
      }, 0)

      return {
        ...bundle,
        key: `bundle:${bundle.id}`,
        kind: 'bundle',
        itemCount: bundleItems.length,
        items: bundleItems,
        ownedCount,
        owned: fullyOwned,
        originalPrice: basePrice,
        price: finalPrice,
        cosmeticsUpdate: Object.keys(cosmeticsUpdate).length ? cosmeticsUpdate : null,
        avatarUpdate,
        boostUpdate: boostMultiplier > 0 ? { multiplier: boostMultiplier } : null,
      }
    })
  }, [itemsById, ownedMap])

  const sortedItems = useMemo(() => {
    const lowerSearch = searchTerm.trim().toLowerCase()
    const comparator = getSortComparator(sortBy, ownedMap)
    return STORE_ITEMS.filter(item => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false
      if (!lowerSearch) return true
      return (
        item.title.toLowerCase().includes(lowerSearch) ||
        item.description.toLowerCase().includes(lowerSearch)
      )
    }).sort(comparator)
  }, [categoryFilter, searchTerm, sortBy, ownedMap])

  const selectedEntry = useMemo(() => {
    if (selectedKey === 'offer') {
      return dailyOffer
    }
    if (selectedKey.startsWith('bundle:')) {
      return bundles.find(bundle => bundle.key === selectedKey) || null
    }
    if (selectedKey.startsWith('item:')) {
      const itemId = selectedKey.replace('item:', '')
      const item = itemsById[itemId]
      if (!item) return null
      return {
        ...item,
        key: selectedKey,
        kind: 'item',
      }
    }
    return dailyOffer || null
  }, [bundles, dailyOffer, itemsById, selectedKey])

  const previewCosmetics = useMemo(() => {
    const cosmeticsUpdate = selectedEntry?.cosmeticsUpdate || null
    return cosmeticsUpdate ? { ...cosmetics, ...cosmeticsUpdate } : cosmetics
  }, [cosmetics, selectedEntry])

  const previewBoost = useMemo(() => {
    if (selectedEntry?.boostUpdate?.multiplier) return selectedEntry.boostUpdate.multiplier
    return xpBoostPending?.multiplier || null
  }, [selectedEntry, xpBoostPending])

  const nextUnlock = useMemo(() => {
    const unowned = STORE_ITEMS.filter(item => !ownedMap[item.id]).sort((a, b) => a.price - b.price)
    if (!unowned.length) return null
    const target = unowned[0]
    const coinsToUnlock = Math.max(target.price - lukCoins, 0)
    const progress = Math.min((lukCoins / target.price) * 100, 100)
    return {
      ...target,
      coinsToUnlock,
      progress,
    }
  }, [lukCoins, ownedMap])

  const missionStats = useMemo(() => {
    const playedMatches = matches.filter(match => {
      if (!match.winner) return false
      return match.teamWhite?.includes(userPlayer) || match.teamBlack?.includes(userPlayer)
    })
    const wins = playedMatches.filter(match => {
      const playerInWhite = match.teamWhite?.includes(userPlayer)
      return (playerInWhite && match.winner === 'white') || (!playerInWhite && match.winner === 'black')
    }).length

    const totalRatings = Object.values(ratings || {}).reduce((acc, playerRatings) => {
      return (
        acc +
        playerRatings.filter(rating => {
          return rating.ratedBy === userPlayer || rating.odedBy === userPlayer
        }).length
      )
    }, 0)

    const missions = [
      {
        id: 'play5',
        title: 'Juega 5 partidos',
        progress: playedMatches.length,
        target: 5,
        reward: 45,
      },
      {
        id: 'win3',
        title: 'Gana 3 partidos',
        progress: wins,
        target: 3,
        reward: 60,
      },
      {
        id: 'rate20',
        title: 'Califica 20 veces',
        progress: totalRatings,
        target: 20,
        reward: 80,
      },
    ]

    const completedMissions = missions.filter(mission => mission.progress >= mission.target).length
    return { missions, completedMissions }
  }, [matches, ratings, userPlayer])

  const offerEndsAt = useMemo(() => {
    const date = new Date(nowTs)
    date.setHours(23, 59, 59, 999)
    return date.getTime()
  }, [nowTs])

  const offerCountdown = useMemo(() => {
    return formatCountdown(Math.max(offerEndsAt - nowTs, 0))
  }, [offerEndsAt, nowTs])

  const selectedAvatarUpdate = useMemo(() => {
    if (!selectedEntry) return null
    if (selectedEntry.avatarUpdate) return selectedEntry.avatarUpdate
    if (selectedEntry.avatarUnlock) return buildAvatarUpdateFromItems([selectedEntry])
    return null
  }, [selectedEntry])

  const playerName = getPlayerName(userPlayer)
  const hasGoldName = !!previewCosmetics.goldName
  const activeNameStyle = previewCosmetics.nameStyle || ''
  const activeBanner = previewCosmetics.banner || ''
  const bannerText = activeBanner ? BANNER_TEXT_MAP[activeBanner] : ''
  const previewAvatarLoadout = useMemo(() => {
    return applyAvatarUpdateToLoadout(avatarLoadout, selectedAvatarUpdate)
  }, [avatarLoadout, selectedAvatarUpdate])
  const companionLabel = previewAvatarLoadout.companion === 'pin_eyes' ? 'Pin con ojos' : 'Avatar humano'

  const storeProgressPct = useMemo(() => {
    if (!STORE_ITEMS.length) return 0
    const ownedItems = STORE_ITEMS.filter(item => ownedMap[item.id]).length
    return Math.round((ownedItems / STORE_ITEMS.length) * 100)
  }, [ownedMap])

  const runPurchase = async payload => {
    if (!payload || !onSpendLukCoins || busyKey) return

    const owned = payload.kind === 'item' ? ownedMap[payload.id] : payload.owned
    if (owned || lukCoins < payload.price) return

    const payloadAvatarUpdate = payload.avatarUpdate || (
      payload.avatarUnlock ? buildAvatarUpdateFromItems([payload]) : null
    )

    setBusyKey(payload.key)
    const result = await onSpendLukCoins(payload.price, {
      cosmeticsUpdate: payload.cosmeticsUpdate || null,
      boostUpdate: payload.boostUpdate || null,
      avatarUpdate: payloadAvatarUpdate,
      purchaseMeta: {
        itemId: payload.id,
        title: payload.title,
        kind: payload.kind,
        category: payload.category || 'mixed',
        rarity: payload.rarity || 'common',
        source: payload.kind,
      },
      successMessage: 'Compra realizada',
    })

    if (result?.ok) {
      setPulseKey(payload.key)
      window.setTimeout(() => setPulseKey(''), 1300)
    }
    setBusyKey('')
  }

  const runEquip = async item => {
    if (!item?.avatarUnlock || !onSpendLukCoins || busyKey) return
    const key = `item:${item.id}`
    setBusyKey(key)

    const result = await onSpendLukCoins(0, {
      avatarUpdate: {
        loadoutPatch: {
          [item.avatarUnlock.slot]: item.avatarUnlock.value,
        },
      },
      successMessage: 'Avatar equipado',
    })

    if (result?.ok) {
      setPulseKey(key)
      window.setTimeout(() => setPulseKey(''), 950)
    }
    setBusyKey('')
  }

  if (!user) {
    return (
      <section className="stats-section">
        <EmptyState
          type="noAccess"
          title="Inicia sesion para comprar"
          description="Conectate para usar la tienda y tus LukCoins."
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
    <section className="stats-section store-section store-v2-section">
      <div className="store-v2-shell">
        <div className="store-v2-top-grid">
          <article className="store-v2-hero">
            <div className="store-v2-hero-head">
              <span className="store-v2-chip">Store Reloaded</span>
              <div className="store-v2-balance">
                <AppIcon name="coins" size={16} />
                <span>{lukCoins} LC</span>
              </div>
            </div>
            <h2>Lukto Store</h2>
            <p>Cosmeticos, boosts y bundles para personalizar tu perfil competitivo.</p>
            <div className="store-v2-progress">
              <div className="store-v2-progress-label">
                <span>Coleccion completa</span>
                <span>{storeProgressPct}%</span>
              </div>
              <div className="store-v2-progress-track">
                <div className="store-v2-progress-fill" style={{ width: `${storeProgressPct}%` }} />
              </div>
            </div>

            {dailyOffer && (
              <div className={`store-v2-offer ${pulseKey === 'offer' ? 'purchase-pulse' : ''}`}>
                <div className="store-v2-offer-head">
                  <span className="store-v2-offer-label">Oferta del dia</span>
                  <span className="store-v2-offer-time">{offerCountdown}</span>
                </div>
                <div className="store-v2-offer-body">
                  <div>
                    <strong>{dailyOffer.title}</strong>
                    <p>{dailyOffer.description}</p>
                  </div>
                  <div className="store-v2-offer-price">
                    <span>{dailyOffer.price} LC</span>
                    <small>{dailyOffer.originalPrice} LC</small>
                  </div>
                </div>
                <button
                  className="store-v2-primary-btn"
                  onClick={() => runPurchase(dailyOffer)}
                  disabled={busyKey === 'offer' || lukCoins < dailyOffer.price}
                >
                  {busyKey === 'offer' ? 'Procesando...' : `Comprar -${dailyOffer.discountPct}%`}
                </button>
              </div>
            )}
          </article>

          <article className="store-v2-preview">
            <div className="store-v2-card-title">
              <AppIcon name="spark" size={16} />
              <span>Preview en vivo</span>
            </div>
            <div className="store-v2-preview-card">
              <div className={`store-v2-avatar ${previewCosmetics.avatarGlow ? 'glow' : ''}`}>
                <AvatarFigure3D
                  loadout={previewAvatarLoadout}
                  size={106}
                  className="store-v2-avatar-figure"
                  interactive
                  showBall={false}
                />
              </div>
              <div className="store-v2-preview-info">
                {bannerText && <span className={`store-v2-banner banner-${activeBanner}`}>{bannerText}</span>}
                <span className={`store-v2-player-name ${hasGoldName ? 'gold' : ''} ${activeNameStyle ? `name-${activeNameStyle}` : ''}`}>
                  {playerName}
                </span>
                <span className="store-v2-avatar-kit">
                  Kit: {previewAvatarLoadout.jersey === 'classic_stripes'
                    ? 'Rojiblanco'
                    : previewAvatarLoadout.jersey === 'blackout'
                      ? 'Blackout'
                      : previewAvatarLoadout.jersey === 'mint_wave'
                        ? 'Mint Wave'
                        : 'Base Verde'}
                </span>
                <span className="store-v2-avatar-kit">Skin avatar: {companionLabel}</span>
                <span className="store-v2-avatar-hint">Arrastra para rotar · Zoom con rueda o pinch</span>
                {previewBoost ? (
                  <span className="store-v2-boost-tag">
                    <AppIcon name="rocket" size={14} /> XP x{previewBoost} pendiente
                  </span>
                ) : (
                  <span className="store-v2-neutral-tag">Sin boost pendiente</span>
                )}
              </div>
            </div>
            <div className="store-v2-preview-meta">
              <span>Seleccion actual</span>
              <strong>{selectedEntry?.title || 'Oferta del dia'}</strong>
              <p>{selectedEntry?.description || 'Selecciona un item o bundle para previsualizarlo.'}</p>
            </div>

            {nextUnlock && (
              <div className="store-v2-next-unlock">
                <div className="store-v2-next-head">
                  <span>Siguiente desbloqueo</span>
                  <strong>{nextUnlock.title}</strong>
                </div>
                <div className="store-v2-next-track">
                  <div className="store-v2-next-fill" style={{ width: `${nextUnlock.progress}%` }} />
                </div>
                <small>
                  {nextUnlock.coinsToUnlock > 0
                    ? `Te faltan ${nextUnlock.coinsToUnlock} LC`
                    : 'Ya puedes comprarlo'}
                </small>
              </div>
            )}
          </article>
        </div>

        <div className="store-v2-toolbar">
          <div className="store-v2-search">
            <AppIcon name="search" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar item..."
            />
          </div>
          <div className="store-v2-filter-group">
            {CATEGORY_OPTIONS.map(option => (
              <button
                key={option.key}
                className={`store-v2-filter-btn ${categoryFilter === option.key ? 'active' : ''}`}
                onClick={() => setCategoryFilter(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <select
            className="store-v2-sort"
            value={sortBy}
            onChange={event => setSortBy(event.target.value)}
          >
            <option value="featured">Orden: Destacados</option>
            <option value="priceAsc">Precio: Menor a mayor</option>
            <option value="priceDesc">Precio: Mayor a menor</option>
            <option value="rarity">Rareza</option>
            <option value="name">Nombre</option>
          </select>
        </div>

        <section className="store-v2-bundles">
          <div className="store-v2-section-head">
            <h3>Bundles</h3>
            <p>Compra paquetes y ahorra LukCoins.</p>
          </div>
          <div className="store-v2-bundle-grid">
            {bundles.map(bundle => (
              <article
                key={bundle.id}
                className={`store-v2-bundle-card rarity-${bundle.rarity} ${bundle.owned ? 'owned' : ''} ${pulseKey === bundle.key ? 'purchase-pulse' : ''}`}
                onClick={() => setSelectedKey(bundle.key)}
              >
                <div className="store-v2-bundle-head">
                  <span className={`store-v2-rarity rarity-${bundle.rarity}`}>
                    {RARITY_LABELS[bundle.rarity]}
                  </span>
                  {bundle.limited && <span className="store-v2-limited">Limitado</span>}
                </div>
                <h4>{bundle.title}</h4>
                <p>{bundle.description}</p>
                <div className="store-v2-bundle-items">
                  {bundle.items.map(item => (
                    <span key={item.id} className={ownedMap[item.id] ? 'owned' : ''}>
                      {item.title}
                    </span>
                  ))}
                </div>
                <div className="store-v2-bundle-footer">
                  <div className="store-v2-bundle-price">
                    <strong>{bundle.price} LC</strong>
                    <small>{bundle.originalPrice} LC</small>
                  </div>
                  <button
                    className="store-v2-secondary-btn"
                    onClick={event => {
                      event.stopPropagation()
                      runPurchase(bundle)
                    }}
                    disabled={bundle.owned || busyKey === bundle.key || lukCoins < bundle.price}
                  >
                    {bundle.owned
                      ? 'Comprado'
                      : busyKey === bundle.key
                        ? 'Procesando...'
                        : `Comprar (${bundle.discountPct}% OFF)`}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="store-v2-main-grid">
          <section className="store-v2-items">
            <div className="store-v2-section-head">
              <h3>Catalogo</h3>
              <p>{sortedItems.length} items disponibles</p>
            </div>
            <div className="store-v2-item-grid">
              {sortedItems.map(item => {
                const owned = ownedMap[item.id]
                const key = `item:${item.id}`
                const equipped = isAvatarItemEquipped(item, avatarLoadout)
                const canEquip = !!item.avatarUnlock && owned && !equipped
                const isBusy = busyKey === key
                return (
                  <article
                    key={item.id}
                    className={`store-v2-item-card rarity-${item.rarity} ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''} ${pulseKey === key ? 'purchase-pulse' : ''} ${selectedKey === key ? 'selected' : ''}`}
                    onClick={() => setSelectedKey(key)}
                  >
                    <div className="store-v2-item-head">
                      <span className={`store-v2-rarity rarity-${item.rarity}`}>
                        {RARITY_LABELS[item.rarity]}
                      </span>
                      {item.limited && <span className="store-v2-limited">Limitado</span>}
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
                    <div className="store-v2-item-meta">
                      <span className="store-v2-category">
                        {CATEGORY_OPTIONS.find(option => option.key === item.category)?.label || item.category}
                      </span>
                      <strong>{item.price} LC</strong>
                    </div>
                    <button
                      className="store-v2-tertiary-btn"
                      onClick={event => {
                        event.stopPropagation()
                        if (canEquip) {
                          runEquip(item)
                          return
                        }
                        runPurchase({ ...item, key, kind: 'item' })
                      }}
                      disabled={isBusy || (!canEquip && (owned || lukCoins < item.price))}
                    >
                      {isBusy
                        ? 'Procesando...'
                        : canEquip
                          ? 'Equipar'
                          : owned
                            ? item.avatarUnlock
                              ? 'Equipado'
                              : 'Comprado'
                            : 'Comprar'}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>

          <aside className="store-v2-side">
            <article className="store-v2-card">
              <div className="store-v2-card-title">
                <AppIcon name="target" size={16} />
                <span>Misiones de coins</span>
              </div>
              <div className="store-v2-mission-list">
                {missionStats.missions.map(mission => {
                  const pct = Math.min((mission.progress / mission.target) * 100, 100)
                  const complete = mission.progress >= mission.target
                  return (
                    <div key={mission.id} className="store-v2-mission-item">
                      <div className="store-v2-mission-head">
                        <span>{mission.title}</span>
                        <strong>{complete ? `+${mission.reward} LC` : `${mission.progress}/${mission.target}`}</strong>
                      </div>
                      <div className="store-v2-mission-track">
                        <div className="store-v2-mission-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
                <small>{missionStats.completedMissions} misiones completadas esta temporada</small>
              </div>
            </article>

            <article className="store-v2-card">
              <div className="store-v2-card-title">
                <AppIcon name="receipt" size={16} />
                <span>Compras recientes</span>
              </div>
              {purchaseHistory.length > 0 ? (
                <div className="store-v2-history">
                  {purchaseHistory.map(entry => (
                    <div key={entry.id} className="store-v2-history-item">
                      <div>
                        <strong>{entry.title || 'Compra'}</strong>
                        <small>
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                            })
                            : 'Reciente'}
                        </small>
                      </div>
                      <span>{entry.price || 0} LC</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="store-v2-empty">Tus compras se mostraran aqui.</p>
              )}
            </article>
          </aside>
        </div>
      </div>
    </section>
  )
}

export default StoreTab
