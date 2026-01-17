/**
 * Formatting and display utilities
 */

/**
 * Get CSS class based on win rate percentage
 */
export const getWinRateClass = (rate) => {
  if (rate >= 60) return 'high'
  if (rate >= 40) return 'medium'
  return 'low'
}

/**
 * Get CSS class based on rating value
 */
export const getRatingClass = (rating) => {
  if (rating >= 8) return 'high'
  if (rating >= 6) return 'medium'
  return 'low'
}

/**
 * Get initials from a name (e.g., "John Doe" -> "JD")
 */
export const getInitials = (name) => {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Format date to locale string
 */
export const formatDate = (dateString, options = {}) => {
  const defaultOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }
  return new Date(dateString).toLocaleDateString('es-ES', { ...defaultOptions, ...options })
}

/**
 * Format number with decimal places
 */
export const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-'
  return Number(num).toFixed(decimals)
}

/**
 * Format percentage
 */
export const formatPercent = (value, decimals = 0) => {
  if (value === null || value === undefined) return '-'
  return `${Number(value).toFixed(decimals)}%`
}

/**
 * Get position suffix (1st, 2nd, 3rd, etc.)
 */
export const getPositionSuffix = (position) => {
  if (position === 1) return '°'
  if (position === 2) return '°'
  if (position === 3) return '°'
  return '°'
}

/**
 * Truncate text with ellipsis
 */
export const truncate = (text, maxLength = 20) => {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
}

