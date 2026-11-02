import { useEffect, useState } from 'react'

import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'

import { db } from '../firebase'
import {
  getAttendanceKickoffMillis,
  getAttendanceUnavailableReason,
  shouldSubscribeToAttendance,
} from '../utils/attendanceEligibility'
import {
  deriveAttendanceEntries,
  getMatchCapacity,
  isSafeFirestoreId,
  shouldWriteAttendanceResponse,
} from '../utils/matchday'
import { describeServiceError } from '../utils/serviceErrors'

const describeError = error =>
  error?.code === 'permission-denied'
    ? 'No puedes responder a este partido. Comprueba que tu cuenta esté vinculada a un jugador activo o contacta a un administrador del club.'
    : describeServiceError(
        error,
        (!error?.code && error?.message) || 'No se pudo guardar tu asistencia. Inténtalo de nuevo.'
      )

export function useAttendance(match, user, playerId) {
  const [entries, setEntries] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [retry, setRetry] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const matchId = match?.id
  const uid = user?.uid
  const capacity = getMatchCapacity(match)
  const unavailableReason = getAttendanceUnavailableReason(match, now)
  const shouldReadAttendance = shouldSubscribeToAttendance({ match, uid, playerId, now })
  const canRespond = shouldReadAttendance

  useEffect(() => {
    const kickoff = getAttendanceKickoffMillis(match)
    if (!matchId || kickoff === null || kickoff <= Date.now()) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [match, matchId])

  useEffect(() => {
    setEntries({})
    setError('')
    const safeMatchId = matchId ? String(matchId).trim() : ''
    setLoading(shouldReadAttendance)
    if (!shouldReadAttendance || !isSafeFirestoreId(safeMatchId)) return undefined
    return onSnapshot(
      collection(db, 'matchAttendance', safeMatchId, 'responses'),
      snapshot => {
        const responses = snapshot.docs.map(response => ({
          uid: response.id,
          ...response.data({ serverTimestamps: 'estimate' }),
        }))
        setEntries(deriveAttendanceEntries(responses, capacity))
        setLoading(false)
        setError('')
      },
      failure => {
        setError(describeError(failure))
        setLoading(false)
      }
    )
  }, [capacity, matchId, retry, shouldReadAttendance])

  const respond = async intent => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (!uid || !playerId)
        throw new Error('Inicia sesión con una cuenta vinculada a un jugador para responder.')
      const safeMatchId = matchId ? String(matchId).trim() : ''
      const safeUid = typeof uid === 'string' ? uid.trim() : ''
      const safePlayerId = typeof playerId === 'string' ? playerId.trim() : ''
      if (
        !isSafeFirestoreId(safeMatchId) ||
        !isSafeFirestoreId(safeUid) ||
        !isSafeFirestoreId(safePlayerId)
      ) {
        throw new Error('La asistencia no está disponible para este partido.')
      }
      const reason = getAttendanceUnavailableReason(match, Date.now())
      if (reason) throw new Error(reason)
      if (!['confirmed', 'declined'].includes(intent)) {
        throw new Error('Indica si puedes asistir o no.')
      }
      const responseRef = doc(db, 'matchAttendance', safeMatchId, 'responses', safeUid)
      await runTransaction(db, async transaction => {
        const current = await transaction.get(responseRef)
        const previous = current.data()
        if (!shouldWriteAttendanceResponse(previous, safePlayerId, intent)) return
        transaction.set(responseRef, {
          playerId: safePlayerId,
          intent,
          updatedAt: serverTimestamp(),
        })
      })
    } catch (failure) {
      setError(describeError(failure))
    } finally {
      setBusy(false)
    }
  }
  return {
    entries,
    error,
    loading,
    busy,
    canRespond,
    unavailableReason,
    respond,
    retry: () => setRetry(value => value + 1),
  }
}
