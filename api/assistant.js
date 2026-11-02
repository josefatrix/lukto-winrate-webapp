/**
 * POST /api/assistant — the only place the Anthropic key exists.
 *
 * Runs on Vercel's default Node runtime (no `edge`), deployed by the same
 * `vercel --prod` the CI already runs on every push to main. The browser never
 * sees the key; it sends a Firebase ID token and gets back an answer.
 *
 * Secrets, both without a VITE_ prefix (that prefix is what would inline them
 * into the browser bundle):
 *   ANTHROPIC_API_KEY        — the key from console.anthropic.com
 *   FIREBASE_SERVICE_ACCOUNT — service-account JSON for lukto-tracker, one line
 */
import Anthropic from '@anthropic-ai/sdk'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

import {
  AssistantReplyError,
  buildRequest,
  parseAssistantReply,
  usesBetaPath,
} from './_lib/assistant.js'
import { AuthError, authorize } from './_lib/auth.js'
import { QuotaError, dayKey, refundQuestion, reserveQuestion } from './_lib/aiRateLimit.js'
import { verifyFirebaseIdToken } from './_lib/firebaseToken.js'
import { validateBody } from './_lib/validateBody.js'

const GENERIC_ERROR = 'El asistente no está disponible ahora mismo. Probá en un rato.'

/* Built once per function instance, not per request: Fluid Compute reuses
   instances, and initializeApp throws on a second call. */
let services

const buildServices = () => {
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!credentials) throw new Error('FIREBASE_SERVICE_ACCOUNT no está configurada')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY no está configurada')

  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(credentials)) })
  const db = getFirestore(app)

  return {
    /* Not firebase-admin/auth: it drags in a CommonJS package that require()s
       an ESM-only one and kills the function on boot. See _lib/firebaseToken.js. */
    verifyIdToken: verifyFirebaseIdToken,
    getDoc: async path => (await db.doc(path).get()).data() ?? null,
    /* Adapts firebase-admin to the { get, set } shape aiRateLimit expects, so
       that module stays testable without Firestore. */
    runTransaction: fn =>
      db.runTransaction(tx =>
        fn({
          get: async path => (await tx.get(db.doc(path))).data() ?? null,
          set: (path, data) => tx.set(db.doc(path), data),
        })
      ),
    anthropic: new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }),
  }
}

const getServices = () => {
  services ||= buildServices()
  return services
}

const readBody = req => {
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return null
    }
  }
  return req.body
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Este endpoint solo acepta POST.' })
  }

  let refund = null

  try {
    const { verifyIdToken, getDoc, runTransaction, anthropic } = getServices()

    /* Validation comes before authorize because authorize needs a trusted
       `mode` for the admin gate — checking it against an unvalidated value is
       the dangerous order. */
    const checked = validateBody(readBody(req))
    if (!checked.ok) return res.status(checked.status).json({ error: checked.error })
    const { mode, question, facts, history } = checked.value

    const { uid, isAdmin } = await authorize({
      authHeader: req.headers.authorization,
      mode,
      verifyIdToken,
      getDoc,
    })

    const today = dayKey()
    const reserved = await reserveQuestion({ uid, isAdmin, runTransaction, today })
    refund = () => refundQuestion({ uid, runTransaction, today })

    const request = buildRequest({ mode, question, facts, history })
    const message = usesBetaPath(mode)
      ? await anthropic.beta.messages.create(request)
      : await anthropic.messages.create(request)

    const { respuesta, accion, content } = parseAssistantReply(message)
    return res.status(200).json({
      respuesta,
      accion,
      content,
      /* The user turn exactly as it was sent. The client cannot rebuild the
         facts block byte for byte, and the history check compares bytes. */
      userContent: request.messages.at(-1).content,
      remaining: reserved.remaining,
      limit: reserved.limit,
      usage: message.usage ?? null,
    })
  } catch (error) {
    /* Anything that fails after the reservation gives the question back. A
       failed refund must not hide the error that caused it. */
    if (refund) {
      try {
        await refund()
      } catch (refundError) {
        console.error('[assistant] no se pudo devolver el cupo', refundError)
      }
    }

    if (error instanceof AuthError) return res.status(error.status).json({ error: error.message })
    if (error instanceof QuotaError) return res.status(error.status).json({ error: error.message })
    if (error instanceof AssistantReplyError) {
      console.error('[assistant] respuesta inusable', error.code, error.message)
      return res.status(502).json({ error: error.userMessage })
    }

    console.error('[assistant] fallo inesperado', error)
    return res.status(502).json({ error: GENERIC_ERROR })
  }
}
