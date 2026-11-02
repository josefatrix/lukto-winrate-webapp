import assert from 'node:assert/strict'
import test from 'node:test'

import { QUOTA_MESSAGE, describeServiceError, isQuotaError } from '../src/utils/serviceErrors.js'

test('resource exhaustion is distinguished from access denial and offline errors', () => {
  assert.equal(isQuotaError({ code: 'firestore/resource-exhausted' }), true)
  assert.equal(isQuotaError({ message: 'Quota exceeded.' }), true)
  assert.equal(isQuotaError({ code: 'permission-denied' }), false)
  assert.equal(describeServiceError({ code: 'resource-exhausted' }, 'Offline'), QUOTA_MESSAGE)
  assert.equal(describeServiceError({ code: 'unavailable' }, 'Offline'), 'Offline')
})
