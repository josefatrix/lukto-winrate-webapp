/**
 * Custom hook for toast notifications
 */
import { useState, useCallback } from 'react'

/**
 * Hook to manage toast notifications
 * @returns {Object} { toast, showToast, hideToast }
 */
export const useToast = (duration = 3000) => {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), duration)
  }, [duration])

  const hideToast = useCallback(() => {
    setToast(null)
  }, [])

  return { toast, showToast, hideToast }
}

export default useToast

