/**
 * Sparkline Component
 * Mini inline trend charts
 */
import { useMemo } from 'react'

export const Sparkline = ({ 
  data = [], 
  width = 60, 
  height = 20,
  strokeWidth = 1.5,
  showDot = true,
  animated = true,
  className = ''
}) => {
  const { path, trend, lastPoint } = useMemo(() => {
    if (!data.length) return { path: '', trend: 'neutral', lastPoint: null }
    
    const values = data.map(d => typeof d === 'number' ? d : d.value)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    
    // Normalize values to fit in height with padding
    const padding = 2
    const normalizedHeight = height - padding * 2
    const normalizedWidth = width - padding * 2
    
    const points = values.map((val, i) => ({
      x: padding + (i / (values.length - 1 || 1)) * normalizedWidth,
      y: padding + normalizedHeight - ((val - min) / range) * normalizedHeight
    }))
    
    // Create smooth curve using quadratic bezier
    let pathD = `M ${points[0].x} ${points[0].y}`
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]
      const curr = points[i]
      const midX = (prev.x + curr.x) / 2
      pathD += ` Q ${prev.x} ${prev.y} ${midX} ${(prev.y + curr.y) / 2}`
    }
    
    if (points.length > 1) {
      const last = points[points.length - 1]
      pathD += ` T ${last.x} ${last.y}`
    }
    
    // Determine trend
    const firstVal = values[0]
    const lastVal = values[values.length - 1]
    const trend = lastVal > firstVal ? 'up' : lastVal < firstVal ? 'down' : 'neutral'
    
    return { 
      path: pathD, 
      trend,
      lastPoint: points[points.length - 1]
    }
  }, [data, width, height])

  if (!data.length) return null

  const trendColors = {
    up: 'var(--accent-green)',
    down: 'var(--accent-red)',
    neutral: 'var(--text-muted)'
  }

  const color = trendColors[trend]

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox={`0 0 ${width} ${height}`}
      className={`sparkline sparkline-${trend} ${className}`}
    >
      <defs>
        <linearGradient id={`sparkGrad-${trend}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      
      {/* Area fill */}
      <path
        d={`${path} L ${width - 2} ${height - 2} L 2 ${height - 2} Z`}
        fill={`url(#sparkGrad-${trend})`}
        className={animated ? 'sparkline-area' : ''}
      />
      
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={animated ? 'sparkline-line' : ''}
      />
      
      {/* End dot */}
      {showDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={2.5}
          fill={color}
          className={animated ? 'sparkline-dot' : ''}
        />
      )}
    </svg>
  )
}

// Trend indicator with sparkline
export const TrendIndicator = ({ 
  value, 
  data, 
  suffix = '',
  showSparkline = true,
  className = ''
}) => {
  const trend = useMemo(() => {
    if (!data || data.length < 2) return 'neutral'
    const first = data[0]
    const last = data[data.length - 1]
    return last > first ? 'up' : last < first ? 'down' : 'neutral'
  }, [data])

  const TrendIcon = () => {
    if (trend === 'up') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" className="trend-icon trend-up">
          <path d="M6 2L10 6L8 6L8 10L4 10L4 6L2 6L6 2Z" fill="var(--accent-green)" />
        </svg>
      )
    }
    if (trend === 'down') {
      return (
        <svg width="12" height="12" viewBox="0 0 12 12" className="trend-icon trend-down">
          <path d="M6 10L2 6L4 6L4 2L8 2L8 6L10 6L6 10Z" fill="var(--accent-red)" />
        </svg>
      )
    }
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="trend-icon trend-neutral">
        <rect x="2" y="5" width="8" height="2" rx="1" fill="var(--text-muted)" />
      </svg>
    )
  }

  return (
    <div className={`trend-indicator ${className}`}>
      <span className="trend-value">{value}{suffix}</span>
      <TrendIcon />
      {showSparkline && data && data.length > 1 && (
        <Sparkline data={data} width={40} height={16} />
      )}
    </div>
  )
}

export default Sparkline

