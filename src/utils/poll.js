/** A missing local vote must never be interpreted as option zero. */
export const parseStoredPollVote = value => {
  if (value === null || value === undefined || String(value).trim() === '') return null
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 ? index : null
}
