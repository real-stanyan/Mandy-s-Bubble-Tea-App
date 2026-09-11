import { launchCover } from '@/lib/motion/ambient'

// The launch screen covers the app for its first two seconds or so
// (components/launch/LaunchScreen). Whatever mounts or moves under it in
// that time is work nobody sees, and it is work the pour has to share the
// main thread with: a tab page mounting under the cup is a dropped frame in
// the cup (Rick, 2026-09-11: the opening animation stutters on both
// platforms). So what can wait asks here whether the cover is still up, and
// waits for it to go.

let covered = true
const waiting = new Set<() => void>()

/** True from the start of the app until the launch screen has gone. */
export function launchCovered(): boolean {
  return covered
}

/** The launch screen has gone — faded out, or failed and was dropped. Runs
 *  whatever was waiting for it, and lets the ambient loops go. */
export function endLaunch(): void {
  if (!covered) return
  covered = false
  launchCover.value = 0
  const queued = [...waiting]
  waiting.clear()
  queued.forEach((arm) => arm())
}

/** Runs `fn` `delayMs` after the launch screen has gone, or `delayMs` from
 *  now when it already has. Returns a cancel. */
export function afterLaunch(fn: () => void, delayMs = 0): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  let cancelled = false
  const arm = () => {
    if (!cancelled) timer = setTimeout(fn, delayMs)
  }
  if (covered) waiting.add(arm)
  else arm()
  return () => {
    cancelled = true
    waiting.delete(arm)
    if (timer !== null) clearTimeout(timer)
  }
}
