import { LAUNCH, launchDismissDelay, nextCalm, pearlDelayMs, timelineMayStart } from './launch-timeline'

describe('launch timeline', () => {
  it('keeps the pour whole: an early ready waits out the minimum', () => {
    expect(launchDismissDelay({ elapsedMs: 400, ready: true, reducedMotion: false })).toBe(
      LAUNCH.minShowMs - 400,
    )
  })

  it('leaves a beat after ready when ready arrives after the minimum', () => {
    expect(launchDismissDelay({ elapsedMs: 3000, ready: true, reducedMotion: false })).toBe(
      LAUNCH.readySettleMs,
    )
  })

  it('keeps the settle beat short: under the Reduce Motion hold, never past the cap', () => {
    expect(LAUNCH.readySettleMs).toBeGreaterThan(0)
    expect(LAUNCH.readySettleMs).toBeLessThan(LAUNCH.reducedMinShowMs)
    expect(
      launchDismissDelay({ elapsedMs: LAUNCH.maxShowMs - 100, ready: true, reducedMotion: false }),
    ).toBe(100)
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

  it('holds for calm frames, and never past the hold cap', () => {
    expect(nextCalm(0, null)).toBe(0)
    expect(nextCalm(1, 16.7)).toBe(2)
    expect(nextCalm(3, 120)).toBe(0)
    // A 120 Hz frame is calm, and so is one missed 60 Hz frame; two are not.
    expect(nextCalm(0, 8.3)).toBe(1)
    expect(nextCalm(0, 33.4)).toBe(1)
    expect(nextCalm(0, 50)).toBe(0)
    expect(timelineMayStart(LAUNCH.calmFrames, 0)).toBe(true)
    expect(timelineMayStart(LAUNCH.calmFrames - 1, LAUNCH.holdMaxMs - 1)).toBe(false)
    expect(timelineMayStart(0, LAUNCH.holdMaxMs)).toBe(true)
    expect(LAUNCH.holdMaxMs).toBeLessThan(LAUNCH.minShowMs)
  })

  it('staggers pearls from the pearl delay', () => {
    expect(pearlDelayMs(0)).toBe(LAUNCH.pearlDelayMs)
    expect(pearlDelayMs(3)).toBe(LAUNCH.pearlDelayMs + 3 * LAUNCH.pearlStaggerMs)
    expect(pearlDelayMs(-2)).toBe(LAUNCH.pearlDelayMs)
  })
})
