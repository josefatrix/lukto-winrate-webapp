/**
 * The chat sheet, shared by the stats bot and the match-builder panel.
 *
 * Every state has something on screen. A sheet that goes blank when the quota
 * runs out or the model declines reads as a broken app, not as a limit.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { AppIcon } from './AppIcon'
import { Modal } from './Modal'

const Dots = () => (
  <span className="as-dots" aria-label="pensando">
    <i />
    <i />
    <i />
  </span>
)

const SendIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h13M12 5l7 7-7 7" />
  </svg>
)

const quotaTone = remaining => {
  if (typeof remaining !== 'number') return 'unknown'
  if (remaining === 0) return 'empty'
  return remaining <= 3 ? 'true' : 'false'
}

export const AssistantSheet = ({
  open,
  onClose,
  title = 'Pregúntale a Lucato',
  placeholder = 'Escribe tu pregunta…',
  emptyHint = 'Pregunta lo que quieras sobre los partidos, las rachas o los equipos.',
  loadingHint = '',
  chips = [],
  assistant,
  linked = true,
  renderAction,
}) => {
  const [draft, setDraft] = useState('')
  const threadRef = useRef(null)
  const inputRef = useRef(null)
  const metaRef = useRef(null)
  const dragRef = useRef(null)

  const { messages, ask, reset, loading, error, remaining, limit, quotaExhausted, turnLimitReached } =
    assistant

  useEffect(() => {
    /* Sin foco automático en táctil: abriría el teclado encima de la hoja
       antes de que el usuario llegue a leer nada. */
    if (open && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  /* Deslizar hacia abajo para cerrar. La agarradera promete que la hoja se
     desliza; sin esto, la promesa es mentira. Solo en la variante de hoja
     inferior, y solo desde la cabecera: arrastrar sobre el hilo tiene que
     seguir siendo scroll. */
  const sheetOf = node => node?.closest('.assistant-sheet') || null

  const onDragStart = useCallback(event => {
    if (!window.matchMedia?.('(max-width: 560px)').matches) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const sheet = sheetOf(event.currentTarget)
    if (!sheet) return
    dragRef.current = { startY: event.clientY, startedAt: Date.now(), sheet, moved: 0 }
    sheet.style.transition = 'none'
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [])

  const onDragMove = useCallback(event => {
    const drag = dragRef.current
    if (!drag) return
    const delta = event.clientY - drag.startY
    /* Hacia arriba no se despega: se frena, como en la vida real. */
    drag.moved = delta > 0 ? delta : delta / 4
    drag.sheet.style.transform = `translateY(${drag.moved}px)`
  }, [])

  const onDragEnd = useCallback(event => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)

    const elapsed = Math.max(Date.now() - drag.startedAt, 1)
    const velocity = drag.moved / elapsed
    /* Un empujón rápido alcanza; no hace falta arrastrar media pantalla. */
    const dismiss = drag.moved > 120 || velocity > 0.5

    drag.sheet.style.transition = 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)'
    drag.sheet.style.transform = dismiss ? 'translateY(100%)' : ''
    if (dismiss) window.setTimeout(onClose, 180)
  }, [onClose])

  /* La cabecera la dibuja Modal, así que sus escuchas se enganchan a mano:
     la agarradera vive ahí y es el sitio donde la gente agarra. */
  useEffect(() => {
    if (!open) return undefined
    const header = metaRef.current?.closest('.assistant-sheet')?.querySelector('.modal-header')
    if (!header) return undefined
    header.addEventListener('pointerdown', onDragStart)
    header.addEventListener('pointermove', onDragMove)
    header.addEventListener('pointerup', onDragEnd)
    header.addEventListener('pointercancel', onDragEnd)
    return () => {
      header.removeEventListener('pointerdown', onDragStart)
      header.removeEventListener('pointermove', onDragMove)
      header.removeEventListener('pointerup', onDragEnd)
      header.removeEventListener('pointercancel', onDragEnd)
    }
  }, [open, onDragStart, onDragMove, onDragEnd])

  /* Al cerrar y volver a abrir, la hoja no puede quedar desplazada. */
  useEffect(() => {
    if (open) return
    const sheet = metaRef.current?.closest('.assistant-sheet')
    if (sheet) {
      sheet.style.transition = ''
      sheet.style.transform = ''
    }
  }, [open])

  const blocked = !linked || quotaExhausted || turnLimitReached
  const canSend = !!draft.trim() && !loading && !blocked

  const submit = event => {
    event.preventDefault()
    if (!canSend) return
    const question = draft.trim()
    setDraft('')
    ask(question)
  }

  const sendChip = text => {
    if (loading || blocked) return
    setDraft('')
    ask(text)
  }

  return (
    <Modal isOpen={open} onClose={onClose} title={title} size="large" className="assistant-sheet">
      <div
        className="as-meta as-drag"
        ref={metaRef}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        {typeof remaining === 'number' ? (
          <span className="as-remaining" data-low={quotaTone(remaining)}>
            {remaining === 0
              ? 'Sin preguntas por hoy'
              : `${remaining} ${remaining === 1 ? 'pregunta' : 'preguntas'} hoy`}
          </span>
        ) : (
          <span className="as-remaining" data-low="unknown">
            {limit ? `${limit} preguntas al día` : 'Hay un cupo diario'}
          </span>
        )}
        {messages.length > 0 && (
          <button type="button" className="as-reset" onClick={reset}>
            Empezar de nuevo
          </button>
        )}
      </div>

      <div className="as-thread" ref={threadRef}>
        {messages.length === 0 && !loading && (
          <div className="as-empty">
            <span className="as-empty-spark">
              <AppIcon name="spark" size={20} />
            </span>
            {linked
              ? emptyHint
              : 'Tu cuenta todavía no está vinculada a un jugador. Pídele al admin que te vincule y vuelve.'}
          </div>
        )}

        {messages.map((message, index) => (
          <div key={index} className={`as-msg as-msg-${message.role}`}>
            <p className="as-text">{message.text}</p>
            {message.actionError && <p className="as-action-error">{message.actionError}</p>}
            {message.accion && renderAction && (
              <div className="as-action">{renderAction(message.accion, index)}</div>
            )}
          </div>
        ))}

        {loading && (
          <div className="as-msg as-msg-assistant as-msg-loading">
            <Dots />
            {loadingHint && <span className="as-loading-hint">{loadingHint}</span>}
          </div>
        )}
      </div>

      {error && (
        <p className="as-error" role="alert">
          {error}
        </p>
      )}

      {turnLimitReached && (
        <p className="as-notice">
          Esta conversación ya es larga. Toca «Empezar de nuevo» para seguir preguntando.
        </p>
      )}

      {quotaExhausted && !turnLimitReached && (
        <p className="as-notice">Se se te acabaron las preguntas de hoy. Vuelve mañana.</p>
      )}

      {chips.length > 0 && messages.length === 0 && !blocked && (
        <div className="as-chips">
          {chips.map(chip => (
            <button key={chip} type="button" className="as-chip" onClick={() => sendChip(chip)}>
              {chip}
            </button>
          ))}
        </div>
      )}

      <form className="as-form" onSubmit={submit}>
        <input
          ref={inputRef}
          className="as-input"
          value={draft}
          onChange={event => setDraft(event.target.value.slice(0, 500))}
          placeholder={blocked ? 'No disponible ahora' : placeholder}
          disabled={blocked || loading}
          maxLength={500}
          aria-label="Tu pregunta"
        />
        <button type="submit" className="as-send" disabled={!canSend} aria-label="Enviar">
          {loading ? <Dots /> : <SendIcon />}
        </button>
      </form>
    </Modal>
  )
}

export default AssistantSheet
