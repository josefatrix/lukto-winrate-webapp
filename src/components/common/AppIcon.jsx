const ICONS = {
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  unlock: 'M8 11V8a4 4 0 0 1 7.46-2M6 11h12v9H6z',
  check: 'M5 12l4 4 10-10',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  info: 'M12 8h.01M11 12h2v5h-2',
  users: 'M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a6 6 0 0 1 12 0M14 20a6 6 0 0 1 8 0',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 0 2.5 3.5L12 9 9.5 6.5 12 3zm0 6 3.5 2.5L14 16h-4l-1.5-4.5L12 9z',
  star: 'M12 3.5l2.8 5.7 6.2.9-4.5 4.3 1.1 6.1L12 17.5l-5.6 3 1.1-6.1L3 10.1l6.2-.9L12 3.5z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1z',
  note: 'M6 3h12a1 1 0 0 1 1 1v16l-4-3H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z',
  coins: 'M5 8c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zm0 4c0 1.7 3.1 3 7 3s7-1.3 7-3m-14 4c0 1.7 3.1 3 7 3s7-1.3 7-3',
  profile: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-7 9a7 7 0 0 1 14 0',
  link: 'M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 1 1 7 7L17 13M14 11a5 5 0 0 1 0 7l-1.5 1.5a5 5 0 0 1-7-7L7 11',
  settings: 'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7zm8-3.5-2 .8a6.8 6.8 0 0 1-.6 1.4l1 1.9-2.1 2.1-1.9-1a6.8 6.8 0 0 1-1.4.6L12 20l-1.1-2.2a6.8 6.8 0 0 1-1.4-.6l-1.9 1-2.1-2.1 1-1.9a6.8 6.8 0 0 1-.6-1.4L4 12l2.2-1.1a6.8 6.8 0 0 1 .6-1.4l-1-1.9 2.1-2.1 1.9 1a6.8 6.8 0 0 1 1.4-.6L12 4l1.1 2.2a6.8 6.8 0 0 1 1.4.6l1.9-1 2.1 2.1-1 1.9a6.8 6.8 0 0 1 .6 1.4z',
  trash: 'M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13',
  shield: 'M12 3l7 3v6c0 4.2-2.6 7.4-7 9-4.4-1.6-7-4.8-7-9V6l7-3z',
  crown: 'M3 18h18l-1.5-8-4.5 4-3-6-3 6-4.5-4z',
  download: 'M12 3v11m0 0 4-4m-4 4-4-4M4 20h16',
  receipt: 'M6 3h12v18l-2-1-2 1-2-1-2 1-2-1-2 1zM8 8h8M8 12h8',
  megaphone: 'M3 11v2l9 3V8l-9 3zm9-1h4a3 3 0 0 1 0 6h-1',
  trophy: 'M7 4h10v2a4 4 0 0 1-4 4h-2a4 4 0 0 1-4-4V4zm-3 2h3v1a4 4 0 0 1-4 4H2v-1a4 4 0 0 1 2-4zm16 0h3a4 4 0 0 1 2 4v1h-1a4 4 0 0 1-4-4V6zM9 20h6M10 16h4v4h-4z',
  target: 'M12 3v4m0 10v4m9-9h-4M7 12H3m14.36-6.36-2.83 2.83M9.47 14.53l-2.83 2.83m0-11.31 2.83 2.83m5.66 5.66 2.83 2.83M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  spark: 'M12 2l1.8 4.7L18.5 8.5l-4.7 1.8L12 15l-1.8-4.7L5.5 8.5l4.7-1.8z',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.35-4.35',
  arrowDown: 'M7 10l5 5 5-5',
  arrowUp: 'M7 14l5-5 5 5',
}

export const AppIcon = ({ name, size = 16, strokeWidth = 1.8, className = '' }) => {
  const path = ICONS[name]
  if (!path) return null
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
      {path.split('M').filter(Boolean).map((segment, idx) => (
        <path key={idx} d={`M${segment}`} />
      ))}
    </svg>
  )
}

export default AppIcon
