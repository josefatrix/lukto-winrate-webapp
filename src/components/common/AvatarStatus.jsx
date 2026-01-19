/**
 * Avatar Status Component
 * Avatar with activity/streak indicators
 */

export const AvatarStatus = ({ 
  src, 
  name, 
  size = 40,
  streak = 0, // consecutive wins
  isOnFire = false, // 3+ wins streak
  isActive = false,
  showBadge = true,
  className = ''
}) => {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  // Determine status
  const getStatus = () => {
    if (isOnFire || streak >= 3) return 'fire'
    if (streak >= 2) return 'hot'
    if (streak === 1) return 'winning'
    if (streak <= -3) return 'cold'
    if (streak <= -1) return 'losing'
    return 'neutral'
  }

  const status = getStatus()

  const statusConfig = {
    fire: {
      borderColor: '#ff6b35',
      glowColor: 'rgba(255, 107, 53, 0.5)',
      icon: (
        <svg viewBox="0 0 16 16" width="14" height="14" className="status-icon fire-icon">
          <path d="M8 1C8 1 4 5 4 9C4 11.2 5.8 13 8 13C10.2 13 12 11.2 12 9C12 5 8 1 8 1ZM8 11C6.9 11 6 10.1 6 9C6 7.5 8 5 8 5C8 5 10 7.5 10 9C10 10.1 9.1 11 8 11Z" fill="#ff6b35"/>
        </svg>
      )
    },
    hot: {
      borderColor: '#ffa500',
      glowColor: 'rgba(255, 165, 0, 0.4)',
      icon: (
        <svg viewBox="0 0 16 16" width="12" height="12" className="status-icon">
          <circle cx="8" cy="8" r="6" fill="#ffa500"/>
          <path d="M8 4L9 7L12 7L9.5 9L10.5 12L8 10L5.5 12L6.5 9L4 7L7 7Z" fill="#fff"/>
        </svg>
      )
    },
    winning: {
      borderColor: 'var(--accent-green)',
      glowColor: 'rgba(16, 185, 129, 0.3)',
      icon: (
        <svg viewBox="0 0 16 16" width="10" height="10" className="status-icon">
          <path d="M8 2L10 6L14 6L11 9L12 14L8 11L4 14L5 9L2 6L6 6Z" fill="var(--accent-green)"/>
        </svg>
      )
    },
    cold: {
      borderColor: '#6b7280',
      glowColor: 'rgba(107, 114, 128, 0.3)',
      icon: (
        <svg viewBox="0 0 16 16" width="12" height="12" className="status-icon">
          <path d="M8 1V15M1 8H15M3 3L13 13M13 3L3 13" stroke="#6b7280" strokeWidth="1.5" fill="none"/>
        </svg>
      )
    },
    losing: {
      borderColor: 'var(--accent-red)',
      glowColor: 'rgba(239, 68, 68, 0.3)',
      icon: null
    },
    neutral: {
      borderColor: 'var(--border-color)',
      glowColor: 'transparent',
      icon: null
    }
  }

  const config = statusConfig[status]

  return (
    <div 
      className={`avatar-status avatar-status-${status} ${className}`}
      style={{
        '--avatar-size': `${size}px`,
        '--status-border': config.borderColor,
        '--status-glow': config.glowColor
      }}
    >
      <div className="avatar-wrapper">
        {src ? (
          <img src={src} alt={name} className="avatar-image" />
        ) : (
          <div className="avatar-placeholder">
            {initials}
          </div>
        )}
        
        {/* Status ring */}
        {status !== 'neutral' && (
          <div className="avatar-ring" />
        )}
        
        {/* Status badge */}
        {showBadge && config.icon && (
          <div className="avatar-badge">
            {config.icon}
          </div>
        )}
      </div>
      
      {/* Fire animation */}
      {status === 'fire' && (
        <div className="fire-particles">
          <span className="particle" style={{ '--i': 0 }} />
          <span className="particle" style={{ '--i': 1 }} />
          <span className="particle" style={{ '--i': 2 }} />
        </div>
      )}
    </div>
  )
}

export default AvatarStatus

