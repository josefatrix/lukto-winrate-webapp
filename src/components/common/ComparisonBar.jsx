/**
 * Comparison Bar Component
 * Animated bar for head-to-head comparisons
 */
import { useEffect, useState, useRef } from 'react'

export const ComparisonBar = ({ 
  value1, 
  value2, 
  label1, 
  label2,
  color1 = 'var(--accent-green)',
  color2 = 'var(--accent-red)',
  showValues = true,
  animated = true,
  height = 8,
  className = ''
}) => {
  const [animatedPercent, setAnimatedPercent] = useState(animated ? 50 : null)
  const elementRef = useRef(null)
  const hasAnimated = useRef(false)
  
  const total = value1 + value2
  const percent1 = total > 0 ? (value1 / total) * 100 : 50
  const percent2 = total > 0 ? (value2 / total) * 100 : 50
  
  useEffect(() => {
    if (!animated || hasAnimated.current) return
    
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true
          
          // Animate from 50% to actual percentage
          const duration = 800
          const startTime = Date.now()
          
          const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = Math.min(elapsed / duration, 1)
            
            // Ease out cubic
            const easeOut = 1 - Math.pow(1 - progress, 3)
            const current = 50 + (percent1 - 50) * easeOut
            
            setAnimatedPercent(current)
            
            if (progress < 1) {
              requestAnimationFrame(animate)
            }
          }
          
          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.1 }
    )
    
    if (elementRef.current) {
      observer.observe(elementRef.current)
    }
    
    return () => observer.disconnect()
  }, [animated, percent1])
  
  const displayPercent = animated ? animatedPercent : percent1
  
  // Determine winner
  const winner = value1 > value2 ? 1 : value2 > value1 ? 2 : 0
  
  return (
    <div ref={elementRef} className={`comparison-bar-container ${className}`}>
      {/* Labels row */}
      <div className="comparison-labels">
        <span className={`comparison-label left ${winner === 1 ? 'winner' : ''}`}>
          {label1}
          {showValues && <span className="comparison-value">{value1}</span>}
        </span>
        <span className={`comparison-label right ${winner === 2 ? 'winner' : ''}`}>
          {showValues && <span className="comparison-value">{value2}</span>}
          {label2}
        </span>
      </div>
      
      {/* Bar */}
      <div 
        className="comparison-bar"
        style={{ height: `${height}px` }}
      >
        <div 
          className="comparison-bar-fill left"
          style={{ 
            width: `${displayPercent}%`,
            background: total > 0 ? color1 : 'var(--bg-glass-hover)'
          }}
        />
        <div 
          className="comparison-bar-fill right"
          style={{ 
            width: `${100 - displayPercent}%`,
            background: total > 0 ? color2 : 'var(--bg-glass-hover)'
          }}
        />
        
        {/* Center divider */}
        <div className="comparison-divider" />
      </div>
      
      {/* Percentage */}
      <div className="comparison-percentages">
        <span style={{ color: color1 }}>
          {total > 0 ? `${Math.round(percent1)}%` : '-'}
        </span>
        <span style={{ color: color2 }}>
          {total > 0 ? `${Math.round(percent2)}%` : '-'}
        </span>
      </div>
    </div>
  )
}

// Stat comparison row (for multiple stats)
export const StatComparison = ({ 
  label,
  value1,
  value2,
  format = 'number', // 'number', 'percent', 'rating'
  higherIsBetter = true,
  className = ''
}) => {
  const formatValue = (val) => {
    if (format === 'percent') return `${val}%`
    if (format === 'rating') return val.toFixed(1)
    return val
  }
  
  // Determine winner
  const diff = value1 - value2
  const winner = diff > 0 ? (higherIsBetter ? 1 : 2) : 
                 diff < 0 ? (higherIsBetter ? 2 : 1) : 0
  
  return (
    <div className={`stat-comparison ${className}`}>
      <span className={`stat-comparison-value left ${winner === 1 ? 'winner' : ''}`}>
        {formatValue(value1)}
        {winner === 1 && (
          <svg width="12" height="12" viewBox="0 0 12 12" className="winner-badge">
            <circle cx="6" cy="6" r="5" fill="var(--accent-green)" fillOpacity="0.2" />
            <path d="M4 6L5.5 7.5L8 4.5" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
      </span>
      
      <span className="stat-comparison-label">{label}</span>
      
      <span className={`stat-comparison-value right ${winner === 2 ? 'winner' : ''}`}>
        {winner === 2 && (
          <svg width="12" height="12" viewBox="0 0 12 12" className="winner-badge">
            <circle cx="6" cy="6" r="5" fill="var(--accent-green)" fillOpacity="0.2" />
            <path d="M4 6L5.5 7.5L8 4.5" stroke="var(--accent-green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        )}
        {formatValue(value2)}
      </span>
    </div>
  )
}

export default ComparisonBar

