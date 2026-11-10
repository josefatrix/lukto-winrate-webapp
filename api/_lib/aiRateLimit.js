/**
 * The daily question quota.
 *
 * Reserve first, refund on failure. Incrementing only after a successful call
 * reads as friendlier but leaves a hole: fifty requests fired in parallel all
 * pass the check with the counter at fourteen, and the spending ceiling stops
 * existing. Reserving costs the same writes and closes it; the price is that a
 * network failure with no refund spends one question.
 *
 * `runTransaction` is injected — `fn(tx)` with `tx.get(path)` returning the
 * document data or null, and `tx.set(path, data)`. api/assistant.js adapts
 * firebase-admin to that shape; the tests pass a serializing double.
 */

export const DAILY_LIMITS = { user: 15, admin: 50 }

/* Same offset the rest of the app assumes (DEFAULT_UTC_OFFSET in
   functions/lib/attendance.js), so the quota resets at local midnight rather
   than at seven in the evening. */
const COLOMBIA_OFFSET_MINUTES = -300

export class QuotaError extends Error {
  constructor(limit) {
    super(`Se te acabaron las ${limit} preguntas de hoy. Vuelve mañana.`)
    this.name = 'QuotaError'
    this.status = 429
    this.limit = limit
  }
}

/** `YYYY-MM-DD` for the group's own timezone. */
export const dayKey = (date = new Date(), offsetMinutes = COLOMBIA_OFFSET_MINUTES) =>
  new Date(date.getTime() + offsetMinutes * 60_000).toISOString().slice(0, 10)

const usagePath = uid => `aiUsage/${uid}`

const countFor = (doc, today) => {
  if (doc?.day !== today) return 0
  const count = Number(doc.count)
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

export const reserveQuestion = async ({ uid, isAdmin, runTransaction, today = dayKey() }) => {
  const limit = isAdmin ? DAILY_LIMITS.admin : DAILY_LIMITS.user
  const path = usagePath(uid)

  return runTransaction(async tx => {
    const count = countFor(await tx.get(path), today)
    if (count >= limit) throw new QuotaError(limit)

    const next = count + 1
    tx.set(path, { day: today, count: next, updatedAt: new Date().toISOString() })
    return { remaining: limit - next, limit }
  })
}

export const refundQuestion = async ({ uid, runTransaction, today = dayKey() }) => {
  const path = usagePath(uid)

  return runTransaction(async tx => {
    const doc = await tx.get(path)
    /* A counter from another day has already been reset by the next reserve;
       refunding into it would hand back a question that was never spent. */
    if (!doc || doc.day !== today) return
    const count = countFor(doc, today)
    if (count <= 0) return
    tx.set(path, { day: today, count: count - 1, updatedAt: new Date().toISOString() })
  })
}
