// A revision is written atomically with every rating mutation. Completed local
// snapshots can therefore be reused without querying an unchanged match again.
export const ratingRevisionKey = match => {
  const revision = match.ratingsRevision
  return revision && typeof revision.seconds === 'number'
    ? `${revision.seconds}:${revision.nanoseconds || 0}`
    : 'legacy'
}

export function createRatingCache({ storage, fetchRows, now = Date.now, maxAge = 7 * 86400000 }) {
  const memory = new Map()
  const inFlight = new Map()
  const latestRevision = new Map()
  const read = async id => {
    if (memory.has(id)) return memory.get(id)
    try {
      return await storage.getItem(id)
    } catch {
      return null
    }
  }
  const load = match => {
    const revision = ratingRevisionKey(match)
    const id = match.id
    const key = JSON.stringify([id, revision])
    latestRevision.set(id, revision)
    if (inFlight.has(key)) return inFlight.get(key)
    const promise = (async () => {
      const cached = await read(id)
      const complete = cached?.version === 1 && Array.isArray(cached.rows)
      if (complete && cached.revision === revision && now() - cached.fetchedAt < maxAge) {
        memory.set(id, cached)
        return { rows: cached.rows, stale: false }
      }
      try {
        const rows = await fetchRows(id)
        const record = { version: 1, revision, fetchedAt: now(), rows }
        if (latestRevision.get(id) === revision) {
          memory.set(id, record)
          try {
            await storage.setItem(id, record)
          } catch {
            /* Memory cache remains available. */
          }
        }
        return { rows, stale: false }
      } catch (error) {
        if (complete) return { rows: cached.rows, stale: true, error }
        throw error
      }
    })().finally(() => inFlight.delete(key))
    inFlight.set(key, promise)
    return promise
  }
  return { load }
}
