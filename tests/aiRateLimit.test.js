import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DAILY_LIMITS,
  QuotaError,
  dayKey,
  reserveQuestion,
  refundQuestion,
} from '../api/_lib/aiRateLimit.js'

const UID = 'uid-1'
const PATH = `aiUsage/${UID}`
const TODAY = '2026-11-02'

/* Doble de Firestore: las transacciones se encadenan, así que los callbacks
   corren de a uno sobre el mismo estado, igual que las de verdad. */
const makeStore = (initial = {}) => {
  const docs = { ...initial }
  let chain = Promise.resolve()

  const runTransaction = fn => {
    const result = chain.then(() =>
      fn({
        get: async path => (path in docs ? { ...docs[path] } : null),
        set: (path, data) => {
          docs[path] = { ...data }
        },
      })
    )
    chain = result.then(
      () => {},
      () => {}
    )
    return result
  }

  return { docs, runTransaction }
}

const reserve = (store, { isAdmin = false, today = TODAY } = {}) =>
  reserveQuestion({ uid: UID, isAdmin, today, runTransaction: store.runTransaction })

const refund = (store, { today = TODAY } = {}) =>
  refundQuestion({ uid: UID, today, runTransaction: store.runTransaction })

const caught = async fn => {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

test('los topes son 15 para usuarios y 50 para admins', () => {
  assert.deepEqual(DAILY_LIMITS, { user: 15, admin: 50 })
})

test('la primera pregunta del día deja el contador en 1', async () => {
  const store = makeStore()
  const result = await reserve(store)
  assert.equal(store.docs[PATH].count, 1)
  assert.equal(store.docs[PATH].day, TODAY)
  assert.equal(result.remaining, 14)
})

test('la segunda pregunta del mismo día deja 2', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 1 } })
  const result = await reserve(store)
  assert.equal(store.docs[PATH].count, 2)
  assert.equal(result.remaining, 13)
})

test('un día nuevo reinicia el contador a 1', async () => {
  const store = makeStore({ [PATH]: { day: '2026-11-01', count: 15 } })
  const result = await reserve(store)
  assert.equal(store.docs[PATH].count, 1)
  assert.equal(store.docs[PATH].day, TODAY)
  assert.equal(result.remaining, 14)
})

test('en el tope lanza QuotaError y no incrementa', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 15 } })
  const error = await caught(() => reserve(store))
  assert.ok(error instanceof QuotaError, `esperaba QuotaError, recibí ${error}`)
  assert.equal(error.status, 429)
  assert.equal(store.docs[PATH].count, 15, 'una reserva rechazada no escribe')
  assert.ok(error.message.length > 10)
})

test('un admin tiene tope 50', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 15 } })
  const result = await reserve(store, { isAdmin: true })
  assert.equal(result.remaining, 34)

  const atCap = makeStore({ [PATH]: { day: TODAY, count: 50 } })
  const error = await caught(() => reserve(atCap, { isAdmin: true }))
  assert.ok(error instanceof QuotaError)
})

test('un contador corrupto se trata como cero', async () => {
  for (const count of [undefined, null, 'muchas', NaN, -4]) {
    const store = makeStore({ [PATH]: { day: TODAY, count } })
    await reserve(store)
    assert.equal(store.docs[PATH].count, 1, `count ${JSON.stringify(count)}`)
  }
})

test('refundQuestion devuelve la pregunta', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 4 } })
  await refund(store)
  assert.equal(store.docs[PATH].count, 3)
})

test('refundQuestion no baja de cero', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 0 } })
  await refund(store)
  assert.equal(store.docs[PATH].count, 0)
})

test('refundQuestion no toca un contador de otro día', async () => {
  const store = makeStore({ [PATH]: { day: '2026-11-01', count: 9 } })
  await refund(store)
  assert.equal(store.docs[PATH].count, 9, 'el contador de ayer no se devuelve')
})

test('refundQuestion sobre un documento que no existe no lanza', async () => {
  const store = makeStore()
  await refund(store)
  assert.equal(store.docs[PATH], undefined)
})

test('reservar y devolver deja el contador como estaba', async () => {
  const store = makeStore({ [PATH]: { day: TODAY, count: 7 } })
  await reserve(store)
  await refund(store)
  assert.equal(store.docs[PATH].count, 7)
})

test('veinte reservas simultáneas con tope 15 dejan pasar exactamente 15', async () => {
  const store = makeStore()
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => reserve(store)))

  const allowed = results.filter(r => r.status === 'fulfilled').length
  const rejected = results.filter(r => r.status === 'rejected')

  assert.equal(allowed, 15, 'el techo de gasto tiene que aguantar la concurrencia')
  assert.equal(rejected.length, 5)
  assert.ok(rejected.every(r => r.reason instanceof QuotaError))
  assert.equal(store.docs[PATH].count, 15)
})

test('dayKey usa el huso de Colombia, no UTC', () => {
  // 2026-11-03 02:00 UTC siguen siendo las 21:00 del 2 en Colombia
  assert.equal(dayKey(new Date('2026-11-03T02:00:00Z')), '2026-11-02')
  assert.equal(dayKey(new Date('2026-11-03T05:00:00Z')), '2026-11-03')
  assert.equal(dayKey(new Date('2026-11-02T12:00:00Z')), '2026-11-02')
})

test('dayKey acepta otro desplazamiento', () => {
  assert.equal(dayKey(new Date('2026-11-03T02:00:00Z'), 0), '2026-11-03')
})
