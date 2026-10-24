import test from 'node:test'
import assert from 'node:assert/strict'
import { transcriptPath, transcriptReturnTo, transcriptUrl } from '../server/tickets/links.js'
const path = '/transcripts/1100000000000000001/00000000-0000-4000-8000-000000000000'
test('transcript return URLs only accept the exact local transcript route', () => {
  assert.equal(transcriptPath('1100000000000000001', '00000000-0000-4000-8000-000000000000'), path)
  assert.equal(transcriptReturnTo(path), path)
  assert.equal(
    transcriptUrl('https://bot.branilist.com', '1100000000000000001', '00000000-0000-4000-8000-000000000000'),
    'https://bot.branilist.com' + path,
  )
  for (const value of [
    'https://evil.example' + path,
    '//evil.example' + path,
    path + '?next=https://evil.example',
    path + '#x',
    '/dashboard',
    path + '/../',
    undefined,
  ])
    assert.equal(transcriptReturnTo(value), undefined)
})
