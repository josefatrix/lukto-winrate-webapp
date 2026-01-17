/**
 * Toast Notification Component
 */


/**
 * Toast Component for displaying notifications
 */
export const Toast = ({ toast, onClose }) => {
  if (!toast) return null

  return (
    <div className={`toast ${toast.type}`} onClick={onClose}>
      <span className="toast-icon">
        {toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ'}
      </span>
      <span className="toast-message">{toast.message}</span>
    </div>
  )
}

export default Toast

