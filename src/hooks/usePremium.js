/**
 * Premium UX Hook
 * Haptic feedback, animations, and premium interactions
 */
import { useCallback, useRef, useState, useEffect } from 'react'

/**
 * Trigger haptic feedback (vibration)
 * Works on mobile devices that support it
 */
export const useHaptic = () => {
  const triggerHaptic = useCallback((type = 'light') => {
    if (!navigator.vibrate) return
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 10],
      error: [50, 30, 50, 30, 50],
      warning: [30, 20, 30],
      selection: [5],
    }
    
    try {
      navigator.vibrate(patterns[type] || patterns.light)
    } catch (e) {
      // Silently fail if vibration not supported
    }
  }, [])
  
  return { triggerHaptic }
}

/**
 * Animated counter hook
 * Smoothly animates a number from 0 to target
 */
export const useAnimatedCounter = (targetValue, duration = 1000, startOnMount = true) => {
  const [value, setValue] = useState(0)
  const startTimeRef = useRef(null)
  const frameRef = useRef(null)
  
  const animate = useCallback(() => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }
    
    const elapsed = Date.now() - startTimeRef.current
    const progress = Math.min(elapsed / duration, 1)
    
    // Ease out cubic
    const easeOut = 1 - Math.pow(1 - progress, 3)
    const currentValue = Math.round(targetValue * easeOut)
    
    setValue(currentValue)
    
    if (progress < 1) {
      frameRef.current = requestAnimationFrame(animate)
    }
  }, [targetValue, duration])
  
  const start = useCallback(() => {
    startTimeRef.current = null
    setValue(0)
    frameRef.current = requestAnimationFrame(animate)
  }, [animate])
  
  const reset = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current)
    }
    startTimeRef.current = null
    setValue(0)
  }, [])
  
  useEffect(() => {
    if (startOnMount && targetValue > 0) {
      start()
    }
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [targetValue, startOnMount, start])
  
  return { value, start, reset }
}

/**
 * Pull to refresh hook
 */
export const usePullToRefresh = (onRefresh, threshold = 80) => {
  const [isPulling, setIsPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startY = useRef(0)
  const containerRef = useRef(null)
  
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [])
  
  const handleTouchMove = useCallback((e) => {
    if (!isPulling || isRefreshing) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - startY.current)
    
    // Apply resistance
    const resistedDistance = Math.min(distance * 0.5, threshold * 1.5)
    setPullDistance(resistedDistance)
  }, [isPulling, isRefreshing, threshold])
  
  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return
    
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      
      try {
        await onRefresh()
      } finally {
        setIsRefreshing(false)
      }
    }
    
    setIsPulling(false)
    setPullDistance(0)
  }, [isPulling, pullDistance, threshold, isRefreshing, onRefresh])
  
  useEffect(() => {
    const container = containerRef.current || window
    
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: true })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })
    
    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])
  
  return {
    containerRef,
    isPulling,
    pullDistance,
    isRefreshing,
    progress: Math.min(pullDistance / threshold, 1),
  }
}

/**
 * Intersection Observer hook for lazy animations
 */
export const useInView = (options = {}) => {
  const [isInView, setIsInView] = useState(false)
  const ref = useRef(null)
  
  useEffect(() => {
    const element = ref.current
    if (!element) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (options.once !== false) {
            observer.unobserve(element)
          }
        } else if (options.once === false) {
          setIsInView(false)
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px',
      }
    )
    
    observer.observe(element)
    
    return () => observer.disconnect()
  }, [options.threshold, options.rootMargin, options.once])
  
  return { ref, isInView }
}

/**
 * Stagger animation delay calculator
 */
export const getStaggerDelay = (index, baseDelay = 0.05) => ({
  animationDelay: `${index * baseDelay}s`,
})

/**
 * Premium button handler with haptic
 */
export const usePremiumButton = () => {
  const { triggerHaptic } = useHaptic()
  
  const handleClick = useCallback((callback) => (e) => {
    triggerHaptic('light')
    if (callback) callback(e)
  }, [triggerHaptic])
  
  const handleSuccess = useCallback((callback) => (e) => {
    triggerHaptic('success')
    if (callback) callback(e)
  }, [triggerHaptic])
  
  const handleError = useCallback((callback) => (e) => {
    triggerHaptic('error')
    if (callback) callback(e)
  }, [triggerHaptic])
  
  return { handleClick, handleSuccess, handleError }
}

export default {
  useHaptic,
  useAnimatedCounter,
  usePullToRefresh,
  useInView,
  getStaggerDelay,
  usePremiumButton,
}

