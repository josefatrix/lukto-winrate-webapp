import assert from 'node:assert/strict'
import test from 'node:test'

import { createRatingCache, ratingRevisionKey } from '../src/utils/ratingCache.js'

const setup = () => {
  const data = new Map()
  let calls = 0
  let rows = [{ ratedPlayerId: 'p', matchId: 'm', score: 8 }]
  let failure = null
  const cache = createRatingCache({
    storage: {
      getItem: async key => data.get(key),
      setItem: async (key, value) => data.set(key, value),
    },
    fetchRows: async () => {
      calls++
      if (failure) throw failure
      return rows
    },
    now: () => 1000,
  })
  return {
    cache,
    data,
    calls: () => calls,
    setRows: value => {
      rows = value
    },
    fail: error => {
      failure = error
    },
  }
}

test('unchanged history is read once across repeated loads and cache instances', async () => {
  const s = setup()
  await s.cache.load({ id: 'm' })
  await s.cache.load({ id: 'm' })
  assert.equal(s.calls(), 1)
  const second = createRatingCache({
    storage: { getItem: async key => s.data.get(key) },
    fetchRows: () => {
      throw Error('unnecessary read')
    },
    now: () => 1001,
  })
  assert.equal((await second.load({ id: 'm' })).rows.length, 1)
})
test('a revision change reloads only its match and replaces deleted ratings', async () => {
  const s = setup()
  await s.cache.load({ id: 'm' })
  await s.cache.load({ id: 'other' })
  s.setRows([])
  assert.deepEqual(
    (await s.cache.load({ id: 'm', ratingsRevision: { seconds: 2, nanoseconds: 1 } })).rows,
    []
  )
  await s.cache.load({ id: 'other' })
  assert.equal(s.calls(), 3)
})
test('concurrent consumers share one network request', async () => {
  const s = setup()
  await Promise.all([s.cache.load({ id: 'm' }), s.cache.load({ id: 'm' })])
  assert.equal(s.calls(), 1)
})
test('quota failures preserve cached history without marking the new revision fresh', async () => {
  const s = setup()
  await s.cache.load({ id: 'm' })
  s.fail(Object.assign(Error('quota exceeded'), { code: 'resource-exhausted' }))
  const result = await s.cache.load({ id: 'm', ratingsRevision: { seconds: 2 } })
  assert.equal(result.rows[0].score, 8)
  assert.equal(result.stale, true)
  s.fail(null)
  s.setRows([])
  assert.deepEqual((await s.cache.load({ id: 'm', ratingsRevision: { seconds: 2 } })).rows, [])
})
test('a first-load failure never creates a complete empty cache', async () => {
  const s = setup()
  s.fail(Error('offline'))
  await assert.rejects(s.cache.load({ id: 'm' }), /offline/)
  assert.equal(s.data.size, 0)
})
test('private-mode storage failures do not prevent loading ratings', async () => {
  const cache = createRatingCache({
    storage: {
      getItem: async () => {
        throw Error('denied')
      },
      setItem: async () => {
        throw Error('denied')
      },
    },
    fetchRows: async () => [],
    now: () => 1000,
  })
  assert.deepEqual((await cache.load({ id: 'm' })).rows, [])
})
test('revision keys preserve sub-millisecond changes', () => {
  assert.notEqual(
    ratingRevisionKey({ ratingsRevision: { seconds: 2, nanoseconds: 1 } }),
    ratingRevisionKey({ ratingsRevision: { seconds: 2, nanoseconds: 2 } })
  )
})

test('expired snapshots revalidate even when their revision is unchanged', async () => {
  let reads = 0
  const cache = createRatingCache({
    storage: {
      getItem: async () => ({ version: 1, revision: 'legacy', fetchedAt: 1, rows: [] }),
      setItem: async () => {},
    },
    fetchRows: async () => {
      reads++
      return []
    },
    now: () => 10000,
    maxAge: 100,
  })
  await cache.load({ id: 'm' })
  assert.equal(reads, 1)
})

test('revisiting ten unchanged matches avoids all thousand historical document reads', async () => {
  const stored = new Map()
  let documentsRead = 0
  const cache = createRatingCache({
    storage: {
      getItem: async id => stored.get(id),
      setItem: async (id, value) => stored.set(id, value),
    },
    fetchRows: async id => {
      documentsRead += 100
      return Array.from({ length: 100 }, () => ({ matchId: id }))
    },
    now: () => 1000,
  })
  const matches = Array.from({ length: 10 }, (_, i) => ({ id: String(i) }))
  await Promise.all(matches.map(cache.load))
  assert.equal(documentsRead, 1000)
  for (let visit = 0; visit < 5; visit++) await Promise.all(matches.map(cache.load))
  assert.equal(documentsRead, 1000)
  await cache.load({ ...matches[0], ratingsRevision: { seconds: 2 } })
  assert.equal(documentsRead, 1100)
})
