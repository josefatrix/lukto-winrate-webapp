/**
 * Custom hook for localStorage with iOS Safari compatibility
 */
import { useState, useEffect } from 'react'

/**
 * Hook to persist state in localStorage
 * Handles iOS private browsing mode gracefully
 */
export const useLocalStorage = (key, initialValue) => {
  // Get initial value from localStorage or use default
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key)
      return item !== null ? JSON.parse(item) : initialValue
    } catch {
      // localStorage not available (iOS private mode)
      return initialValue
    }
  })

  // Sync to localStorage when value changes
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Ignore localStorage errors in private mode
    }
  }, [key, value])

  // Remove from localStorage
  const remove = () => {
    try {
      localStorage.removeItem(key)
      setValue(initialValue)
    } catch {
      // Ignore errors
    }
  }

  return [value, setValue, remove]
}

export default useLocalStorage

