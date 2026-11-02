import assert from 'node:assert/strict'
import test from 'node:test'

import { initializeApp as initializeAdminApp, getApps as getAdminApps } from 'firebase-admin/app'
import { getAuth as getAdminAuth } from 'firebase-admin/auth'
import { getFirestore as getAdminFirestore, Timestamp } from 'firebase-admin/firestore'
import {
  createUserWithEmailAndPassword,
  getAuth,
  connectAuthEmulator,
  signInAnonymously,
} from 'firebase/auth'
import { initializeApp as initializeClientApp, deleteApp } from 'firebase/app'
import {
  getFirestore,
  connectFirestoreEmulator,
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

const PROJECT_ID =
  process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-lukto-attendance'

const adminApp = getAdminApps()[0] || initializeAdminApp({ projectId: PROJECT_ID })
const adminDb = getAdminFirestore(adminApp)
const adminAuth = getAdminAuth(adminApp)

let appCounter = 0

const makeId = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`

const futureDate = () => new Date(Date.now() + 48 * 60 * 60 * 1000)
const pastDate = () => new Date(Date.now() - 48 * 60 * 60 * 1000)
const futureIso = () => futureDate().toISOString()
const pastIso = () => pastDate().toISOString()

const clientApp = () => {
  const app = initializeClientApp(
    { projectId: PROJECT_ID, apiKey: 'demo-key', appId: `demo-rules-app-${++appCounter}` },
    `production-rules-test-${appCounter}`
  )
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const firestore = getFirestore(app)
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080)
  return { app, auth, firestore }
}

const anonymousClient = async () => {
  const client = clientApp()
  const credential = await signInAnonymously(client.auth)
  return { ...client, uid: credential.user.uid }
}

const emailClient = async (email, password = 'LocalTest123!') => {
  const client = clientApp()
  const credential = await createUserWithEmailAndPassword(client.auth, email, password)
  await adminAuth.updateUser(credential.user.uid, { emailVerified: true })
  await credential.user.reload()
  await credential.user.getIdToken(true)
  return { ...client, uid: credential.user.uid, email }
}

const deny = async operation => {
  await assert.rejects(operation, error => {
    assert.equal(error.code, 'permission-denied')
    return true
  })
}

const allow = async operation => {
  await assert.doesNotReject(operation)
}

const seedMatch = async (matchId, overrides = {}) => {
  await adminDb
    .collection('matches')
    .doc(matchId)
    .set({
      date: futureIso().slice(0, 10),
      time: '23:59',
      utcOffset: '+00:00',
      playerPool: [],
      kickoffAt: Timestamp.fromDate(futureDate()),
      ...overrides,
    })
}

const seedLinkedPlayer = async ({ uid, playerId, link = {}, player = {} }) => {
  await adminDb.collection('userLinks').doc(uid).set({ playerId, ...link })
  await adminDb.collection('players').doc(playerId).set({ name: playerId, ...player })
}

const attendanceResponseRef = (firestore, matchId, uid) =>
  doc(firestore, 'matchAttendance', matchId, 'responses', uid)

const validAttendanceResponse = playerId => ({
  playerId,
  intent: 'confirmed',
  updatedAt: serverTimestamp(),
})

const validRatingData = ({ raterId, ratedId, matchId, score = 8.5 }) => ({
  ratedBy: raterId,
  ratedPlayerId: ratedId,
  matchId,
  score,
  timestamp: new Date().toISOString(),
})

const commitRatingsWithRevision = (firestore, matchId, ratings) => {
  const batch = writeBatch(firestore)
  ratings.forEach(rating => {
    batch.set(
      doc(firestore, 'ratings', `${rating.ratedBy}_${rating.ratedPlayerId}_${rating.matchId}`),
      rating
    )
  })
  batch.update(doc(firestore, 'matches', matchId), { ratingsRevision: serverTimestamp() })
  return batch.commit()
}

const commitRatingDeleteWithRevision = (firestore, matchId, ratingIds) => {
  const batch = writeBatch(firestore)
  ratingIds.forEach(ratingId => {
    batch.delete(doc(firestore, 'ratings', ratingId))
  })
  batch.update(doc(firestore, 'matches', matchId), { ratingsRevision: serverTimestamp() })
  return batch.commit()
}

const pollOption = (suffix, votes = 0) => ({
  teamWhite: [`white-${suffix}-a`, `white-${suffix}-b`],
  teamBlack: [`black-${suffix}-a`, `black-${suffix}-b`],
  positions: {},
  balanceScore: 90,
  probability: { white: 50, black: 50 },
  votes,
  label: `Option ${suffix}`,
})

test('anonymous visitors can read public statistics collections', async () => {
  const playerId = makeId('public-player')
  const matchId = makeId('public-match')
  const ratingId = makeId('public-rating')
  await adminDb.collection('players').doc(playerId).set({ name: 'Public Player' })
  await adminDb.collection('matches').doc(matchId).set({ date: '2026-12-01', teamWhite: [], teamBlack: [] })
  await adminDb.collection('ratings').doc(ratingId).set({ ratedPlayerId: playerId, matchId, score: 8 })

  const client = clientApp()
  try {
    const [playerSnap, matchSnap, ratingsSnap] = await Promise.all([
      getDoc(doc(client.firestore, 'players', playerId)),
      getDoc(doc(client.firestore, 'matches', matchId)),
      getDocs(collection(client.firestore, 'ratings')),
    ])

    assert.equal(playerSnap.exists(), true)
    assert.equal(matchSnap.exists(), true)
    assert.equal(ratingsSnap.empty, false)
  } finally {
    await deleteApp(client.app)
  }
})

test('signed-out visitors cannot read attendance responses', async () => {
  const matchId = makeId('private-attendance')
  const uid = makeId('attendance-reader')
  await adminDb
    .collection('matchAttendance')
    .doc(matchId)
    .collection('responses')
    .doc(uid)
    .set({ playerId: 'reader-player', intent: 'confirmed', updatedAt: Timestamp.fromDate(futureDate()) })

  const visitor = clientApp()
  try {
    await deny(getDocs(collection(visitor.firestore, 'matchAttendance', matchId, 'responses')))
  } finally {
    await deleteApp(visitor.app)
  }
})

test('ordinary members cannot write trusted club data or parent attendance documents', async () => {
  const member = await anonymousClient()

  try {
    await deny(setDoc(doc(member.firestore, 'players', makeId('player')), { name: 'Injected' }))
    await deny(setDoc(doc(member.firestore, 'matches', makeId('match')), { date: '2026-12-01' }))
    await deny(setDoc(doc(member.firestore, 'settings', 'admins'), { emails: ['member@example.com'] }))
    await deny(
      setDoc(doc(member.firestore, 'matchAttendance', makeId('attendance')), {
        matchId: 'direct',
        entries: {},
      })
    )
  } finally {
    await deleteApp(member.app)
  }
})

test('members can register their own pending profile but cannot assign themselves a player', async () => {
  const member = await emailClient(`${makeId('member')}@example.com`)
  const ownRef = doc(member.firestore, 'userLinks', member.uid)

  try {
    await allow(
      setDoc(ownRef, {
        userName: 'Pending Member',
        userEmail: member.email,
        userPhoto: '',
        playerId: null,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    )

    await deny(updateDoc(ownRef, { playerId: 'active-player' }))
  } finally {
    await deleteApp(member.app)
  }
})

test('members cannot change another user link or mutate an existing link player assignment', async () => {
  const owner = await anonymousClient()
  const other = await anonymousClient()
  const ownerRef = doc(owner.firestore, 'userLinks', owner.uid)

  try {
    await adminDb.collection('userLinks').doc(owner.uid).set({
      userName: 'Linked Owner',
      userEmail: 'owner@example.com',
      playerId: 'owner-player',
    })

    await deny(
      setDoc(doc(other.firestore, 'userLinks', owner.uid), { playerId: 'other-player' }, { merge: true })
    )
    await deny(updateDoc(ownerRef, { playerId: 'different-player' }))
  } finally {
    await Promise.all([deleteApp(owner.app), deleteApp(other.app)])
  }
})

test('super admin can write trusted players, matches, settings, and user links', async () => {
  const email = 'joseescorcia01@gmail.com'
  await adminDb.collection('settings').doc('admins').set({ emails: [email] })
  const admin = await emailClient(email)
  const targetUid = makeId('target-user')

  try {
    await allow(setDoc(doc(admin.firestore, 'players', makeId('admin-player')), { name: 'Admin Player' }))
    await allow(setDoc(doc(admin.firestore, 'matches', makeId('admin-match')), { date: '2026-12-01' }))
    await allow(setDoc(doc(admin.firestore, 'settings', 'league'), { name: 'LUKTO' }, { merge: true }))
    await allow(
      setDoc(doc(admin.firestore, 'userLinks', targetUid), {
        userName: 'Linked Player',
        userEmail: 'linked@example.com',
        playerId: 'admin-player',
      })
    )
  } finally {
    await deleteApp(admin.app)
  }
})

test('linked match participants can create legitimate ratings for rated teammates and opponents', async () => {
  const matchId = makeId('rating-match')
  const raterId = makeId('rater')
  const ratedId = makeId('rated')
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Rated Player' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })

    await allow(
      commitRatingsWithRevision(rater.firestore, matchId, [
        validRatingData({ raterId, ratedId, matchId }),
      ])
    )
  } finally {
    await deleteApp(rater.app)
  }
})

test('rating writes require an atomic ratings revision bump on the match', async () => {
  const matchId = makeId('rating-revision-required')
  const raterId = makeId('revision-rater')
  const ratedId = makeId('revision-rated')
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Revision Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })

    await deny(
      setDoc(
        doc(rater.firestore, 'ratings', `${raterId}_${ratedId}_${matchId}`),
        validRatingData({ raterId, ratedId, matchId })
      )
    )
  } finally {
    await deleteApp(rater.app)
  }
})

test('linked raters cannot forge ratings revision timestamps or unrelated match fields', async () => {
  const matchId = makeId('rating-revision-forgery')
  const raterId = makeId('forgery-rater')
  const ratedId = makeId('forgery-rated')
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Forgery Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })

    const forgedTimestampBatch = writeBatch(rater.firestore)
    forgedTimestampBatch.set(
      doc(rater.firestore, 'ratings', `${raterId}_${ratedId}_${matchId}`),
      validRatingData({ raterId, ratedId, matchId })
    )
    forgedTimestampBatch.update(doc(rater.firestore, 'matches', matchId), {
      ratingsRevision: new Date().toISOString(),
    })
    await deny(forgedTimestampBatch.commit())

    const unrelatedFieldBatch = writeBatch(rater.firestore)
    unrelatedFieldBatch.set(
      doc(rater.firestore, 'ratings', `${raterId}_${ratedId}_${matchId}`),
      validRatingData({ raterId, ratedId, matchId })
    )
    unrelatedFieldBatch.update(doc(rater.firestore, 'matches', matchId), {
      ratingsRevision: serverTimestamp(),
      venue: 'Changed by rater',
    })
    await deny(unrelatedFieldBatch.commit())
  } finally {
    await deleteApp(rater.app)
  }
})

test('linked match participants can batch all 13 ratings for a 14-player completed match', async () => {
  const matchId = makeId('rating-batch-match')
  const raterId = makeId('batch-rater')
  const targetIds = Array.from({ length: 13 }, (_, index) => makeId(`batch-target-${index}`))
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await Promise.all(
      targetIds.map((playerId, index) =>
        adminDb
          .collection('players')
          .doc(playerId)
          .set({ name: `Batch Target ${index + 1}`, archived: index >= 10 })
      )
    )
    await seedMatch(matchId, {
      teamWhite: [raterId, ...targetIds.slice(0, 6)],
      teamBlack: targetIds.slice(6),
      winner: 'white',
      ratingsOpen: true,
    })

    await allow(
      commitRatingsWithRevision(
        rater.firestore,
        matchId,
        targetIds.map((ratedId, index) =>
          validRatingData({
            raterId,
            ratedId,
            matchId,
            score: 7 + (index % 3) * 0.5,
          })
        )
      )
    )
  } finally {
    await deleteApp(rater.app)
  }
})

test('linked raters can revise ratings for archived targets who played the match', async () => {
  const matchId = makeId('archived-rated-target')
  const raterId = makeId('archived-target-rater')
  const ratedId = makeId('archived-target')
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Archived Target', archived: true })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })

    await allow(
      commitRatingsWithRevision(rater.firestore, matchId, [
        validRatingData({ raterId, ratedId, matchId, score: 7 }),
      ])
    )
  } finally {
    await deleteApp(rater.app)
  }
})

test('admins can delete ratings while bumping the match ratings revision', async () => {
  const matchId = makeId('admin-rating-delete')
  const raterId = makeId('delete-rater')
  const ratedId = makeId('delete-rated')
  const ratingId = `${raterId}_${ratedId}_${matchId}`
  const email = `${makeId('admin-delete')}@example.com`
  const admin = await emailClient(email)

  try {
    await adminDb.collection('settings').doc('admins').set({ emails: [email] })
    await adminDb.collection('players').doc(raterId).set({ name: 'Delete Rater' })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Delete Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })
    await adminDb.collection('ratings').doc(ratingId).set(
      validRatingData({ raterId, ratedId, matchId, score: 6 })
    )

    await allow(commitRatingDeleteWithRevision(admin.firestore, matchId, [ratingId]))
  } finally {
    await deleteApp(admin.app)
  }
})

test('admins cannot delete ratings from an existing match without a ratings revision bump', async () => {
  const matchId = makeId('admin-rating-delete-missing-revision')
  const raterId = makeId('delete-no-revision-rater')
  const ratedId = makeId('delete-no-revision-rated')
  const ratingId = `${raterId}_${ratedId}_${matchId}`
  const email = `${makeId('admin-delete-no-revision')}@example.com`
  const admin = await emailClient(email)

  try {
    await adminDb.collection('settings').doc('admins').set({ emails: [email] })
    await adminDb.collection('players').doc(raterId).set({ name: 'Delete Without Revision Rater' })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Delete Without Revision Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })
    await adminDb.collection('ratings').doc(ratingId).set(
      validRatingData({ raterId, ratedId, matchId, score: 6 })
    )

    await deny(deleteDoc(doc(admin.firestore, 'ratings', ratingId)))
  } finally {
    await deleteApp(admin.app)
  }
})

test('admins can delete a match and its ratings in the same batch', async () => {
  const matchId = makeId('admin-match-delete-with-ratings')
  const raterId = makeId('match-delete-rater')
  const ratedId = makeId('match-delete-rated')
  const ratingId = `${raterId}_${ratedId}_${matchId}`
  const email = `${makeId('admin-match-delete')}@example.com`
  const admin = await emailClient(email)

  try {
    await adminDb.collection('settings').doc('admins').set({ emails: [email] })
    await adminDb.collection('players').doc(raterId).set({ name: 'Match Delete Rater' })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Match Delete Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })
    await adminDb.collection('ratings').doc(ratingId).set(
      validRatingData({ raterId, ratedId, matchId, score: 6 })
    )

    const batch = writeBatch(admin.firestore)
    batch.delete(doc(admin.firestore, 'ratings', ratingId))
    batch.delete(doc(admin.firestore, 'matches', matchId))
    await allow(batch.commit())
  } finally {
    await deleteApp(admin.app)
  }
})

test('non-admins cannot delete ratings even with a ratings revision bump', async () => {
  const matchId = makeId('rater-rating-delete')
  const raterId = makeId('delete-denied-rater')
  const ratedId = makeId('delete-denied-rated')
  const ratingId = `${raterId}_${ratedId}_${matchId}`
  const rater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: rater.uid, playerId: raterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Delete Denied Rated' })
    await seedMatch(matchId, {
      teamWhite: [raterId],
      teamBlack: [ratedId],
      winner: 'white',
      ratingsOpen: true,
    })
    await adminDb.collection('ratings').doc(ratingId).set(
      validRatingData({ raterId, ratedId, matchId, score: 6 })
    )

    await deny(commitRatingDeleteWithRevision(rater.firestore, matchId, [ratingId]))
  } finally {
    await deleteApp(rater.app)
  }
})

test('rating restrictions deny otherwise valid rating writes', async () => {
  const matchId = makeId('restricted-rating-match')
  const globalRaterId = makeId('global-rater')
  const perMatchRaterId = makeId('per-match-rater')
  const ratedId = makeId('restricted-rated')
  const globalRater = await anonymousClient()
  const perMatchRater = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: globalRater.uid, playerId: globalRaterId })
    await seedLinkedPlayer({ uid: perMatchRater.uid, playerId: perMatchRaterId })
    await adminDb.collection('players').doc(ratedId).set({ name: 'Restricted Rated' })
    await seedMatch(matchId, {
      teamWhite: [globalRaterId, perMatchRaterId],
      teamBlack: [ratedId],
      winner: 'black',
      ratingsOpen: true,
    })
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [globalRater.uid] })
    await adminDb
      .collection('settings')
      .doc('ratingRestrictions')
      .set({ users: [], perMatch: { [matchId]: [perMatchRater.uid] } })

    await deny(
      commitRatingsWithRevision(globalRater.firestore, matchId, [
        validRatingData({ raterId: globalRaterId, ratedId, matchId, score: 8 }),
      ])
    )
    await deny(
      commitRatingsWithRevision(perMatchRater.firestore, matchId, [
        validRatingData({ raterId: perMatchRaterId, ratedId, matchId, score: 8 }),
      ])
    )
  } finally {
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [] })
    await adminDb.collection('settings').doc('ratingRestrictions').set({ users: [], perMatch: {} })
    await Promise.all([deleteApp(globalRater.app), deleteApp(perMatchRater.app)])
  }
})

test('linked match participants can create legitimate predictions before kickoff', async () => {
  const matchId = makeId('prediction-match')
  const playerId = makeId('predictor')
  const teammateId = makeId('predicted-mvp')
  const predictor = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: predictor.uid, playerId })
    await adminDb.collection('players').doc(teammateId).set({ name: 'Predicted MVP' })
    await seedMatch(matchId, {
      teamWhite: [playerId, teammateId],
      teamBlack: [makeId('opponent')],
    })

    await allow(
      setDoc(doc(predictor.firestore, 'predictions', `${predictor.uid}_${matchId}`), {
        odedBy: predictor.uid,
        matchId,
        prediction: 'white',
        probability: 60,
        predictedMvpId: teammateId,
        predictedScoreWhite: 4,
        predictedScoreBlack: 2,
        userName: 'Predictor',
        userEmail: '',
        userPhoto: '',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    )
  } finally {
    await deleteApp(predictor.app)
  }
})

test('linked active club members can predict matches they are not playing in', async () => {
  const matchId = makeId('prediction-nonparticipant-match')
  const playerId = makeId('nonparticipant-predictor')
  const matchPlayerId = makeId('match-player')
  const predictor = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: predictor.uid, playerId })
    await adminDb.collection('players').doc(matchPlayerId).set({ name: 'Match Player' })
    await seedMatch(matchId, {
      teamWhite: [matchPlayerId],
      teamBlack: [makeId('opponent')],
    })

    await allow(
      setDoc(doc(predictor.firestore, 'predictions', `${predictor.uid}_${matchId}`), {
        odedBy: predictor.uid,
        matchId,
        prediction: 'white',
        probability: 60,
        predictedMvpId: matchPlayerId,
        predictedScoreWhite: 4,
        predictedScoreBlack: 2,
        userName: 'Predictor',
        userEmail: '',
        userPhoto: '',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    )
  } finally {
    await deleteApp(predictor.app)
  }
})

test('blocked users cannot create otherwise valid predictions', async () => {
  const matchId = makeId('blocked-prediction-match')
  const playerId = makeId('blocked-predictor')
  const matchPlayerId = makeId('blocked-prediction-mvp')
  const predictor = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: predictor.uid, playerId })
    await adminDb.collection('players').doc(matchPlayerId).set({ name: 'Prediction MVP' })
    await seedMatch(matchId, {
      teamWhite: [matchPlayerId],
      teamBlack: [makeId('opponent')],
    })
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [predictor.uid] })

    await deny(
      setDoc(doc(predictor.firestore, 'predictions', `${predictor.uid}_${matchId}`), {
        odedBy: predictor.uid,
        matchId,
        prediction: 'white',
        probability: 60,
        predictedMvpId: matchPlayerId,
        predictedScoreWhite: 4,
        predictedScoreBlack: 2,
        userName: 'Predictor',
        userEmail: '',
        userPhoto: '',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    )
  } finally {
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [] })
    await deleteApp(predictor.app)
  }
})

test('predictions are denied at or after the ten-minute kickoff cutoff', async () => {
  const matchId = makeId('past-prediction-match')
  const playerId = makeId('past-predictor')
  const matchPlayerId = makeId('past-prediction-mvp')
  const predictor = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: predictor.uid, playerId })
    await adminDb.collection('players').doc(matchPlayerId).set({ name: 'Prediction MVP' })
    await seedMatch(matchId, {
      kickoffAt: Timestamp.fromDate(new Date(Date.now() + 5 * 60 * 1000)),
      teamWhite: [matchPlayerId],
      teamBlack: [makeId('opponent')],
    })

    await deny(
      setDoc(doc(predictor.firestore, 'predictions', `${predictor.uid}_${matchId}`), {
        odedBy: predictor.uid,
        matchId,
        prediction: 'white',
        probability: 60,
        predictedMvpId: matchPlayerId,
        predictedScoreWhite: 4,
        predictedScoreBlack: 2,
        userName: 'Predictor',
        userEmail: '',
        userPhoto: '',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    )
  } finally {
    await deleteApp(predictor.app)
  }
})

test('predictions fail closed for legacy future matches without canonical kickoffAt', async () => {
  const matchId = makeId('legacy-prediction-match')
  const playerId = makeId('legacy-predictor')
  const matchPlayerId = makeId('legacy-prediction-mvp')
  const predictor = await anonymousClient()

  try {
    await seedLinkedPlayer({ uid: predictor.uid, playerId })
    await adminDb.collection('players').doc(matchPlayerId).set({ name: 'Prediction MVP' })
    await seedMatch(matchId, {
      kickoffAt: null,
      date: futureIso().slice(0, 10),
      time: '23:59',
      teamWhite: [matchPlayerId],
      teamBlack: [makeId('opponent')],
    })

    await deny(
      setDoc(doc(predictor.firestore, 'predictions', `${predictor.uid}_${matchId}`), {
        odedBy: predictor.uid,
        matchId,
        prediction: 'white',
        probability: 60,
        predictedMvpId: matchPlayerId,
        predictedScoreWhite: 4,
        predictedScoreBlack: 2,
        userName: 'Predictor',
        userEmail: '',
        userPhoto: '',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    )
  } finally {
    await deleteApp(predictor.app)
  }
})

test('signed-in voters can cast exactly one structurally valid team-poll vote', async () => {
  const pollId = makeId('poll')
  const voter = await anonymousClient()
  const options = [pollOption('a'), pollOption('b'), pollOption('c')]
  await adminDb.collection('matches').doc(pollId).set({
    type: 'teamPoll',
    title: 'Choose a lineup',
    options,
    totalVotes: 0,
    createdAt: new Date().toISOString(),
  })

  try {
    await allow(
      updateDoc(doc(voter.firestore, 'matches', pollId), {
        options: [{ ...options[0], votes: 1 }, options[1], options[2]],
        totalVotes: 1,
        pollVoters: {
          [voter.uid]: {
            optionIndex: 0,
            votedAt: Date.now(),
          },
        },
        updatedAt: serverTimestamp(),
      })
    )

    await deny(
      updateDoc(doc(voter.firestore, 'matches', pollId), {
        options: [{ ...options[0], votes: 2 }, options[1], options[2]],
        totalVotes: 2,
        pollVoters: {
          [voter.uid]: {
            optionIndex: 0,
            votedAt: Date.now(),
          },
        },
        updatedAt: serverTimestamp(),
      })
    )
  } finally {
    await deleteApp(voter.app)
  }
})

test('linked active players can write only their own attendance response for future open matches', async () => {
  const matchId = makeId('attendance-open')
  const playerId = makeId('attendance-player')
  const player = await anonymousClient()
  const other = await anonymousClient()

  try {
    await seedMatch(matchId, { playerPool: [playerId] })
    await seedLinkedPlayer({ uid: player.uid, playerId })
    await seedLinkedPlayer({ uid: other.uid, playerId: makeId('other-player') })

    await allow(setDoc(attendanceResponseRef(player.firestore, matchId, player.uid), validAttendanceResponse(playerId)))
    await allow(
      updateDoc(attendanceResponseRef(player.firestore, matchId, player.uid), {
        intent: 'declined',
        updatedAt: serverTimestamp(),
      })
    )
    await deny(setDoc(attendanceResponseRef(other.firestore, matchId, player.uid), validAttendanceResponse(playerId)))
    await deny(
      setDoc(attendanceResponseRef(player.firestore, matchId, player.uid), {
        playerId: makeId('spoofed-player'),
        intent: 'confirmed',
        updatedAt: serverTimestamp(),
      })
    )
    await deny(
      setDoc(attendanceResponseRef(player.firestore, matchId, player.uid), {
        playerId,
        intent: 'maybe',
        updatedAt: serverTimestamp(),
      })
    )
  } finally {
    await Promise.all([deleteApp(player.app), deleteApp(other.app)])
  }
})

test('attendance responses require a linked player and an active player', async () => {
  const matchId = makeId('attendance-linkage')
  await seedMatch(matchId)

  const missingLink = await anonymousClient()
  const blockedUser = await anonymousClient()
  const archivedPlayer = await anonymousClient()

  try {
    const missingPlayerId = makeId('missing-player')
    const blockedUserPlayerId = makeId('blocked-user-player')
    const archivedPlayerId = makeId('archived-player')
    await seedMatch(matchId, {
      playerPool: [
        missingPlayerId,
        blockedUserPlayerId,
        archivedPlayerId,
      ],
    })
    await seedLinkedPlayer({ uid: blockedUser.uid, playerId: blockedUserPlayerId })
    await seedLinkedPlayer({
      uid: archivedPlayer.uid,
      playerId: archivedPlayerId,
      player: { archived: true },
    })
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [blockedUser.uid] })

    await deny(
      setDoc(attendanceResponseRef(missingLink.firestore, matchId, missingLink.uid), validAttendanceResponse(missingPlayerId))
    )
    await deny(
      setDoc(
        attendanceResponseRef(blockedUser.firestore, matchId, blockedUser.uid),
        validAttendanceResponse(blockedUserPlayerId)
      )
    )
    await deny(
      setDoc(
        attendanceResponseRef(archivedPlayer.firestore, matchId, archivedPlayer.uid),
        validAttendanceResponse(archivedPlayerId)
      )
    )
  } finally {
    await adminDb.collection('settings').doc('blockedUsers').set({ list: [] })
    await Promise.all([
      deleteApp(missingLink.app),
      deleteApp(blockedUser.app),
      deleteApp(archivedPlayer.app),
    ])
  }
})

test('attendance responses are denied for blocked user links', async () => {
  const matchId = makeId('blocked-link-match')
  const playerId = makeId('blocked-link-player')
  const blockedLink = await anonymousClient()

  try {
    await seedMatch(matchId, { playerPool: [playerId] })
    await seedLinkedPlayer({ uid: blockedLink.uid, playerId, link: { blocked: true } })
    await deny(
      setDoc(
        attendanceResponseRef(blockedLink.firestore, matchId, blockedLink.uid),
        validAttendanceResponse(playerId)
      )
    )
  } finally {
    await deleteApp(blockedLink.app)
  }
})

test('attendance responses are denied for archived user links', async () => {
  const matchId = makeId('archived-link-match')
  const playerId = makeId('archived-link-player')
  const archivedLink = await anonymousClient()

  try {
    await seedMatch(matchId, { playerPool: [playerId] })
    await seedLinkedPlayer({ uid: archivedLink.uid, playerId, link: { archived: true } })
    await deny(
      setDoc(
        attendanceResponseRef(archivedLink.firestore, matchId, archivedLink.uid),
        validAttendanceResponse(playerId)
      )
    )
  } finally {
    await deleteApp(archivedLink.app)
  }
})

test('attendance responses are denied for missing matches', async () => {
  const playerId = makeId('missing-match-player')
  const player = await anonymousClient()
  await seedLinkedPlayer({ uid: player.uid, playerId })

  try {
    await deny(
      setDoc(
        attendanceResponseRef(player.firestore, makeId('missing-match'), player.uid),
        validAttendanceResponse(playerId)
      )
    )
  } finally {
    await deleteApp(player.app)
  }
})

test('attendance responses are denied after kickoff', async () => {
  const playerId = makeId('started-player')
  const player = await anonymousClient()
  await seedLinkedPlayer({ uid: player.uid, playerId })
  const startedId = makeId('started-match')
  await seedMatch(startedId, {
    date: pastIso().slice(0, 10),
    time: '00:00',
    utcOffset: '+00:00',
    playerPool: [playerId],
    kickoffAt: Timestamp.fromDate(pastDate()),
  })

  try {
    await deny(setDoc(attendanceResponseRef(player.firestore, startedId, player.uid), validAttendanceResponse(playerId)))
  } finally {
    await deleteApp(player.app)
  }
})

test('attendance responses are denied for completed matches', async () => {
  const playerId = makeId('closed-player')
  const player = await anonymousClient()
  await seedLinkedPlayer({ uid: player.uid, playerId })
  const completedId = makeId('completed-match')
  await seedMatch(completedId, { playerPool: [playerId], winner: 'white' })

  try {
    await deny(setDoc(attendanceResponseRef(player.firestore, completedId, player.uid), validAttendanceResponse(playerId)))
  } finally {
    await deleteApp(player.app)
  }
})

test('attendance responses are denied when a future match is explicitly closed', async () => {
  const playerId = makeId('closed-player')
  const player = await anonymousClient()
  await seedLinkedPlayer({ uid: player.uid, playerId })
  const closedId = makeId('closed-match')
  await seedMatch(closedId, {
    playerPool: [playerId],
    kickoffAt: Timestamp.fromDate(futureDate()),
    status: 'closed',
  })

  try {
    await deny(setDoc(attendanceResponseRef(player.firestore, closedId, player.uid), validAttendanceResponse(playerId)))
  } finally {
    await deleteApp(player.app)
  }
})
