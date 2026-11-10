/**
 * Input validation for POST /api/assistant.
 *
 * Pure and separate from the handler so the limits are covered by tests: a
 * client with a bug is the input class most likely to hit this endpoint, and
 * returning a 400 instead of crashing is the whole job.
 */

export const MAX_QUESTION_CHARS = 500
/* El bloque lleva el histórico completo y las calificaciones individuales.
   250 KB son ~62K tokens: holgado para este grupo durante años, y bastante
   por debajo de los 100K donde el precio por token de Haiku se multiplica. */
export const MAX_FACTS_BYTES = 250 * 1024
/** Veinte turnos, dos mensajes cada uno. */
export const MAX_HISTORY_MESSAGES = 40
/* The question cap counts questions; the bill counts tokens. Without a byte
   budget a linked member can push megabytes of history through on the owner's
   key — and past 100K tokens Haiku 5.5 costs five times as much per token. */
export const MAX_HISTORY_BYTES = 200 * 1024

const MODES = ['stats', 'builder']
/* No 'system': mid-conversation system messages carry operator authority
   and that channel is not the client's to use. */
const ROLES = ['user', 'assistant']

const fail = error => ({ ok: false, status: 400, error })

const isPlainObject = value =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const validateBody = body => {
  if (!isPlainObject(body)) return fail('La petición llegó vacía o mal formada.')

  if (!MODES.includes(body.mode)) {
    return fail('No reconozco ese modo de asistente.')
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return fail('Escribe una pregunta antes de enviar.')
  if (question.length > MAX_QUESTION_CHARS) {
    return fail(`La pregunta no puede pasar de ${MAX_QUESTION_CHARS} caracteres.`)
  }

  if (!isPlainObject(body.facts)) {
    return fail('Faltan los datos del grupo. Recarga la app y prueba de nuevo.')
  }

  let factsBytes
  try {
    factsBytes = Buffer.byteLength(JSON.stringify(body.facts), 'utf8')
  } catch {
    return fail('Faltan los datos del grupo. Recarga la app y prueba de nuevo.')
  }
  if (factsBytes > MAX_FACTS_BYTES) {
    return fail('Los datos del grupo son demasiado grandes para una sola pregunta.')
  }

  const history = body.history === undefined ? [] : body.history
  if (!Array.isArray(history)) {
    return fail('El historial de la conversación llegó mal formado.')
  }
  if (history.length > MAX_HISTORY_MESSAGES) {
    return fail('Esta conversación ya es muy larga. Empieza una nueva para seguir preguntando.')
  }
  const everyTurnUsable = history.every(
    entry => isPlainObject(entry) && ROLES.includes(entry.role) && entry.content !== undefined
  )
  if (!everyTurnUsable) {
    return fail('El historial de la conversación llegó mal formado.')
  }

  let historyBytes
  try {
    historyBytes = Buffer.byteLength(JSON.stringify(history), 'utf8')
  } catch {
    return fail('El historial de la conversación llegó mal formado.')
  }
  if (historyBytes > MAX_HISTORY_BYTES) {
    return fail('Esta conversación ya es muy larga. Empieza una nueva para seguir preguntando.')
  }

  return { ok: true, value: { mode: body.mode, question, facts: body.facts, history } }
}
