import test from 'node:test'
import assert from 'node:assert/strict'

import { SUPER_ADMIN_EMAIL, AuthError, authorize } from '../api/_lib/auth.js'

const LINKED = { playerId: 'player-1' }

/* Dobles: verifyIdToken y getDoc se inyectan, así que las puertas se prueban
   sin red y sin Firestore. */
const setup = ({ token = {}, docs = {} } = {}) => ({
  verifyIdToken: async value => {
    if (value !== 'good-token') throw new Error('token inválido')
    return { uid: 'uid-1', email: 'jugador@example.com', email_verified: true, ...token }
  },
  getDoc: async path => docs[path] ?? null,
})

/* El default se aplica solo si la clave falta: con `{ authHeader: undefined }`
   un parámetro por defecto se activaría igual y el caso "sin cabecera" no se
   probaría nunca. */
const run = (overrides, options = {}) =>
  authorize({
    authHeader: 'authHeader' in options ? options.authHeader : 'Bearer good-token',
    mode: options.mode ?? 'stats',
    ...setup(overrides),
  })

const caught = async fn => {
  try {
    await fn()
    return null
  } catch (error) {
    return error
  }
}

const caughtAuthError = async fn => {
  const error = await caught(fn)
  assert.ok(error instanceof AuthError, `esperaba AuthError, recibí ${error}`)
  return error
}

const linkedDocs = { 'userLinks/uid-1': LINKED }

test('un usuario logueado y vinculado pasa el modo stats', async () => {
  const result = await run({ docs: linkedDocs })
  assert.deepEqual(result, { uid: 'uid-1', playerId: 'player-1', isAdmin: false })
})

test('sin cabecera Authorization devuelve 401', async () => {
  for (const authHeader of [undefined, '', 'good-token', 'Basic abc', 'Bearer ']) {
    const error = await caughtAuthError(() => run({ docs: linkedDocs }, { authHeader }))
    assert.equal(error.status, 401, `authHeader ${JSON.stringify(authHeader)}`)
  }
})

test('un token que no verifica devuelve 401', async () => {
  const error = await caughtAuthError(() =>
    run({ docs: linkedDocs }, { authHeader: 'Bearer bad-token' })
  )
  assert.equal(error.status, 401)
})

test('un usuario sin playerId devuelve 403 con el mensaje de cuenta no vinculada', async () => {
  for (const link of [null, {}, { playerId: '' }, { playerId: '   ' }, { playerId: 'a/b' }]) {
    const docs = link ? { 'userLinks/uid-1': link } : {}
    const error = await caughtAuthError(() => run({ docs }))
    assert.equal(error.status, 403, `link ${JSON.stringify(link)}`)
    assert.match(error.message, /vincul/i)
  }
})

test('un usuario blocked devuelve 403', async () => {
  const docs = { 'userLinks/uid-1': { ...LINKED, blocked: true } }
  const error = await caughtAuthError(() => run({ docs }))
  assert.equal(error.status, 403)
})

test('un usuario archived devuelve 403', async () => {
  const docs = { 'userLinks/uid-1': { ...LINKED, archived: true } }
  const error = await caughtAuthError(() => run({ docs }))
  assert.equal(error.status, 403)
})

test('el modo builder exige admin y rechaza a un usuario normal con 403', async () => {
  const error = await caughtAuthError(() => run({ docs: linkedDocs }, { mode: 'builder' }))
  assert.equal(error.status, 403)
  assert.match(error.message, /admin/i)
})

test('el super admin con email verificado pasa el modo builder', async () => {
  const result = await run(
    { token: { email: SUPER_ADMIN_EMAIL }, docs: linkedDocs },
    { mode: 'builder' }
  )
  assert.equal(result.isAdmin, true)
})

test('el super admin se reconoce sin importar mayúsculas', async () => {
  const result = await run(
    { token: { email: SUPER_ADMIN_EMAIL.toUpperCase() }, docs: linkedDocs },
    { mode: 'builder' }
  )
  assert.equal(result.isAdmin, true)
})

test('un email en settings/admins pasa el modo builder', async () => {
  const docs = {
    ...linkedDocs,
    'settings/admins': { emails: ['Otro@Example.com', 'jugador@example.com'] },
  }
  const result = await run({ docs }, { mode: 'builder' })
  assert.equal(result.isAdmin, true)
})

test('un email que no está en settings/admins no pasa', async () => {
  const docs = { ...linkedDocs, 'settings/admins': { emails: ['alguien@example.com'] } }
  const error = await caughtAuthError(() => run({ docs }, { mode: 'builder' }))
  assert.equal(error.status, 403)
})

test('settings/admins con emails que no son lista no otorga admin', async () => {
  for (const emails of [undefined, 'jugador@example.com', { 0: 'jugador@example.com' }]) {
    const docs = { ...linkedDocs, 'settings/admins': { emails } }
    const error = await caughtAuthError(() => run({ docs }, { mode: 'builder' }))
    assert.equal(error.status, 403, `emails ${JSON.stringify(emails)}`)
  }
})

test('un email sin verificar no pasa, ni siquiera el del super admin', async () => {
  const error = await caughtAuthError(() =>
    run(
      { token: { email: SUPER_ADMIN_EMAIL, email_verified: false }, docs: linkedDocs },
      { mode: 'builder' }
    )
  )
  assert.equal(error.status, 403)
})

test('el modo stats no necesita admin ni email verificado', async () => {
  const result = await run({ token: { email_verified: false }, docs: linkedDocs })
  assert.deepEqual(result, { uid: 'uid-1', playerId: 'player-1', isAdmin: false })
})

test('un admin que pregunta en modo stats llega con isAdmin true', async () => {
  const result = await run({ token: { email: SUPER_ADMIN_EMAIL }, docs: linkedDocs })
  assert.equal(result.isAdmin, true, 'el cupo de admin es mayor también en modo stats')
})

test('los mensajes de AuthError están en español', async () => {
  const errors = [
    await caughtAuthError(() => run({ docs: linkedDocs }, { authHeader: undefined })),
    await caughtAuthError(() => run({ docs: {} })),
    await caughtAuthError(() => run({ docs: linkedDocs }, { mode: 'builder' })),
  ]
  for (const error of errors) {
    assert.ok(error.message.length > 10, `mensaje demasiado corto: ${error.message}`)
    assert.doesNotMatch(error.message, /[A-Za-z]+ (in|to|must|cannot) /, 'parece inglés')
  }
})
