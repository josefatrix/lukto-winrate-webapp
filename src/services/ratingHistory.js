import { collection, getDocsFromServer, query, where } from 'firebase/firestore'

import localforage from 'localforage'

import { db } from '../firebase'
import { createRatingCache } from '../utils/ratingCache'

const cache = createRatingCache({
  storage: localforage.createInstance({
    name: `lukto-ratings-${db.app.options.projectId}`,
    storeName: 'match_history',
  }),
  fetchRows: async matchId => {
    const snapshot = await getDocsFromServer(
      query(collection(db, 'ratings'), where('matchId', '==', matchId))
    )
    return snapshot.docs.map(item => ({ ...item.data(), id: item.id }))
  },
})

// Limit first-visit concurrency and coalesce duplicate React/tab consumers in
// this runtime. Subsequent visits reuse the persistent match snapshots.
export async function loadRatingHistory(matches) {
  const queue = [...matches]
  const results = []
  let failed = false
  await Promise.all(
    Array.from({ length: Math.min(3, queue.length) }, async () => {
      while (queue.length && !failed) {
        const match = queue.shift()
        try {
          results.push(await cache.load(match))
        } catch (error) {
          failed = true
          throw error
        }
      }
    })
  )
  const ratings = {}
  for (const result of results) {
    for (const row of result.rows) {
      if (!row.ratedPlayerId) continue
      ;(ratings[row.ratedPlayerId] ||= []).push(row)
    }
  }
  return { ratings, error: results.find(result => result.error)?.error }
}
