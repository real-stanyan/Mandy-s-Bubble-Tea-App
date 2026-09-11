import {
  AMBIENT_STEP_MS,
  ASLEEP,
  MAX_FRAME_MS,
  SCROLL_HOLD_MS,
  advanceAmbient,
  ambientClock,
  ambientHeld,
  ambientNow,
  appActive,
  lastScrollAt,
  launchCover,
  loopId,
  loopKey,
  loopPhase,
  memoProps,
  motionReduced,
  pagerBusy,
  quantize,
  releaseSlot,
  stampScroll,
} from './ambient'

function resetClock() {
  ambientClock.value = 0
  ambientNow.value = 0
  lastScrollAt.value = -1e9
  pagerBusy.value = 0
  appActive.value = 1
  motionReduced.value = 0
  launchCover.value = 0
}

/** Run the clock for `frames` frames of `dt` ms, from `from`. */
function run(from: number, frames: number, dt = 1000 / 60): number {
  let t = from
  for (let i = 0; i < frames; i++) {
    t += dt
    advanceAmbient(t, dt)
  }
  return t
}

describe('the ambient clock', () => {
  beforeEach(resetClock)

  it('advances in whole steps, not every frame', () => {
    const seen = new Set<number>()
    let t = 0
    for (let i = 0; i < 60; i++) {
      t += 1000 / 60
      advanceAmbient(t, 1000 / 60)
      seen.add(ambientClock.value)
    }
    // One second at 60Hz: the clock took about twenty distinct values, each a multiple of the step.
    expect(seen.size).toBeGreaterThanOrEqual(19)
    expect(seen.size).toBeLessThanOrEqual(21)
    for (const v of seen) expect(v % AMBIENT_STEP_MS).toBe(0)
  })

  it('stands still while a list scrolls, then picks up where it was', () => {
    const dt = 1000 / 60
    let t = run(0, 30)
    const before = ambientClock.value
    expect(before).toBeGreaterThan(0)
    stampScroll()
    // Every frame inside the hold leaves the clock where it was.
    const held = Math.floor(SCROLL_HOLD_MS / dt)
    t = run(t, held)
    expect(ambientClock.value).toBe(before)
    // The frame after the hold advances it, and from there time resumes from
    // `before` — thirty-one frames is about 517ms, give or take a step.
    run(t, 31)
    const advanced = ambientClock.value - before
    expect(advanced).toBeGreaterThanOrEqual(quantize(31 * dt) - AMBIENT_STEP_MS)
    expect(advanced).toBeLessThanOrEqual(quantize(31 * dt) + AMBIENT_STEP_MS)
  })

  it('stands still while the pager moves, in the background, under Reduce Motion and under the launch screen', () => {
    let t = run(0, 12)
    const a = ambientClock.value
    pagerBusy.value = 1
    t = run(t, 12)
    expect(ambientClock.value).toBe(a)
    pagerBusy.value = 0
    appActive.value = 0
    t = run(t, 12)
    expect(ambientClock.value).toBe(a)
    appActive.value = 1
    motionReduced.value = 1
    t = run(t, 12)
    expect(ambientClock.value).toBe(a)
    motionReduced.value = 0
    launchCover.value = 1
    t = run(t, 12)
    expect(ambientClock.value).toBe(a)
    launchCover.value = 0
    run(t, 12)
    expect(ambientClock.value).toBeGreaterThan(a)
  })

  it('never leaps after a stall', () => {
    run(0, 6)
    const a = ambientClock.value
    advanceAmbient(100_000, 100_000)
    expect(ambientClock.value - a).toBeLessThanOrEqual(MAX_FRAME_MS)
  })

  it('quantises to the step', () => {
    expect(quantize(0)).toBe(0)
    expect(quantize(AMBIENT_STEP_MS - 0.01)).toBe(0)
    expect(quantize(AMBIENT_STEP_MS)).toBe(AMBIENT_STEP_MS)
    expect(quantize(AMBIENT_STEP_MS * 7.9)).toBe(AMBIENT_STEP_MS * 7)
  })

  it('is held by any one of its reasons', () => {
    expect(ambientHeld(1000, 1000 - SCROLL_HOLD_MS + 1, 0, 1, 0)).toBe(true)
    expect(ambientHeld(1000, 1000 - SCROLL_HOLD_MS, 0, 1, 0)).toBe(false)
    expect(ambientHeld(1000, -1e9, 1, 1, 0)).toBe(true)
    expect(ambientHeld(1000, -1e9, 0, 0, 0)).toBe(true)
    expect(ambientHeld(1000, -1e9, 0, 1, 1)).toBe(true)
    expect(ambientHeld(1000, -1e9, 0, 1, 0, 1)).toBe(true)
    expect(ambientHeld(1000, -1e9, 0, 1, 0)).toBe(false)
  })
})

describe('a loop on the clock', () => {
  const loop = (period: number, delay = 0, on = true) => ({ id: loopId(), period, delay, on })

  it('sleeps when off or gated, and holds frame zero', () => {
    const off = loop(1000, 0, false)
    expect(loopKey(off, 5000, true)).toBe(ASLEEP)
    const gated = loop(1000)
    expect(loopKey(gated, 5000, false)).toBe(ASLEEP)
    expect(loopPhase(gated, ASLEEP)).toBe(0)
  })

  it('counts its delay from the moment it first wakes, then cycles', () => {
    const l = loop(1000, 200)
    expect(loopKey(l, 5000, true)).toBe(0)
    expect(loopKey(l, 5150, true)).toBe(0)
    expect(loopPhase(l, 0)).toBe(0)
    const k = loopKey(l, 5450, true)
    expect(k).toBe(5450)
    expect(loopPhase(l, k)).toBeCloseTo(0.25)
    expect(loopPhase(l, loopKey(l, 6200, true))).toBeCloseTo(0)
    expect(loopPhase(l, loopKey(l, 6950, true))).toBeCloseTo(0.75)
    releaseSlot(l.id)
  })

  it('wakes again on the same timeline after a gate closes and opens', () => {
    const l = loop(2000)
    loopKey(l, 1000, true)
    expect(loopKey(l, 1500, false)).toBe(ASLEEP)
    expect(loopPhase(l, loopKey(l, 2000, true))).toBeCloseTo(0.5)
    releaseSlot(l.id)
  })

  it('hands back the same props while the key holds, and new ones when it moves', () => {
    const id = loopId()
    let builds = 0
    const build = () => {
      builds++
      return { opacity: builds }
    }
    const a = memoProps(id, 0, build)
    const b = memoProps(id, 0, build)
    expect(b).toBe(a)
    expect(builds).toBe(1)
    const c = memoProps(id, 50, build)
    expect(c).not.toBe(a)
    expect(builds).toBe(2)
    const d = memoProps(id, ASLEEP, build)
    expect(memoProps(id, ASLEEP, build)).toBe(d)
    expect(builds).toBe(3)
    releaseSlot(id)
    memoProps(id, ASLEEP, build)
    expect(builds).toBe(4)
  })
})
