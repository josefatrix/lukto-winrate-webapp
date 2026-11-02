/**
 * Firebase ID token verification, without firebase-admin/auth.
 *
 * `firebase-admin/auth` pulls in jwks-rsa@4, which is CommonJS and `require()`s
 * jose@6, which is ESM-only — so the function crashed on boot with
 * ERR_REQUIRE_ESM. It never showed up locally, where that require is lazy and
 * nothing in the tests reaches it; the deployed preview found it on the first
 * request.
 *
 * Verifying the token here is a handful of lines against Google's published
 * keys, it drops a heavy dependency from the cold start, and
 * firebase-admin/app + /firestore (which the quota needs) load fine on their
 * own.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const PROJECT_ID = 'lukto-tracker'
export const AUDIENCE = PROJECT_ID
export const ISSUER = `https://securetoken.google.com/${PROJECT_ID}`
export const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

/* Cached across invocations on a warm instance; jose refreshes it on its own
   when it sees a key id it does not know. */
let jwks

/** The claims the gates care about. Throws when the token names no user. */
export const claimsFrom = payload => {
  const uid = typeof payload?.sub === 'string' ? payload.sub.trim() : ''
  if (!uid) throw new Error('El token no trae sub (identificador de usuario).')
  return {
    uid,
    email: payload.email,
    email_verified: payload.email_verified === true,
  }
}

export const verifyFirebaseIdToken = async token => {
  jwks ||= createRemoteJWKSet(new URL(JWKS_URL))
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['RS256'],
  })
  return claimsFrom(payload)
}
