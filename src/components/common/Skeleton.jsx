/**
 * Skeleton Loading Component
 * Shows placeholder content while data loads
 */


export const SkeletonRow = () => (
  <div className="skeleton-row">
    <div className="skeleton skeleton-avatar" />
    <div className="skeleton skeleton-text" />
    <div className="skeleton skeleton-text short" />
  </div>
)

export const SkeletonTable = ({ rows = 5 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <SkeletonRow key={i} />
    ))}
  </div>
)

export const SkeletonCard = () => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-header" />
    <div className="skeleton skeleton-body" />
  </div>
)

export const Skeleton = ({ type = 'text', width, height, className = '' }) => {
  const style = {}
  if (width) style.width = width
  if (height) style.height = height

  return <div className={`skeleton skeleton-${type} ${className}`} style={style} />
}

export default Skeleton

