// Icon paths — all 24×24 viewBox, strokeLinecap/Join round
const ICONS = {
  // Actions
  lock:       'M7 11V8a5 5 0 0110 0v3M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z',
  unlock:     'M8 11V7a4 4 0 017.46-2M5 11h14a1 1 0 011 1v8a1 1 0 01-1 1H5a1 1 0 01-1-1v-8a1 1 0 011-1z',
  check:      'M4 12l5 5L20 7',
  close:      'M6 6l12 12M18 6L6 18',
  plus:       'M12 4v16M4 12h16',
  minus:      'M4 12h16',
  info:       'M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  // People
  users:      'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  profile:    'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',
  // Sports
  ball:       'M12 2a10 10 0 100 20A10 10 0 0012 2zm0 0a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10zM2 12h20',
  trophy:     'M7 4h10v4a5 5 0 01-10 0V4zM4 6H2a2 2 0 002 2h1M20 6h2a2 2 0 01-2 2h-1M12 13v7M8 20h8',
  crown:      'M2 17l3-10 4 5 3-7 3 7 4-5 3 10H2z',
  target:     'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
  // UI
  star:       'M12 2l2.68 6.26L22 9.27l-5.36 4.73 1.62 7L12 17.77 5.74 21l1.62-7L2 9.27l7.32-1.01L12 2z',
  calendar:   'M8 2v3M16 2v3M3 9h18M3 5h18a1 1 0 011 1v14a2 2 0 01-2 2H4a2 2 0 01-2-2V6a1 1 0 011-1z',
  note:       'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8L14 2zM14 2v6h6M9 13h6M9 17h4',
  search:     'M10.5 17a6.5 6.5 0 100-13 6.5 6.5 0 000 13zM21 21l-4.35-4.35',
  settings:   'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  trash:      'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  shield:     'M12 3l7 3.5v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10v-5L12 3zM9 12l2 2 4-4',
  download:   'M12 3v12M8 11l4 4 4-4M4 20h16',
  share:      'M21 5a3 3 0 11-6 0 3 3 0 016 0zM9 12a3 3 0 11-6 0 3 3 0 016 0zM21 19a3 3 0 11-6 0 3 3 0 016 0zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  link:       'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  // Commerce
  coins:      'M12 2C9.79 2 8 3.12 8 4.5S9.79 7 12 7s4-1.12 4-2.5S14.21 2 12 2zM8 8.5c0 1.38 1.79 2.5 4 2.5s4-1.12 4-2.5M8 12.5c0 1.38 1.79 2.5 4 2.5s4-1.12 4-2.5M8 16.5c0 1.38 1.79 2.5 4 2.5s4-1.12 4-2.5M8 4.5v12M16 4.5v12',
  receipt:    'M6 2h12v20l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5V2zM9 8h6M9 12h6M9 16h3',
  megaphone:  'M3 11v2l8 2V9L3 11zM11 7v10M15 9a5 5 0 010 6M19 7a9 9 0 010 10',
  // Misc
  spark:      'M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM5 18l1 2 2-1-1 2 2 1-2 1 1 2-2-1-1 2-1-2-2 1 1-2-2-1 2-1-1-2 2 1 1-2z',
  arrowDown:  'M6 9l6 6 6-6',
  arrowUp:    'M6 15l6-6 6 6',
  arrowRight: 'M9 6l6 6-6 6',
  arrowLeft:  'M15 6l-6 6 6 6',
}

export const AppIcon = ({ name, size = 16, strokeWidth = 1.75, className = '' }) => {
  const path = ICONS[name]
  if (!path) return null

  // Handle compound paths (some icons have multiple sub-paths separated by 'M')
  const subpaths = path.match(/[Mm][^Mm]*/g) || [path]

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {subpaths.map((d, idx) => (
        <path key={idx} d={d.trim()} />
      ))}
    </svg>
  )
}

export default AppIcon
