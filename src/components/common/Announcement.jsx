/**
 * Announcement Component
 * Displays important messages to users
 */


export const Announcement = ({ message, type = 'info' }) => {
  if (!message) return null

  const icons = {
    info: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
    ),
    warning: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
    ),
    success: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    ),
  }

  return (
    <div className={`user-announcement announcement-${type}`}>
      <div className="user-announcement-icon">{icons[type] || icons.info}</div>
      <p className="user-announcement-text">{message}</p>
    </div>
  )
}

export default Announcement

