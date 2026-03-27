import React, { useId, useMemo } from 'react'

export const DEFAULT_AVATAR_LOADOUT = {
  jersey: 'base_green',
  hair: 'short',
  skinTone: 'medium',
  boots: 'black',
  companion: 'none',
}

export const DEFAULT_AVATAR_INVENTORY = {
  jersey: { base_green: true, junior: false },
  hair: { short: true, buzz: true },
  skinTone: { light: true, medium: true, dark: true },
  boots: { black: true },
  companion: { none: true },
}

export const createAvatarState = avatar => {
  const data = avatar || {}
  const loadout = { ...DEFAULT_AVATAR_LOADOUT, ...(data.loadout || {}) }

  const inventory = Object.entries(DEFAULT_AVATAR_INVENTORY).reduce((acc, [slot, slotInventory]) => {
    acc[slot] = { ...(slotInventory || {}), ...(data.inventory?.[slot] || {}) }
    return acc
  }, {})

  Object.entries(data.inventory || {}).forEach(([slot, slotInventory]) => {
    if (!inventory[slot]) inventory[slot] = {}
    Object.assign(inventory[slot], slotInventory || {})
  })

  Object.entries(loadout).forEach(([slot, value]) => {
    if (typeof value !== 'string' || !value.trim()) return
    if (!inventory[slot]) inventory[slot] = {}
    inventory[slot][value] = true
  })

  return { loadout, inventory }
}

export const SKIN_TONES = {
  light: '#fcdeb3',
  medium: '#c68642',
  dark: '#4a3219',
}

export const BOOT_COLORS = {
  black: '#0f172a',
  white: '#e2e8f0',
  neon: '#22d3ee',
}

const JERSEY_THEMES = {
  base_green: { body: '#16a34a', accent: '#86efac', shoulder: '#14532d', collar: '#e2e8f0' },
  classic_stripes: { mode: 'stripes', stripeWidth: 10, body: '#f8fafc', stripe: '#dc2626', accent: '#dc2626', shoulder: '#b91c1c', collar: '#1e3a8a' },
  blackout: { body: '#111827', accent: '#374151', shoulder: '#020617', collar: '#22d3ee' },
  mint_wave: { body: '#0f766e', accent: '#34d399', shoulder: '#115e59', collar: '#ecfeff' },
  junior: { mode: 'stripes', stripeWidth: 10, body: '#ffffff', stripe: '#dc2626', accent: '#1e3a8a', shoulder: '#dc2626', collar: '#dc2626' },
}

export const AvatarFigure = ({ loadout = {}, size = 96, className = '', title = 'Player Bust' }) => {
  const patternId = useId().replace(/:/g, '')
  const { loadout: resolvedLoadout } = useMemo(() => createAvatarState({ loadout }), [loadout])

  const skin = SKIN_TONES[resolvedLoadout.skinTone] || SKIN_TONES.medium
  const jersey = JERSEY_THEMES[resolvedLoadout.jersey] || JERSEY_THEMES.base_green

  return (
    <div
      className={`avatar-figure avatar-bust-2d ${className}`.trim()}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${jersey.shoulder || '#0f172a'} 0%, #000 100%)`,
        overflow: 'hidden',
        border: `2px solid ${jersey.body}`,
        boxShadow: `0 4px 12px ${jersey.body}40`,
        position: 'relative'
      }}
      aria-label={title}
    >
      <svg
        viewBox="0 0 100 100"
        className="avatar-figure-svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <filter id={`drop-shadow-${patternId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#000" floodOpacity="0.3" />
          </filter>
          {(jersey.mode === 'stripes' && jersey.stripe) && (
            <pattern id={`stripes-${patternId}`} patternUnits="userSpaceOnUse" width={jersey.stripeWidth || 10} height="100" patternTransform="rotate(0)">
              <rect width={jersey.stripeWidth || 10} height="100" fill={jersey.body} />
              <rect width={(jersey.stripeWidth || 10) / 2} height="100" fill={jersey.stripe} />
            </pattern>
          )}
        </defs>

        {/* Torso/Jersey */}
        <path
          d="M20,100 Q10,70 30,60 L70,60 Q90,70 80,100 Z"
          fill={jersey.mode === 'stripes' ? `url(#stripes-${patternId})` : jersey.body}
          filter={`url(#drop-shadow-${patternId})`}
        />

        {resolvedLoadout.jersey === 'junior' && (
          <g transform="translate(25, 75)">
            <rect x="0" y="0" width="50" height="15" fill="#fff" stroke="#1e3a8a" strokeWidth="1.5" />
            <text x="25" y="6" fill="#1e3a8a" fontSize="4.5" fontWeight="bold" textAnchor="middle">CERVEZA</text>
            <text x="25" y="13" fill="#1e3a8a" fontSize="7" fontWeight="900" textAnchor="middle">AGUILA</text>
          </g>
        )}

        {/* Collar */}
        <path
          d="M40,60 L60,60 L50,70 Z"
          fill={jersey.collar || jersey.accent}
        />

        {/* Sleeves */}
        <path d="M20,100 Q10,70 30,60 L20,60 Q5,80 10,100 Z" fill={jersey.shoulder || jersey.accent} opacity="0.8" />
        <path d="M80,100 Q90,70 70,60 L80,60 Q95,80 90,100 Z" fill={jersey.shoulder || jersey.accent} opacity="0.8" />

        {/* Neck */}
        <rect x="42" y="45" width="16" height="20" fill={skin} />

        {/* Head */}
        <circle cx="50" cy="35" r="18" fill={skin} filter={`url(#drop-shadow-${patternId})`} />

        {/* Hair (Placeholder style) */}
        <path
          d="M32,35 Q30,15 50,15 Q70,15 68,35 Q68,25 50,22 Q32,25 32,35 Z"
          fill="#1f2937"
        />

        {/* Face Details (Subtle) */}
        {/* Eyes */}
        <rect x="42" y="32" width="4" height="2" fill="#000" opacity="0.5" rx="1" />
        <rect x="54" y="32" width="4" height="2" fill="#000" opacity="0.5" rx="1" />
        {/* Nose */}
        <rect x="49" y="36" width="2" height="4" fill="#000" opacity="0.2" rx="1" />
        {/* Mouth */}
        <rect x="46" y="44" width="8" height="1.5" fill="#000" opacity="0.3" rx="0.5" />
      </svg>
    </div>
  )
}

export default AvatarFigure
