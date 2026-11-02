/**
 * One conversation with the assistant.
 *
 * The history is append-only: every assistant turn is stored as the raw
 * `content` array the API returned — thinking blocks included — and replayed
 * verbatim. Rebuilding a turn from its text, or trimming old turns, would
 * invalidate every thinking block after it and the next request would be
 * rejected. At the turn cap we start a new conversation instead of trimming.
 *
 * `buildFacts` is a function, not a value: in builder mode the facts change
 * every turn, and a stale `repartoActual` is exactly how the assistant ends up
 * contradicting the screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'

import { auth, db } from '../firebase'

/** Ten turns, two messages each — the server rejects more. */
const MAX_HISTORY_MESSAGES = 20
const REQUEST_TIMEOUT_MS = 120_000
const DAILY_LIMIT_HINT = 15

const NETWORK_ERROR = 'No pude conectarme. Revisá tu internet y probá de nuevo.'
const TIMEOUT_ERROR = 'El asistente tardó demasiado. Probá de nuevo.'
const SESSION_ERROR = 'Necesitás iniciar sesión para usar el asistente.'

export const useAiAssistant = ({ mode, buildFacts, validateAction }) => {
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)

  const abortRef = useRef(null)

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  /* The counter is readable by its owner, so the sheet can show it without
     asking the server. A response's own `remaining` wins when it arrives,
     which is how two open tabs converge on the server's number. */
  useEffect(() => {
    const uid = auth.currentUser?.uid
    if (!uid) return undefined
    return onSnapshot(
      doc(db, 'aiUsage', uid),
      snapshot => {
        const data = snapshot.data()
        const today = new Date().toISOString().slice(0, 10)
        if (!data || !data.day) return setRemaining(null)
        const spent = data.day >= today ? Number(data.count) || 0 : 0
        setRemaining(Math.max(DAILY_LIMIT_HINT - spent, 0))
      },
      () => setRemaining(null)
    )
  }, [])

  const turnLimitReached = history.length >= MAX_HISTORY_MESSAGES
  const quotaExhausted = remaining === 0

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setHistory([])
    setError('')
    setLoading(false)
  }, [])

  const ask = useCallback(
    async question => {
      const text = String(question || '').trim()
      if (!text || loading || turnLimitReached || quotaExhausted) return

      setError('')
      setLoading(true)
      setMessages(current => [...current, { role: 'user', text }])

      const controller = new AbortController()
      abortRef.current = controller
      const timeout = setTimeout(() => controller.abort('timeout'), REQUEST_TIMEOUT_MS)

      try {
        const user = auth.currentUser
        if (!user) throw new Error(SESSION_ERROR)
        const token = await user.getIdToken()

        const response = await fetch('/api/assistant', {
          method: 'POST',
          signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode, question: text, facts: buildFacts(), history }),
        })

        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || NETWORK_ERROR)

        /* Both turns go into the history exactly as the request carried them.
           The user turn comes back from the server because only the server
           knows how it assembled the facts block, and the history check
           compares bytes. If it is missing we start fresh rather than replay
           something the API will reject. */
        setHistory(current =>
          payload.userContent
            ? [
                ...current,
                { role: 'user', content: payload.userContent },
                { role: 'assistant', content: payload.content },
              ]
            : []
        )

        const checked = validateAction ? validateAction(payload.accion) : { ok: true, accion: payload.accion }
        setMessages(current => [
          ...current,
          {
            role: 'assistant',
            text: payload.respuesta,
            accion: checked.ok ? checked.accion : null,
            actionError: checked.ok ? '' : checked.reason,
          },
        ])

        if (typeof payload.remaining === 'number') setRemaining(payload.remaining)
      } catch (caught) {
        const message =
          caught?.name === 'AbortError' || caught === 'timeout'
            ? TIMEOUT_ERROR
            : caught?.message || NETWORK_ERROR
        setError(message)
        /* Drop the user bubble whose answer never came, so the thread does not
           show a question hanging with nothing under it. */
        setMessages(current => current.slice(0, -1))
      } finally {
        clearTimeout(timeout)
        abortRef.current = null
        setLoading(false)
      }
    },
    [mode, buildFacts, validateAction, history, loading, turnLimitReached, quotaExhausted]
  )

  return useMemo(
    () => ({
      messages,
      ask,
      reset,
      loading,
      error,
      remaining,
      quotaExhausted,
      turnLimitReached,
    }),
    [messages, ask, reset, loading, error, remaining, quotaExhausted, turnLimitReached]
  )
}
