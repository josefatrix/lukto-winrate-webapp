/**
 * Page Transition Component
 * Smooth fade/slide transitions between views
 */
import { useState, useEffect, useRef } from 'react'

export const PageTransition = ({ 
  children, 
  activeKey,
  direction = 'fade', // 'fade', 'slide', 'scale'
  duration = 300
}) => {
  const [displayContent, setDisplayContent] = useState(children)
  const [isAnimating, setIsAnimating] = useState(false)
  const [animationState, setAnimationState] = useState('enter')
  const prevKey = useRef(activeKey)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (activeKey !== prevKey.current) {
      // Start exit animation
      setIsAnimating(true)
      setAnimationState('exit')
      
      // After exit, update content and start enter
      timeoutRef.current = setTimeout(() => {
        setDisplayContent(children)
        setAnimationState('enter')
        prevKey.current = activeKey
        
        // After enter animation completes
        timeoutRef.current = setTimeout(() => {
          setIsAnimating(false)
        }, duration)
      }, duration / 2)
    } else {
      setDisplayContent(children)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [activeKey, children, duration])

  const getAnimationClass = () => {
    if (!isAnimating) return 'page-transition-idle'
    return `page-transition-${direction} page-transition-${animationState}`
  }

  return (
    <div 
      className={`page-transition-wrapper ${getAnimationClass()}`}
      style={{ '--transition-duration': `${duration}ms` }}
    >
      {displayContent}
    </div>
  )
}

// Staggered children animation wrapper
export const StaggeredList = ({ 
  children, 
  staggerDelay = 50,
  baseDelay = 0,
  className = ''
}) => {
  return (
    <div className={`staggered-list ${className}`}>
      {Array.isArray(children) ? children.map((child, index) => (
        <div 
          key={index}
          className="staggered-item"
          style={{ 
            animationDelay: `${baseDelay + (index * staggerDelay)}ms`
          }}
        >
          {child}
        </div>
      )) : children}
    </div>
  )
}

export default PageTransition

