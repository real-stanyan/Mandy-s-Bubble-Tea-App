import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { useFrameCallback, useReducedMotion, type FrameInfo } from 'react-native-reanimated'
import { advanceAmbient, appActive, motionReduced } from '@/lib/motion/ambient'

// Moves the ambient clock (lib/motion/ambient) along: one frame callback for
// the whole app, mounted once in the root layout. It stops with the app in
// the background — no frames, no clock — and tells the clock about Reduce
// Motion, under which it stands still and every loop holds frame zero.

function onFrame(info: FrameInfo) {
  'worklet'
  advanceAmbient(info.timestamp, info.timeSincePreviousFrame ?? 0)
}

/** iOS reports 'unknown' until the first change; only a reading that says
 *  the app is away stops the clock. */
export function appIsActive(state: AppStateStatus | null | undefined): boolean {
  return state !== 'background' && state !== 'inactive'
}

export function AmbientClock() {
  const reduced = useReducedMotion()
  const frame = useFrameCallback(onFrame, true)
  useEffect(() => {
    motionReduced.value = reduced ? 1 : 0
  }, [reduced])
  useEffect(() => {
    const apply = (state: AppStateStatus) => {
      const active = appIsActive(state)
      appActive.value = active ? 1 : 0
      frame.setActive(active)
    }
    apply(AppState.currentState)
    const sub = AppState.addEventListener('change', apply)
    return () => sub.remove()
  }, [frame])
  return null
}
