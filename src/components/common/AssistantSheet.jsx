/**
 * The chat sheet, shared by the stats bot and the match-builder panel.
 *
 * Every state has something on screen. A sheet that goes blank when the quota
 * runs out or the model declines reads as a broken app, not as a limit.
 */
import { useEffect, useRef, useState } from 'react'

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
  title = 'Preguntale a Lucato',
  placeholder = 'Escribí tu pregunta…',
  emptyHint = 'Preguntá lo que quieras sobre los partidos, las rachas o los equipos.',
  chips = [],
  assistant,
  linked = true,
  renderAction,
}) => {
  const [draft, setDraft] = useState('')
  const threadRef = useRef(null)
  const inputRef = useRef(null)

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
      <div className="as-meta">
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
              : 'Tu cuenta todavía no está vinculada a un jugador. Pedile al admin que te vincule y volvé.'}
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
          Esta conversación ya es larga. Pulsá «Empezar de nuevo» para seguir preguntando.
        </p>
      )}

      {quotaExhausted && !turnLimitReached && (
        <p className="as-notice">Se te acabaron las preguntas de hoy. Volvé mañana.</p>
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
