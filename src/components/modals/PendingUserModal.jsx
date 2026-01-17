/**
 * Pending User Modal
 * Shown when user is logged in but not linked to a player
 */
import React from 'react'
import { useApp } from '../../contexts'

export const PendingUserModal = () => {
  const { user, handleLogout } = useApp()

  if (!user) return null

  return (
    <div className="modal-overlay">
      <div className="modal pending-modal">
        <div className="pending-content">
          <img src={user.photoURL} alt="" className="pending-avatar" />
          <h2>{user.displayName}</h2>
          <p className="pending-status">Cuenta registrada</p>
          <div className="pending-info">
            <p>El administrador debe vincularte con tu jugador para que puedas calificar.</p>
          </div>
          <button className="submit-btn" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  )
}

export default PendingUserModal

