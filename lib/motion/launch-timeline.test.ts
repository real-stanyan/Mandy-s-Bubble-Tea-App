import { LAUNCH, launchDismissDelay, pearlDelayMs } from './launch-timeline'

describe('launch timeline', () => {
  it('keeps the pour whole: an early ready waits out the minimum', () => {
    expect(launchDismissDelay({ elapsedMs: 400, ready: true, reducedMotion: false })).toBe(
      LAUNCH.minShowMs - 400,
    )
  })

  it('leaves at once when ready arrives after the minimum', () => {
    expect(launchDismissDelay({ elapsedMs: 3000, ready: true, reducedMotion: false })).toBe(0)
  })

  it('waits for ready while under the cap', () => {
    expect(launchDismissDelay({ elapsedMs: 3000, ready: false, reducedMotion: false })).toBeNull()
  })

  it('never traps the app: past the cap it leaves even if auth is still loading', () => {
    expect(launchDismissDelay({ elapsedMs: LAUNCH.maxShowMs, ready: false, reducedMotion: false })).toBe(0)
    expect(launchDismissDelay({ elapsedMs: LAUNCH.maxShowMs + 5000, ready: false, reducedMotion: false })).toBe(0)
  })

  it('Reduce Motion holds for a beat, not the length of a pour it did not play', () => {
    expect(launchDismissDelay({ elapsedMs: 0, ready: true, reducedMotion: true })).toBe(
      LAUNCH.reducedMinShowMs,
    )
    expect(LAUNCH.reducedMinShowMs).toBeLessThan(LAUNCH.pourDelayMs + LAUNCH.pourMs)
  })

  it('tolerates a bad clock', () => {
    expect(launchDismissDelay({ elapsedMs: -50, ready: true, reducedMotion: false })).toBe(LAUNCH.minShowMs)
    expect(launchDismissDelay({ elapsedMs: NaN, ready: true, reducedMotion: false })).toBe(LAUNCH.minShowMs)
  })

  it('orders the sequence: pour → pearls → wordmark → earliest exit', () => {
    const pourEnd = LAUNCH.pourDelayMs + LAUNCH.pourMs
    expect(LAUNCH.pearlDelayMs).toBeLessThan(pourEnd)
    expect(LAUNCH.pearlDelayMs).toBeGreaterThan(LAUNCH.pourDelayMs + LAUNCH.pourMs / 2)
    expect(LAUNCH.wordmarkDelayMs).toBeGreaterThanOrEqual(pourEnd)
    const lastPearlLands = pearlDelayMs(LAUNCH.pearlCount - 1) + 500
    expect(LAUNCH.minShowMs).toBeGreaterThan(Math.max(lastPearlLands, LAUNCH.wordmarkDelayMs + LAUNCH.wordmarkMs))
    expect(LAUNCH.maxShowMs).toBeGreaterThan(LAUNCH.minShowMs)
  })

  it('staggers pearls from the pearl delay', () => {
    expect(pearlDelayMs(0)).toBe(LAUNCH.pearlDelayMs)
    expect(pearlDelayMs(3)).toBe(LAUNCH.pearlDelayMs + 3 * LAUNCH.pearlStaggerMs)
    expect(pearlDelayMs(-2)).toBe(LAUNCH.pearlDelayMs)
  })
})
