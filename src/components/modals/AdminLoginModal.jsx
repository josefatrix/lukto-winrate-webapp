/**
 * Admin Login Modal
 */
import React, { useState } from 'react'
import { useApp, ADMIN_PASSWORD } from '../../contexts'

export const AdminLoginModal = ({ onClose }) => {
  const { setIsAdmin } = useApp()
  const [passwordInput, setPasswordInput] = useState('')
  const [loginError, setLoginError] = useState('')

  const handleAdminLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true)
      try {
        localStorage.setItem('lukto_admin', 'true')
      } catch {
        /* Ignore */
      }
      onClose()
    } else {
      setLoginError('Contraseña incorrecta')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Acceso Admin</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input
            type="password"
            value={passwordInput}
            onChange={e => {
              setPasswordInput(e.target.value)
              setLoginError('')
            }}
            onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
            placeholder="Ingresa la contraseña"
            autoFocus
          />
          {loginError && <p className="error-text">{loginError}</p>}
        </div>
        <button className="submit-btn" onClick={handleAdminLogin}>
          ENTRAR
        </button>
      </div>
    </div>
  )
}

export default AdminLoginModal

