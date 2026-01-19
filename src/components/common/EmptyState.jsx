/**
 * Empty State Component
 * Elegant SVG illustrations for empty states
 */

// Custom SVG Illustrations
const Illustrations = {
  noMatches: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="emptyGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id="emptyGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.8" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.4" />
        </linearGradient>
      </defs>
      {/* Stadium/Field */}
      <ellipse cx="100" cy="150" rx="80" ry="30" fill="url(#emptyGrad1)" />
      <rect x="30" y="80" width="140" height="70" rx="8" fill="url(#emptyGrad1)" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" />
      {/* Center line */}
      <line x1="100" y1="80" x2="100" y2="150" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" strokeDasharray="4 4" />
      {/* Center circle */}
      <circle cx="100" cy="115" r="20" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" />
      {/* Soccer ball */}
      <circle cx="100" cy="60" r="25" fill="var(--bg-elevated)" stroke="url(#emptyGrad2)" strokeWidth="3" />
      <path d="M100 45 L107 55 L103 65 L97 65 L93 55 Z" fill="var(--accent-green)" fillOpacity="0.5" />
      <circle cx="100" cy="60" r="5" fill="var(--accent-green)" fillOpacity="0.3" />
      {/* Decorative dots */}
      <circle cx="50" cy="100" r="3" fill="var(--accent-green)" fillOpacity="0.2" />
      <circle cx="150" cy="100" r="3" fill="var(--accent-green)" fillOpacity="0.2" />
      <circle cx="70" cy="130" r="2" fill="var(--accent-green)" fillOpacity="0.15" />
      <circle cx="130" cy="130" r="2" fill="var(--accent-green)" fillOpacity="0.15" />
    </svg>
  ),
  
  noPlayers: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="playerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* Person silhouette 1 */}
      <circle cx="70" cy="70" r="20" fill="var(--bg-elevated)" stroke="url(#playerGrad)" strokeWidth="3" />
      <path d="M40 140 Q40 100 70 100 Q100 100 100 140" fill="url(#playerGrad)" />
      {/* Person silhouette 2 (faded) */}
      <circle cx="130" cy="80" r="18" fill="var(--bg-elevated)" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" />
      <path d="M105 145 Q105 110 130 110 Q155 110 155 145" fill="var(--accent-green)" fillOpacity="0.15" />
      {/* Plus icon */}
      <circle cx="160" cy="50" r="20" fill="var(--bg-card)" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.5" />
      <line x1="160" y1="40" x2="160" y2="60" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" />
      <line x1="150" y1="50" x2="170" y2="50" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" />
      {/* Decorative elements */}
      <circle cx="30" cy="160" r="4" fill="var(--accent-green)" fillOpacity="0.2" />
      <circle cx="170" cy="160" r="4" fill="var(--accent-green)" fillOpacity="0.2" />
    </svg>
  ),
  
  noPredictions: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="predGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Crystal ball */}
      <circle cx="100" cy="90" r="50" fill="url(#predGrad)" stroke="var(--accent-green)" strokeWidth="3" />
      <ellipse cx="100" cy="85" rx="35" ry="20" fill="none" stroke="var(--accent-green)" strokeWidth="1" strokeOpacity="0.3" />
      {/* Sparkles inside */}
      <circle cx="80" cy="75" r="3" fill="var(--accent-green)" fillOpacity="0.6" />
      <circle cx="115" cy="85" r="2" fill="var(--accent-green)" fillOpacity="0.4" />
      <circle cx="90" cy="100" r="2" fill="var(--accent-green)" fillOpacity="0.3" />
      {/* Base */}
      <path d="M70 140 L80 125 Q100 135 120 125 L130 140 Q100 150 70 140 Z" fill="var(--accent-green)" fillOpacity="0.3" />
      <ellipse cx="100" cy="145" rx="35" ry="10" fill="var(--accent-green)" fillOpacity="0.2" />
      {/* Question marks */}
      <text x="60" y="50" fontSize="20" fill="var(--accent-green)" fillOpacity="0.3" fontWeight="bold">?</text>
      <text x="140" y="60" fontSize="16" fill="var(--accent-green)" fillOpacity="0.2" fontWeight="bold">?</text>
    </svg>
  ),
  
  noStats: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="statsGrad" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.5" />
        </linearGradient>
      </defs>
      {/* Chart bars */}
      <rect x="30" y="120" width="25" height="50" rx="4" fill="url(#statsGrad)" stroke="var(--accent-green)" strokeWidth="1" strokeOpacity="0.3" />
      <rect x="65" y="90" width="25" height="80" rx="4" fill="url(#statsGrad)" stroke="var(--accent-green)" strokeWidth="1" strokeOpacity="0.3" />
      <rect x="100" y="60" width="25" height="110" rx="4" fill="url(#statsGrad)" stroke="var(--accent-green)" strokeWidth="1" strokeOpacity="0.3" />
      <rect x="135" y="100" width="25" height="70" rx="4" fill="url(#statsGrad)" stroke="var(--accent-green)" strokeWidth="1" strokeOpacity="0.3" />
      {/* Base line */}
      <line x1="20" y1="170" x2="180" y2="170" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" />
      {/* Trend line */}
      <path d="M30 130 Q65 80 100 90 Q135 100 170 60" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeDasharray="4 4" strokeOpacity="0.5" />
      {/* Data point */}
      <circle cx="100" cy="90" r="6" fill="var(--accent-green)" fillOpacity="0.6" />
    </svg>
  ),
  
  noResults: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="searchGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Magnifying glass */}
      <circle cx="90" cy="85" r="40" fill="url(#searchGrad)" stroke="var(--accent-green)" strokeWidth="4" />
      <circle cx="90" cy="85" r="25" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.3" />
      <line x1="120" y1="115" x2="160" y2="155" stroke="var(--accent-green)" strokeWidth="8" strokeLinecap="round" />
      {/* X mark inside */}
      <line x1="75" y1="70" x2="105" y2="100" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="105" y1="70" x2="75" y2="100" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.5" />
      {/* Sparkles */}
      <circle cx="50" cy="50" r="3" fill="var(--accent-green)" fillOpacity="0.3" />
      <circle cx="150" cy="40" r="2" fill="var(--accent-green)" fillOpacity="0.2" />
    </svg>
  ),
  
  noNotifications: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="bellGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.5" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {/* Bell */}
      <path d="M100 40 L100 55" stroke="var(--accent-green)" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 110 Q60 70 100 60 Q140 70 140 110 L150 130 L50 130 Z" fill="url(#bellGrad)" stroke="var(--accent-green)" strokeWidth="2" />
      <ellipse cx="100" cy="130" rx="55" ry="8" fill="var(--accent-green)" fillOpacity="0.3" />
      {/* Clapper */}
      <circle cx="100" cy="145" r="12" fill="var(--accent-green)" fillOpacity="0.4" />
      {/* Sound waves (muted) */}
      <path d="M155 90 Q165 100 155 110" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.2" strokeLinecap="round" />
      <path d="M45 90 Q35 100 45 110" fill="none" stroke="var(--accent-green)" strokeWidth="2" strokeOpacity="0.2" strokeLinecap="round" />
      {/* ZZZ */}
      <text x="140" y="60" fontSize="14" fill="var(--accent-green)" fillOpacity="0.4" fontWeight="bold">z</text>
      <text x="150" y="50" fontSize="12" fill="var(--accent-green)" fillOpacity="0.3" fontWeight="bold">z</text>
      <text x="158" y="42" fontSize="10" fill="var(--accent-green)" fillOpacity="0.2" fontWeight="bold">z</text>
    </svg>
  ),

  success: (
    <svg viewBox="0 0 200 200" fill="none" className="empty-illustration">
      <defs>
        <linearGradient id="successGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {/* Trophy */}
      <path d="M70 60 L70 100 Q70 130 100 140 Q130 130 130 100 L130 60 Z" fill="url(#successGrad)" stroke="var(--accent-green)" strokeWidth="3" />
      {/* Handles */}
      <path d="M70 70 Q50 70 50 90 Q50 110 70 110" fill="none" stroke="var(--accent-green)" strokeWidth="3" />
      <path d="M130 70 Q150 70 150 90 Q150 110 130 110" fill="none" stroke="var(--accent-green)" strokeWidth="3" />
      {/* Base */}
      <rect x="85" y="140" width="30" height="10" fill="var(--accent-green)" fillOpacity="0.4" />
      <rect x="75" y="150" width="50" height="15" rx="3" fill="var(--accent-green)" fillOpacity="0.3" />
      {/* Star */}
      <path d="M100 75 L103 85 L113 85 L105 92 L108 102 L100 96 L92 102 L95 92 L87 85 L97 85 Z" fill="var(--accent-green)" fillOpacity="0.8" />
      {/* Sparkles */}
      <circle cx="55" cy="50" r="3" fill="var(--accent-green)" fillOpacity="0.4" />
      <circle cx="145" cy="45" r="4" fill="var(--accent-green)" fillOpacity="0.3" />
      <circle cx="40" cy="120" r="2" fill="var(--accent-green)" fillOpacity="0.2" />
      <circle cx="160" cy="125" r="2" fill="var(--accent-green)" fillOpacity="0.2" />
    </svg>
  )
}

export const EmptyState = ({ 
  type = 'noResults', 
  title, 
  description, 
  action,
  actionLabel,
  className = '' 
}) => {
  const illustration = Illustrations[type] || Illustrations.noResults
  
  return (
    <div className={`empty-state ${className}`}>
      <div className="empty-state-illustration">
        {illustration}
      </div>
      {title && <h3 className="empty-state-title">{title}</h3>}
      {description && <p className="empty-state-description">{description}</p>}
      {action && actionLabel && (
        <button className="empty-state-action btn-haptic" onClick={action}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export default EmptyState

