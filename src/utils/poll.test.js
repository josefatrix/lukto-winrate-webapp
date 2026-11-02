import assert from 'node:assert/strict'
import test from 'node:test'

import { parseStoredPollVote } from './poll.js'

test('first-time poll visitors have no stored vote', () => {
  for (const value of [null, undefined, '', ' ', '-1', '1.5', 'invalid']) {
    assert.equal(parseStoredPollVote(value), null)
  }
})

test('option zero remains a valid recorded vote', () => {
  assert.equal(parseStoredPollVote('0'), 0)
  assert.equal(parseStoredPollVote('2'), 2)
})
