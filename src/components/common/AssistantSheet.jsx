/**
 * The chat sheet, shared by the stats bot and the match-builder panel.
 *
 * Every state has something on screen. A sheet that goes blank when the quota
 * runs out or the model declines reads as a broken app, not as a limit.
 */
import { useEffect, useRef, useState } from 'react'

import { Modal } from './Modal'

const Dots = () => (
  <span className="as-dots" aria-label="pensando">
    <i />
    <i />
    <i />
  </span>
)

export const AssistantSheet = ({
  open,
  onClose,
  title = 'Preguntale a Claude',
  placeholder = 'Escribí tu pregunta…',
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
    if (open) inputRef.current?.focus()
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
          <span className="as-remaining">
            {remaining === 0
              ? 'Sin preguntas disponibles hoy'
              : `Te quedan ${remaining} ${remaining === 1 ? 'pregunta' : 'preguntas'} hoy`}
          </span>
        ) : (
          <span className="as-remaining as-remaining-unknown">
            {limit ? `Cupo diario: ${limit} preguntas` : 'Hay un cupo diario de preguntas'}
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
          <p className="as-empty">
            {linked
              ? 'Preguntá lo que quieras sobre los partidos, las rachas o los equipos.'
              : 'Tu cuenta todavía no está vinculada a un jugador. Pedile al admin que te vincule y volvé.'}
          </p>
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
        <button type="submit" className="as-send" disabled={!canSend}>
          {loading ? '…' : 'Enviar'}
        </button>
      </form>
    </Modal>
  )
}

export default AssistantSheet
