/**
 * Match Share Card
 * Turns a finished match into an image for the group chat.
 *
 * Colours here are deliberately literal instead of themed: the exported PNG
 * should look the same whether the app is in light or dark mode, and
 * html2canvas rasterises whatever is on screen.
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const INK = {
  bg: '#0E1013',
  surface: 'rgba(255,255,255,0.05)',
  line: 'rgba(255,255,255,0.08)',
  text: '#ECEDEF',
  muted: 'rgba(164,169,179,0.75)',
  faint: 'rgba(164,169,179,0.45)',
  gold: '#F5A623',
  accent: '#7A84FF',
}

const FORMATS = [
  { id: 'square', label: 'Cuadrado', width: 320, height: 320 },
  { id: 'story', label: 'Historia', width: 320, height: 569 },
]

const formatLongDate = dateStr => {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T12:00:00`)
  if (isNaN(date.getTime())) return dateStr
  return date
    .toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
    .toUpperCase()
    .replace(/\./g, '')
}

const initialsOf = name =>
  (name || '?')
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

export const MatchShareCard = ({ open, match, report, top = [], onClose, getPlayerName }) => {
  const cardRef = useRef(null)
  const [format, setFormat] = useState('square')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  useEffect(() => {
    if (open) setError('')
  }, [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || !match || typeof document === 'undefined') return null

  const spec = FORMATS.find(f => f.id === format) || FORMATS[0]
  const isStory = format === 'story'

  const scoreWhite = report?.scoreWhite
  const scoreBlack = report?.scoreBlack
  const hasScore = report?.hasFinalScore
  const winner = match.winner
  const mvp = report?.mvp || null
  const bestPair = report?.bestPair || null

  const fileName = `lukto-${match.date || 'partido'}.png`

  const downloadCanvas = canvas => {
    const link = document.createElement('a')
    link.download = fileName
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const shareImage = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    setError('')
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: INK.bg,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      })

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) {
        setError('No se pudo generar la imagen')
        setBusy(false)
        return
      }

      const file = new File([blob], fileName, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file] })
        } catch (err) {
          // The user dismissing the sheet is not an error worth reporting.
          if (err?.name !== 'AbortError') downloadCanvas(canvas)
        }
      } else {
        downloadCanvas(canvas)
      }
    } catch (err) {
      console.error('Error generando la imagen del partido:', err)
      setError('No se pudo generar la imagen')
    } finally {
      setBusy(false)
    }
  }

  const saveImage = async () => {
    if (!cardRef.current || busy) return
    setBusy(true)
    setError('')
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: INK.bg,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      })
      downloadCanvas(canvas)
    } catch (err) {
      console.error('Error guardando la imagen del partido:', err)
      setError('No se pudo generar la imagen')
    } finally {
      setBusy(false)
    }
  }

  // Shared style for the small all-caps labels on the card.
  const label = (extra = {}) => ({
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.14em',
    color: INK.muted,
    ...extra,
  })

  return createPortal(
    <div className="msc-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Compartir partido">
      <div className="msc-sheet" onClick={e => e.stopPropagation()}>
        <div className="msc-header">
          <h2>Compartir partido</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="msc-format">
          {FORMATS.map(item => (
            <button
              key={item.id}
              className={`msc-format-btn ${format === item.id ? 'active' : ''}`}
              onClick={() => setFormat(item.id)}
              aria-pressed={format === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="msc-stage">
          <div
            ref={cardRef}
            className="msc-card"
            style={{
              width: spec.width,
              height: spec.height,
              background: INK.bg,
              color: INK.text,
              padding: isStory ? '22px 20px' : '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              overflow: 'hidden',
              borderRadius: 18,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: -70,
                right: -50,
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(122,132,255,0.30), rgba(122,132,255,0) 70%)',
              }}
            />

            {/* Header */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img
                  src="/lukto-logo.png"
                  alt=""
                  crossOrigin="anonymous"
                  style={{ width: isStory ? 24 : 20, height: isStory ? 24 : 20, objectFit: 'cover', borderRadius: 6, display: 'block' }}
                />
                <span style={{ fontSize: isStory ? 11 : 10, fontWeight: 800, letterSpacing: '0.16em' }}>LUKTO</span>
              </div>
              <span style={label()}>
                {formatLongDate(match.date)}
                {match.format ? ` · ${match.format.toUpperCase()}` : ''}
              </span>
            </div>

            {/* Middle: score + MVP. Centred on the square so the card does not
                read as top-heavy; top-aligned on the story, where it fills. */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: isStory ? 'flex-start' : 'center',
              }}
            >
            {/* Score */}
            {isStory ? (
              <div style={{ position: 'relative', marginTop: 26 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.02em', color: winner === 'black' ? INK.faint : INK.text }}>BLANCO</span>
                  <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: winner === 'black' ? INK.faint : INK.text }}>
                    {hasScore ? scoreWhite : winner === 'white' ? '✓' : '–'}
                  </span>
                </div>
                <div style={{ height: 1, background: INK.line, margin: '12px 0' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.02em', color: winner === 'white' ? INK.faint : INK.text }}>NEGRO</span>
                  <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', color: winner === 'white' ? INK.faint : INK.text }}>
                    {hasScore ? scoreBlack : winner === 'black' ? '✓' : '–'}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: 22 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={label()}>BLANCO</div>
                  <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 4, color: winner === 'black' ? INK.faint : INK.text }}>
                    {hasScore ? scoreWhite : winner === 'white' ? '✓' : '–'}
                  </div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 300, color: INK.faint, padding: '0 6px' }}>–</div>
                <div style={{ textAlign: 'center' }}>
                  <div style={label()}>NEGRO</div>
                  <div style={{ fontSize: 56, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.04em', marginTop: 4, color: winner === 'white' ? INK.faint : INK.text }}>
                    {hasScore ? scoreBlack : winner === 'black' ? '✓' : '–'}
                  </div>
                </div>
              </div>
            )}

            {/* MVP */}
            {mvp && (
              isStory ? (
                <div
                  style={{
                    position: 'relative',
                    marginTop: 24,
                    padding: 14,
                    borderRadius: 14,
                    background: 'rgba(245,166,35,0.07)',
                    border: '1px solid rgba(245,166,35,0.22)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 46, height: 46, borderRadius: '50%', background: '#272C32', border: '2px solid rgba(245,166,35,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: INK.gold, flexShrink: 0 }}>
                      {initialsOf(mvp.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={label({ color: INK.gold })}>MVP</div>
                      <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>{mvp.name}</div>
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 800, color: INK.gold, letterSpacing: '-0.02em' }}>{mvp.avgRating}</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ position: 'relative', height: 1, background: INK.line, margin: '18px 0 14px' }} />
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#272C32', border: '1.5px solid rgba(245,166,35,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: INK.gold, flexShrink: 0 }}>
                      {initialsOf(mvp.name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={label({ color: INK.gold })}>MVP DEL PARTIDO</div>
                      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 1 }}>{mvp.name}</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: INK.gold, letterSpacing: '-0.02em' }}>{mvp.avgRating}</div>
                  </div>
                </>
              )
            )}

            {/* Top list */}
            {isStory && top.length > 1 && (
              <div style={{ position: 'relative', marginTop: 20 }}>
                <div style={label({ marginBottom: 9 })}>TOP DEL PARTIDO</div>
                {top.slice(1, 5).map((entry, idx) => (
                  <div key={entry.playerId} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', borderBottom: `1px solid ${INK.line}` }}>
                    <span style={{ width: 18, fontSize: 11, fontWeight: 700, color: INK.faint }}>{idx + 2}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: INK.muted }}>{entry.avgRating}</span>
                  </div>
                ))}
              </div>
            )}

            </div>

            {/* Footer */}
            <div style={{ position: 'relative', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {isStory ? (
                <span style={{ fontSize: 10, fontWeight: 600, color: INK.muted, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {bestPair
                    ? `Mejor dupla: ${getPlayerName(bestPair.p1)} + ${getPlayerName(bestPair.p2)}`
                    : match.venue || 'LUKTO'}
                </span>
              ) : (
                <div style={{ display: 'flex', gap: 6, minWidth: 0 }}>
                  {top.slice(1, 3).map((entry, idx) => (
                    <span
                      key={entry.playerId}
                      style={{ fontSize: 9, fontWeight: 600, padding: '4px 8px', borderRadius: 6, background: INK.surface, color: INK.muted, whiteSpace: 'nowrap' }}
                    >
                      {idx + 2}. {entry.name} {entry.avgRating}
                    </span>
                  ))}
                </div>
              )}
              <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: INK.faint, flexShrink: 0 }}>LUKTO STATS</span>
            </div>
          </div>
        </div>

        {error && <p className="msc-error">{error}</p>}

        <div className="msc-actions">
          <button className="msc-btn primary" onClick={shareImage} disabled={busy}>
            {busy ? 'Generando…' : 'Compartir'}
          </button>
          <button className="msc-btn" onClick={saveImage} disabled={busy}>
            Guardar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default MatchShareCard
