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
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'

/* The same day key the endpoint charges against. A client computing its own
   in UTC reports a fresh quota from 19:00 local onwards — exactly the hours
   this group plays. The module is pure, so importing it costs nothing. */
import { dayKey } from '../../api/_lib/aiRateLimit.js'
import { auth, db } from '../firebase'

/** Ten turns, two messages each — the server rejects more. */
const MAX_HISTORY_MESSAGES = 20
const REQUEST_TIMEOUT_MS = 120_000

const NETWORK_ERROR = 'No pude conectarme. Revisá tu internet y probá de nuevo.'
const TIMEOUT_ERROR = 'El asistente tardó demasiado. Probá de nuevo.'
const SESSION_ERROR = 'Necesitás iniciar sesión para usar el asistente.'

export const useAiAssistant = ({ mode, buildFacts, validateAction }) => {
  const [messages, setMessages] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState(null)
  /* The server owns the cap — 15 for members, 50 for admins — and tells us on
     every answer. Until then we show no number rather than a wrong one. */
  const [limit, setLimit] = useState(null)
  const [conversationId, setConversationId] = useState(0)

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
  /* Firebase restores the session asynchronously, so auth.currentUser is null
     when this first runs. Subscribing to the auth state instead of reading it
     once is what makes the counter appear at all. */
  useEffect(() => {
    let stopUsage = null
    const stopAuth = onAuthStateChanged(auth, user => {
      stopUsage?.()
      stopUsage = null
      if (!user) return setRemaining(null)
      stopUsage = onSnapshot(
        doc(db, 'aiUsage', user.uid),
        snapshot => {
          const data = snapshot.data()
          if (!data?.day || limit === null) return
          const spent = data.day === dayKey() ? Number(data.count) || 0 : 0
          setRemaining(Math.max(limit - spent, 0))
        },
        () => setRemaining(null)
      )
    })
    return () => {
      stopUsage?.()
      stopAuth()
    }
  }, [limit])

  const turnLimitReached = history.length >= MAX_HISTORY_MESSAGES
  const quotaExhausted = remaining === 0

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setHistory([])
    setError('')
    setLoading(false)
    /* Anything keyed by message index — the builder's applied/discarded
       proposals — has to be able to tell conversations apart. */
    setConversationId(current => current + 1)
  }, [])

  /* `display` deja mostrar algo distinto de lo que se envía: el botón «Armar
     con Lucato» manda un prompt largo que el usuario nunca escribió, y verlo
     en su propia burbuja es desconcertante. */
  const ask = useCallback(
    async (question, { display } = {}) => {
      const text = String(question || '').trim()
      if (!text || loading || turnLimitReached || quotaExhausted) return

      setError('')
      setLoading(true)
      setMessages(current => [...current, { role: 'user', text: display || text }])

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

        if (typeof payload.limit === 'number') setLimit(payload.limit)
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
      limit,
      conversationId,
      quotaExhausted,
      turnLimitReached,
    }),
    [messages, ask, reset, loading, error, remaining, limit, conversationId, quotaExhausted, turnLimitReached]
  )
}
