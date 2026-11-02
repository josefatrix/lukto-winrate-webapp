/**
 * The gates in front of the assistant.
 *
 * Same conditions `respondToAttendance` already enforces (functions/index.js):
 * signed in, linked to a player, not blocked, not archived — plus the admin
 * check for builder mode, mirroring isSuperAdmin() || isListedAdmin() from
 * firestore.rules.
 *
 * `verifyIdToken` and `getDoc` arrive as parameters so every gate can be tested
 * without the network. api/assistant.js passes the firebase-admin versions.
 */

/* Hardcoded in firestore.rules and in src/constants/config.js. The
   VITE_SUPER_ADMIN_EMAIL in .env.example is not the source of truth and never
   reaches the server. */
export const SUPER_ADMIN_EMAIL = 'joseescorcia01@gmail.com'

export class AuthError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

/* Same rule as isSafeFirestoreId in functions/lib/attendance.js. Three lines,
   copied rather than imported: this function is deployed to Vercel and
   reaching across into functions/ would drag that tree into its bundle. */
const isSafeId = value => {
  const id = typeof value === 'string' ? value.trim() : ''
  return !!id && !id.includes('/')
}

const bearerToken = authHeader => {
  const match = /^Bearer (.+)$/.exec(typeof authHeader === 'string' ? authHeader.trim() : '')
  return match?.[1]?.trim() || ''
}

const listedAdmins = settings =>
  Array.isArray(settings?.emails) ? settings.emails.map(email => String(email).toLowerCase()) : []

export const authorize = async ({ authHeader, mode, verifyIdToken, getDoc }) => {
  const token = bearerToken(authHeader)
  if (!token) throw new AuthError(401, 'Necesitás iniciar sesión para usar el asistente.')

  let decoded
  try {
    decoded = await verifyIdToken(token)
  } catch {
    throw new AuthError(401, 'Tu sesión expiró. Volvé a entrar y probá de nuevo.')
  }

  const uid = decoded?.uid
  if (!isSafeId(uid)) throw new AuthError(401, 'Tu sesión expiró. Volvé a entrar y probá de nuevo.')

  const link = await getDoc(`userLinks/${uid}`)
  if (!isSafeId(link?.playerId)) {
    throw new AuthError(
      403,
      'Tu cuenta todavía no está vinculada a un jugador. Pedile al admin que te vincule.'
    )
  }
  if (link?.blocked || link?.archived) {
    throw new AuthError(403, 'Esta cuenta no puede usar el asistente.')
  }

  const email = String(decoded?.email || '').toLowerCase()
  const emailVerified = decoded?.email_verified === true
  const isAdmin =
    emailVerified &&
    !!email &&
    (email === SUPER_ADMIN_EMAIL.toLowerCase() ||
      listedAdmins(await getDoc('settings/admins')).includes(email))

  if (mode === 'builder' && !isAdmin) {
    throw new AuthError(403, 'El asistente del armado es solo para el admin.')
  }

  return { uid, playerId: link.playerId.trim(), isAdmin }
}
