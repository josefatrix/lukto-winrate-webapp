import assert from 'node:assert/strict'
import test from 'node:test'

import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth'
import { initializeApp as initializeClientApp, deleteApp } from 'firebase/app'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-lukto-attendance'
const FUNCTION_REGION = 'us-central1'

const adminApp = getAdminApps()[0] || initializeAdminApp({ projectId: PROJECT_ID })
const adminDb = getAdminFirestore(adminApp)

let appCounter = 0

const pad = value => String(value).padStart(2, '0')

const futureMatchDate = () => {
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

const pastMatchDate = () => {
  const date = new Date(Date.now() - 48 * 60 * 60 * 1000)
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

const seedMatch = async (matchId, overrides = {}) => {
  await adminDb
    .collection('matches')
    .doc(matchId)
    .set({
      date: futureMatchDate(),
      time: '23:59',
      utcOffset: '+00:00',
      capacity: 2,
      matchFormat: '5v5',
      ...overrides,
    })
}

const seedLinkedPlayer = async ({ uid, playerId, link = {}, player = {} }) => {
  await adminDb.collection('userLinks').doc(uid).set({ playerId, ...link })
  await adminDb.collection('players').doc(playerId).set({ name: playerId, ...player })
}

const signInClient = async () => {
  const app = initializeClientApp(
    { projectId: PROJECT_ID, apiKey: 'demo-key', appId: `demo-app-${++appCounter}` },
    `attendance-test-${appCounter}`
  )
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const credential = await signInAnonymously(auth)
  const functions = getFunctions(app, FUNCTION_REGION)
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  const firestore = getFirestore(app)
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  return {
    app,
    uid: credential.user.uid,
    respond: httpsCallable(functions, 'respondToAttendance'),
    firestore,
  }
}

const linkedClient = async (playerId, options = {}) => {
  const client = await signInClient()
  await seedLinkedPlayer({ uid: client.uid, playerId, ...options })
  return client
}

const callableRejects = async (respond, data, code) => {
  await assert.rejects(respond(data), error => {
    assert.equal(error.code, `functions/${code}`)
    return true
  })
}

test('attendance callable rejects unauthenticated, malformed, and unauthorized requests', async () => {
  const unauthenticatedApp = initializeClientApp(
    { projectId: PROJECT_ID, apiKey: 'demo-key', appId: 'demo-app-unauthenticated' },
    `attendance-test-unauthenticated-${++appCounter}`
  )
  const unauthenticatedFunctions = getFunctions(unauthenticatedApp, FUNCTION_REGION)
  connectFunctionsEmulator(unauthenticatedFunctions, '127.0.0.1', 5001)
  const unauthenticatedRespond = httpsCallable(unauthenticatedFunctions, 'respondToAttendance')

  await callableRejects(unauthenticatedRespond, { matchId: 'match-1', intent: 'confirmed' }, 'unauthenticated')
  await deleteApp(unauthenticatedApp)

  const malformed = await signInClient()
  await callableRejects(malformed.respond, { matchId: 'matches/other', intent: 'confirmed' }, 'invalid-argument')
  await callableRejects(malformed.respond, { matchId: 'match-1', intent: 'maybe' }, 'invalid-argument')
  await callableRejects(malformed.respond, { matchId: 'missing-link', intent: 'confirmed' }, 'permission-denied')
  await deleteApp(malformed.app)
})

test('attendance callable enforces blocked links, blocked users, archived players, missing matches, started matches, and completed matches', async () => {
  const blockedLink = await linkedClient('blocked-link-player', { link: { blocked: true } })
  await seedMatch('blocked-link-match')
  await callableRejects(blockedLink.respond, { matchId: 'blocked-link-match', intent: 'confirmed' }, 'permission-denied')
  await deleteApp(blockedLink.app)

  const archivedLink = await linkedClient('archived-link-player', { link: { archived: true } })
  await seedMatch('archived-link-match')
  await callableRejects(archivedLink.respond, { matchId: 'archived-link-match', intent: 'confirmed' }, 'permission-denied')
  await deleteApp(archivedLink.app)

  const blockedUser = await linkedClient('blocked-user-player')
  await adminDb.collection('settings').doc('blockedUsers').set({ list: [blockedUser.uid] })
  await seedMatch('blocked-user-match')
  await callableRejects(blockedUser.respond, { matchId: 'blocked-user-match', intent: 'confirmed' }, 'permission-denied')
  await adminDb.collection('settings').doc('blockedUsers').set({ list: [] })
  await deleteApp(blockedUser.app)

  const archivedPlayer = await linkedClient('archived-player', { player: { archived: true } })
  await seedMatch('archived-player-match')
  await callableRejects(archivedPlayer.respond, { matchId: 'archived-player-match', intent: 'confirmed' }, 'permission-denied')
  await deleteApp(archivedPlayer.app)

  const missingMatch = await linkedClient('missing-match-player')
  await callableRejects(missingMatch.respond, { matchId: 'missing-match', intent: 'confirmed' }, 'not-found')
  await deleteApp(missingMatch.app)

  const startedMatch = await linkedClient('started-match-player')
  await seedMatch('started-match', { date: pastMatchDate(), time: '00:00', utcOffset: '+00:00' })
  await callableRejects(startedMatch.respond, { matchId: 'started-match', intent: 'confirmed' }, 'failed-precondition')
  await deleteApp(startedMatch.app)

  const completedMatch = await linkedClient('completed-match-player')
  await seedMatch('completed-match', { winner: 'white' })
  await callableRejects(completedMatch.respond, { matchId: 'completed-match', intent: 'confirmed' }, 'failed-precondition')
  await deleteApp(completedMatch.app)
})

test('attendance callable confirms active linked players, waitlists at capacity, and promotes FIFO on decline', async () => {
  const matchId = makeId('fifo-match')
  await seedMatch(matchId, { capacity: 2 })

  const first = await linkedClient('fifo-player-a')
  const second = await linkedClient('fifo-player-b')
  const third = await linkedClient('fifo-player-c')
  const fourth = await linkedClient('fifo-player-d')

  assert.equal((await first.respond({ matchId, intent: 'confirmed' })).data.status, 'confirmed')
  assert.equal((await second.respond({ matchId, intent: 'confirmed' })).data.status, 'confirmed')
  assert.equal((await third.respond({ matchId, intent: 'confirmed' })).data.status, 'waitlisted')
  assert.equal((await fourth.respond({ matchId, intent: 'confirmed' })).data.status, 'waitlisted')
  assert.equal((await first.respond({ matchId, intent: 'declined' })).data.status, 'declined')

  const attendance = (await adminDb.collection('matchAttendance').doc(matchId).get()).data()
  assert.equal(attendance.entries['fifo-player-a'].status, 'declined')
  assert.equal(attendance.entries['fifo-player-b'].status, 'confirmed')
  assert.equal(attendance.entries['fifo-player-c'].status, 'confirmed')
  assert.equal(attendance.entries['fifo-player-d'].status, 'waitlisted')

  assert.equal((await first.respond({ matchId, intent: 'confirmed' })).data.status, 'waitlisted')
  const rejoined = (await adminDb.collection('matchAttendance').doc(matchId).get()).data()
  assert.equal(rejoined.entries['fifo-player-a'].status, 'waitlisted')

  await Promise.all([first, second, third, fourth].map(client => deleteApp(client.app)))
})

test('attendance callable rejects conflicting ownership for an existing player entry', async () => {
  const matchId = makeId('ownership-match')
  await seedMatch(matchId, { capacity: 2 })
  const owner = await linkedClient('owned-player')
  const intruder = await signInClient()
  await seedLinkedPlayer({ uid: intruder.uid, playerId: 'owned-player' })

  await owner.respond({ matchId, intent: 'confirmed' })
  await callableRejects(intruder.respond, { matchId, intent: 'declined' }, 'permission-denied')

  await Promise.all([owner, intruder].map(client => deleteApp(client.app)))
})

test('firestore rules deny direct browser writes to attendance documents', async () => {
  const client = await linkedClient('rules-player')

  await assert.rejects(
    setDoc(doc(client.firestore, 'matchAttendance', 'direct-write'), {
      matchId: 'direct-write',
      entries: {},
    }),
    error => {
      assert.equal(error.code, 'permission-denied')
      return true
    }
  )

  await deleteApp(client.app)
})
