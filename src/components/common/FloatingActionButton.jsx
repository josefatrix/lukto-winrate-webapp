/**
 * Floating Action Button (FAB)
 * Apple-style floating button with optional menu
 */
import { useState } from 'react'

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const FloatingActionButton = ({ 
  onClick, 
  icon,
  menuItems = [],
  ariaLabel = 'Acción rápida'
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
  const hasMenu = menuItems.length > 0
  
  const handleClick = () => {
    if (hasMenu) {
      setIsOpen(!isOpen)
    } else if (onClick) {
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
      onClick()
    }
  }
  
  const handleMenuItemClick = (item) => {
    if (navigator.vibrate) {
      navigator.vibrate(10)
    }
    setIsOpen(false)
    if (item.onClick) {
      item.onClick()
    }
  }
  
  return (
    <>
      {/* Backdrop when menu is open */}
      {hasMenu && isOpen && (
        <div 
          className="fab-backdrop"
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            zIndex: 98,
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}
      
      {/* Menu Items */}
      {hasMenu && (
        <div className={`fab-menu ${isOpen ? 'open' : ''}`}>
          {menuItems.map((item, index) => (
            <button
              key={index}
              className="fab-menu-item"
              onClick={() => handleMenuItemClick(item)}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {item.icon && <span className="fab-menu-icon">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* FAB Button */}
      <button 
        className={`fab ${isOpen ? 'open' : ''}`}
        onClick={handleClick}
        aria-label={ariaLabel}
        style={isOpen ? { transform: 'rotate(45deg)' } : {}}
      >
        {icon || (hasMenu ? (isOpen ? <CloseIcon /> : <PlusIcon />) : <PlusIcon />)}
      </button>
    </>
  )
}

export default FloatingActionButton

