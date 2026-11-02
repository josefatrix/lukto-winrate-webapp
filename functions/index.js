import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

import {
  getMatchCapacity,
  getMatchStartDate,
  isMatchPlayed,
  isSafeFirestoreId,
  updateAttendance,
} from './lib/attendance.js'

initializeApp()

const db = getFirestore()

const asString = value => (typeof value === 'string' ? value.trim() : '')

const requireValidIntent = intent => {
  if (intent === 'confirmed' || intent === 'declined') return intent
  throw new HttpsError('invalid-argument', 'Invalid attendance response.')
}

const assertFutureMatch = match => {
  const start = getMatchStartDate(match)
  if (!start) {
    throw new HttpsError('failed-precondition', 'Attendance requires a scheduled kickoff time.')
  }
  if (isMatchPlayed(match) || start.getTime() <= Date.now()) {
    throw new HttpsError('failed-precondition', 'Attendance is closed for this match.')
  }
}

export const respondToAttendance = onCall({ region: 'us-central1' }, async request => {
  const uid = request.auth?.uid
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in to respond.')

  const matchId = asString(request.data?.matchId)
  const intent = requireValidIntent(request.data?.intent)
  if (!isSafeFirestoreId(matchId)) throw new HttpsError('invalid-argument', 'Invalid match ID.')

  const attendanceRef = db.collection('matchAttendance').doc(matchId)
  const linkRef = db.collection('userLinks').doc(uid)
  const matchRef = db.collection('matches').doc(matchId)
  const blockedRef = db.collection('settings').doc('blockedUsers')

  return db.runTransaction(async transaction => {
    const linkSnap = await transaction.get(linkRef)
    const link = linkSnap.data()
    const playerId = asString(link?.playerId)
    if (!isSafeFirestoreId(playerId)) {
      throw new HttpsError(
        'permission-denied',
        'Your account must be linked to a player by an administrator.'
      )
    }
    if (link?.blocked || link?.archived) {
      throw new HttpsError('permission-denied', 'This account cannot respond to attendance.')
    }

    const playerRef = db.collection('players').doc(playerId)
    const [matchSnap, playerSnap, blockedSnap, attendanceSnap] = await Promise.all([
      transaction.get(matchRef),
      transaction.get(playerRef),
      transaction.get(blockedRef),
      transaction.get(attendanceRef),
    ])

    if (!matchSnap.exists) throw new HttpsError('not-found', 'Match not found.')
    const match = { id: matchSnap.id, ...matchSnap.data() }
    assertFutureMatch(match)

    const blockedUsers = blockedSnap.data()?.list || []
    if (blockedUsers.includes(uid)) {
      throw new HttpsError('permission-denied', 'This account is blocked from club actions.')
    }

    if (!playerSnap.exists || playerSnap.data()?.archived) {
      throw new HttpsError('permission-denied', 'This player is not active.')
    }

    const now = Date.now()
    let nextEntries
    try {
      nextEntries = updateAttendance(
        attendanceSnap.data()?.entries,
        playerId,
        uid,
        intent,
        getMatchCapacity(match),
        now
      )
    } catch (error) {
      if (error?.message?.includes('belongs to another account')) {
        throw new HttpsError('permission-denied', error.message)
      }
      throw error
    }

    transaction.set(attendanceRef, {
      matchId,
      entries: nextEntries,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return { status: nextEntries[playerId].status }
  })
})
