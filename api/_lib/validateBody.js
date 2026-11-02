/**
 * Input validation for POST /api/assistant.
 *
 * Pure and separate from the handler so the limits are covered by tests: a
 * client with a bug is the input class most likely to hit this endpoint, and
 * returning a 400 instead of crashing is the whole job.
 */

export const MAX_QUESTION_CHARS = 500
export const MAX_FACTS_BYTES = 60 * 1024
/** Ten turns, two messages each. */
export const MAX_HISTORY_MESSAGES = 20

const MODES = ['stats', 'builder']
const ROLES = ['user', 'assistant', 'system']

const fail = error => ({ ok: false, status: 400, error })

const isPlainObject = value =>
  !!value && typeof value === 'object' && !Array.isArray(value)

export const validateBody = body => {
  if (!isPlainObject(body)) return fail('La petición llegó vacía o mal formada.')

  if (!MODES.includes(body.mode)) {
    return fail('No reconozco ese modo de asistente.')
  }

  const question = typeof body.question === 'string' ? body.question.trim() : ''
  if (!question) return fail('Escribí una pregunta antes de enviar.')
  if (question.length > MAX_QUESTION_CHARS) {
    return fail(`La pregunta no puede pasar de ${MAX_QUESTION_CHARS} caracteres.`)
  }

  if (!isPlainObject(body.facts)) {
    return fail('Faltan los datos del grupo. Recargá la app y probá de nuevo.')
  }

  let factsBytes
  try {
    factsBytes = Buffer.byteLength(JSON.stringify(body.facts), 'utf8')
  } catch {
    return fail('Faltan los datos del grupo. Recargá la app y probá de nuevo.')
  }
  if (factsBytes > MAX_FACTS_BYTES) {
    return fail('Los datos del grupo son demasiado grandes para una sola pregunta.')
  }

  const history = body.history === undefined ? [] : body.history
  if (!Array.isArray(history)) {
    return fail('El historial de la conversación llegó mal formado.')
  }
  if (history.length > MAX_HISTORY_MESSAGES) {
    return fail('Esta conversación ya es muy larga. Empezá una nueva para seguir preguntando.')
  }
  const everyTurnUsable = history.every(
    entry => isPlainObject(entry) && ROLES.includes(entry.role) && entry.content !== undefined
  )
  if (!everyTurnUsable) {
    return fail('El historial de la conversación llegó mal formado.')
  }

  return { ok: true, value: { mode: body.mode, question, facts: body.facts, history } }
}
