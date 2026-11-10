/**
 * Modal Component
 * Reusable modal dialog with Liquid Glass effect
 */
import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'

export const Modal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '',
  showCloseButton = true,
  size = 'medium',
  disableGlass = false
}) => {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const modalInner = (
    <>
      {(title || showCloseButton) && (
        <div className="modal-header">
          {title && <h2 className="modal-title">{title}</h2>}
          {showCloseButton && (
            <button className="modal-close" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          )}
        </div>
      )}
      <div className="modal-body">
        {children}
      </div>
    </>
  )

  /* El overlay va al <body>, no donde esté el componente.
     `position: fixed` deja de medirse contra la ventana en cuanto un ancestro
     tiene transform, filter o contain, y varias secciones de la app terminan
     con `transform: translateY(0)` pegado por animaciones con `forwards`.
     Dentro de una de ellas el modal se centraba respecto a la sección entera
     — en la pestaña de Nuevo Partido, miles de píxeles de alto — así que
     aparecía a media página, cortado por abajo y sin poder desplazarse,
     porque el <body> queda bloqueado mientras hay un modal abierto. */
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className={`modal-content ${!disableGlass ? 'modal-glass' : ''} modal-${size} ${className}`}
        style={{ maxWidth: size === 'large' ? '640px' : size === 'small' ? '340px' : '480px', width: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {modalInner}
      </div>
    </div>,
    document.body
  )
}

export default Modal

