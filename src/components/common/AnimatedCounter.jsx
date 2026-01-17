/**
 * Animated Counter Component
 * Smoothly animates numbers from 0 to target value
 */
import { useEffect, useState, useRef } from 'react'

export const AnimatedCounter = ({ 
  value, 
  duration = 1000, 
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  startOnView = true
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const [hasAnimated, setHasAnimated] = useState(false)
  const elementRef = useRef(null)
  const animationRef = useRef(null)
  
  useEffect(() => {
    if (!startOnView) {
      animateValue()
      return
    }
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          animateValue()
        }
      },
      { threshold: 0.1 }
    )
    
    if (elementRef.current) {
      observer.observe(elementRef.current)
    }
    
    return () => observer.disconnect()
  }, [value, hasAnimated, startOnView])
  
  const animateValue = () => {
    const startTime = Date.now()
    const startValue = 0
    const endValue = typeof value === 'number' ? value : parseFloat(value) || 0
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      
      // Ease out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const currentValue = startValue + (endValue - startValue) * easeOut
      
      setDisplayValue(currentValue)
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate)
      }
    }
    
    animationRef.current = requestAnimationFrame(animate)
  }
  
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [])
  
  const formattedValue = decimals > 0 
    ? displayValue.toFixed(decimals) 
    : Math.round(displayValue)
  
  return (
    <span 
      ref={elementRef} 
      className={`counter-animated counter-value ${className}`}
    >
      {prefix}{formattedValue}{suffix}
    </span>
  )
}

export default AnimatedCounter

