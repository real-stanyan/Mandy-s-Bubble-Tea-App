import { getStoreStatus } from './helpers'

// Store hours: 10:30–22:30 Australia/Brisbane (UTC+10, no DST).
describe('getStoreStatus', () => {
  // Dogfood fixture 2026-06-04: at 23:35 Brisbane (13:35Z) the checkout
  // StoreBlock still showed a hardcoded "Open now" badge after close.
  it('reports closed at 23:35 Brisbane with next-day open label', () => {
    const s = getStoreStatus(new Date('2026-06-04T13:35:00Z'))
    expect(s).toEqual({ open: false, nextLabel: '10:30am tomorrow' })
  })

  it('reports open mid-afternoon with closing label', () => {
    const s = getStoreStatus(new Date('2026-06-04T03:00:00Z')) // 13:00 Brisbane
    expect(s).toEqual({ open: true, nextLabel: 'until 10:30pm' })
  })

  it('is closed before opening with same-day label', () => {
    const s = getStoreStatus(new Date('2026-06-03T22:00:00Z')) // 08:00 Brisbane
    expect(s).toEqual({ open: false, nextLabel: '10:30am' })
  })

  it('flips exactly at the 10:30 open and 22:30 close boundaries', () => {
    expect(getStoreStatus(new Date('2026-06-04T00:30:00Z')).open).toBe(true) // 10:30
    expect(getStoreStatus(new Date('2026-06-04T00:29:00Z')).open).toBe(false) // 10:29
    expect(getStoreStatus(new Date('2026-06-04T12:30:00Z')).open).toBe(false) // 22:30
    expect(getStoreStatus(new Date('2026-06-04T12:29:00Z')).open).toBe(true) // 22:29
  })
})
