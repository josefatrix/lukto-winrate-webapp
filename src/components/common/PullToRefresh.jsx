/**
 * Pull to Refresh Component
 * Native-like pull gesture to refresh content
 */
import { useState, useRef, useCallback } from 'react'

export const PullToRefresh = ({ 
  onRefresh, 
  children, 
  threshold = 80,
  disabled = false 
}) => {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef(null)
  const startY = useRef(0)
  const isPulling = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return
    
    const container = containerRef.current
    if (!container || container.scrollTop > 0) return
    
    startY.current = e.touches[0].clientY
    isPulling.current = true
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e) => {
    if (!isPulling.current || disabled || isRefreshing) return
    
    const container = containerRef.current
    if (!container || container.scrollTop > 0) {
      isPulling.current = false
      setPullDistance(0)
      return
    }
    
    const currentY = e.touches[0].clientY
    const diff = currentY - startY.current
    
    if (diff > 0) {
      // Apply resistance - pull gets harder as you go
      const resistance = Math.min(diff * 0.4, threshold * 1.5)
      setPullDistance(resistance)
      
      if (diff > 10) {
        e.preventDefault()
      }
    }
  }, [disabled, isRefreshing, threshold])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled) return
    
    isPulling.current = false
    
    if (pullDistance >= threshold && onRefresh) {
      setIsRefreshing(true)
      
      try {
        await onRefresh()
      } catch (error) {
        console.error('Refresh error:', error)
      }
      
      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10)
      }
      
      setIsRefreshing(false)
    }
    
    setPullDistance(0)
  }, [pullDistance, threshold, onRefresh, disabled])

  const progress = Math.min(pullDistance / threshold, 1)
  const showIndicator = pullDistance > 0 || isRefreshing

  return (
    <div 
      ref={containerRef}
      className="pull-to-refresh-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className={`pull-indicator ${showIndicator ? 'visible' : ''} ${isRefreshing ? 'refreshing' : ''}`}
        style={{ 
          transform: `translateY(${isRefreshing ? 0 : pullDistance - 60}px)`,
          opacity: isRefreshing ? 1 : progress
        }}
      >
        <div className="pull-indicator-inner">
          {isRefreshing ? (
            <svg className="pull-spinner" viewBox="0 0 24 24" width="24" height="24">
              <circle 
                cx="12" 
                cy="12" 
                r="10" 
                fill="none" 
                stroke="var(--accent-green)" 
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="31.4 31.4"
              />
            </svg>
          ) : (
            <svg 
              className="pull-arrow" 
              viewBox="0 0 24 24" 
              width="24" 
              height="24"
              style={{ 
                transform: `rotate(${progress >= 1 ? 180 : 0}deg)`,
                transition: 'transform 0.2s ease'
              }}
            >
              <path 
                d="M12 4v12m0 0l-4-4m4 4l4-4" 
                fill="none" 
                stroke="var(--accent-green)" 
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="pull-text">
            {isRefreshing ? 'Actualizando...' : progress >= 1 ? 'Soltar para actualizar' : 'Desliza para actualizar'}
          </span>
        </div>
      </div>
      
      {/* Content with pull transform */}
      <div 
        className="pull-content"
        style={{ 
          transform: `translateY(${isRefreshing ? 50 : pullDistance * 0.3}px)`,
          transition: isPulling.current ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default PullToRefresh

