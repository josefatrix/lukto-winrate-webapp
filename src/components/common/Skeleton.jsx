/**
 * Premium Skeleton Loading Components
 * Apple-style shimmer loading placeholders
 */

// Base Skeleton with shimmer
export const Skeleton = ({ 
  type = 'text', 
  width, 
  height, 
  className = '',
  style: customStyle = {} 
}) => {
  const style = { ...customStyle }
  if (width) style.width = width
  if (height) style.height = height

  return <div className={`skeleton skeleton-${type} ${className}`} style={style} />
}

// Skeleton Row (player list item)
export const SkeletonRow = ({ delay = 0 }) => (
  <div className="skeleton-row" style={{ animationDelay: `${delay}s` }}>
    <div className="skeleton skeleton-avatar" />
    <div style={{ flex: 1 }}>
      <div className="skeleton skeleton-text medium" />
      <div className="skeleton skeleton-text short" style={{ marginTop: '6px' }} />
    </div>
    <div className="skeleton skeleton-text" style={{ width: '50px' }} />
  </div>
)

// Skeleton Table (stats table)
export const SkeletonTable = ({ rows = 5 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} delay={i * 0.1} />
    ))}
  </div>
)

// Skeleton Card (match card, player card)
export const SkeletonCard = ({ height = '120px' }) => (
  <div className="skeleton skeleton-card" style={{ height }} />
)

// Skeleton Stats Grid (featured players, quick stats)
export const SkeletonStatsGrid = ({ count = 4 }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div 
        key={i} 
        className="skeleton skeleton-card" 
        style={{ height: '80px', animationDelay: `${i * 0.1}s` }} 
      />
    ))}
  </div>
)

// Skeleton Profile Header
export const SkeletonProfileHeader = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
    <div className="skeleton skeleton-avatar" style={{ width: '64px', height: '64px' }} />
    <div style={{ flex: 1 }}>
      <div className="skeleton skeleton-text medium" style={{ marginBottom: '8px' }} />
      <div className="skeleton skeleton-text short" />
    </div>
  </div>
)

// Skeleton Match Card
export const SkeletonMatchCard = ({ delay = 0 }) => (
  <div 
    className="skeleton skeleton-card" 
    style={{ 
      height: '180px', 
      marginBottom: '12px',
      animationDelay: `${delay}s`
    }} 
  />
)

// Skeleton Matches List
export const SkeletonMatchesList = ({ count = 3 }) => (
  <div>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonMatchCard key={i} delay={i * 0.15} />
    ))}
  </div>
)

// Full Page Loading
export const SkeletonPage = () => (
  <div style={{ padding: '16px' }}>
    <SkeletonProfileHeader />
    <div style={{ marginTop: '24px' }}>
      <div className="skeleton skeleton-text" style={{ width: '100px', marginBottom: '16px' }} />
      <SkeletonStatsGrid count={4} />
    </div>
    <div style={{ marginTop: '24px' }}>
      <div className="skeleton skeleton-text" style={{ width: '120px', marginBottom: '16px' }} />
      <SkeletonTable rows={5} />
    </div>
  </div>
)

export default Skeleton

