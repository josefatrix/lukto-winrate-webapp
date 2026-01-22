import { useEffect, useMemo, useState } from 'react'

const getInitials = name => {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const AvatarImage = ({ src, name, imgClassName = '', fallbackClassName = '', fallbackText = '' }) => {
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  const initials = useMemo(() => {
    const trimmed = fallbackText?.trim?.()
    if (trimmed) return trimmed
    return getInitials(name)
  }, [name, fallbackText])

  if (src && !errored) {
    return (
      <img
        src={src}
        alt=""
        className={imgClassName}
        referrerPolicy="no-referrer"
        onError={() => setErrored(true)}
      />
    )
  }

  return <span className={fallbackClassName}>{initials}</span>
}
