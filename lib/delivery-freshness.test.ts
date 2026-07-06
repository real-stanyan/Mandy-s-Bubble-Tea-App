import { freshness, STALE_AFTER_SEC } from './delivery-freshness'

const NOW = Date.parse('2026-07-04T10:00:00.000Z')
const agoSec = (s: number) => new Date(NOW - s * 1000).toISOString()

describe('freshness (ported from web delivery-freshness.ts)', () => {
  it('waiting when no driver or no fix yet', () => {
    expect(freshness(false, agoSec(5), NOW)).toEqual({
      label: 'Waiting for driver location…',
      state: 'waiting',
    })
    expect(freshness(true, null, NOW)).toEqual({
      label: 'Waiting for driver location…',
      state: 'waiting',
    })
  })

  it('live under 15s', () => {
    expect(freshness(true, agoSec(0), NOW)).toEqual({
      label: 'Live · driver on the way',
      state: 'live',
    })
    expect(freshness(true, agoSec(14), NOW).state).toBe('live')
  })

  it('recent 15–89s with seconds copy', () => {
    expect(freshness(true, agoSec(15), NOW)).toEqual({
      label: 'Updated 15s ago',
      state: 'recent',
    })
    expect(freshness(true, agoSec(59), NOW)).toEqual({
      label: 'Updated 59s ago',
      state: 'recent',
    })
    // 60–89s: still recent, minutes copy
    expect(freshness(true, agoSec(75), NOW)).toEqual({
      label: 'Updated 1m ago',
      state: 'recent',
    })
  })

  it(`stale at ${STALE_AFTER_SEC}s+ — honest paused copy`, () => {
    expect(freshness(true, agoSec(STALE_AFTER_SEC), NOW)).toEqual({
      label: 'Location paused · last seen 2m ago',
      state: 'stale',
    })
    expect(freshness(true, agoSec(180), NOW)).toEqual({
      label: 'Location paused · last seen 3m ago',
      state: 'stale',
    })
  })

  it('clock skew (future timestamp) clamps to age 0 = live', () => {
    expect(freshness(true, agoSec(-30), NOW).state).toBe('live')
  })
})
