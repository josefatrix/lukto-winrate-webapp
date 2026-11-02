import assert from 'node:assert/strict'
import test from 'node:test'

import { getActivePlayerIds, sanitizeBuilderRoster } from '../src/utils/builderRoster.js'

test('builder sanitation keeps archived players from the original completed match roster', () => {
  const activeIds = getActivePlayerIds([
    { id: 'active-a', name: 'Active A' },
    { id: 'active-b', name: 'Active B' },
    { id: 'archived-original', name: 'Archived Original', archived: true },
  ])
  const editableIds = new Set([...activeIds, 'archived-original'])

  const result = sanitizeBuilderRoster(
    {
      selectedPlayers: ['archived-original', 'active-a', 'active-b'],
      teamWhite: ['archived-original'],
      teamBlack: ['active-a'],
      matchPositions: { 'archived-original': 'portero', 'active-a': 'medio' },
      lockedWhiteCaptain: 'archived-original',
    },
    editableIds,
    2
  )

  assert.deepEqual(result.selectedPlayers, ['archived-original', 'active-a', 'active-b'])
  assert.deepEqual(result.teamWhite, ['archived-original'])
  assert.deepEqual(result.matchPositions, { 'archived-original': 'portero', 'active-a': 'medio' })
  assert.equal(result.lockedWhiteCaptain, 'archived-original')
  assert.equal(result.removedIds, 0)
})

test('builder sanitation rejects archived players for new rosters', () => {
  const activeIds = getActivePlayerIds([
    { id: 'active-a', name: 'Active A' },
    { id: 'archived-new', name: 'Archived New', archived: true },
  ])

  const result = sanitizeBuilderRoster(
    {
      selectedPlayers: ['archived-new', 'active-a'],
      teamWhite: ['archived-new'],
      matchPositions: { 'archived-new': 'portero', 'active-a': 'medio' },
      lockedWhiteCaptain: 'archived-new',
    },
    activeIds,
    1
  )

  assert.deepEqual(result.selectedPlayers, ['active-a'])
  assert.deepEqual(result.teamWhite, [])
  assert.deepEqual(result.matchPositions, { 'active-a': 'medio' })
  assert.equal(result.lockedWhiteCaptain, '')
  assert.equal(result.removedIds, 1)
})
