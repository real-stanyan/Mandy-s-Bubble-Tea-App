import {
  Easing,
  makeMutable,
  useAnimatedScrollHandler,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

// The floating tab pill gets out of the way while the customer reads down a
// page and comes back the moment they scroll up — the Instagram bar's shrink.
// One shared value, written by whichever list is under the finger (its
// scroll worklet) and read by the pill; nothing crosses to JS.

/** 0 = the pill at full size, 1 = shrunk. */
export const tabBarShrink: SharedValue<number> = makeMutable(0)

/** Scale of the pill when fully shrunk; it also sits this much lower. */
export const SHRINK_SCALE = 0.86
export const SHRINK_DROP = 4

const SHRINK = { duration: 240, easing: Easing.out(Easing.cubic) }

/** Near the top the pill is always whole — a page that has barely moved has
 *  nothing to hide from. */
const TOP_ZONE = 24
/** Movement smaller than this is a hand at rest, not a direction. */
const DEAD_BAND = 6

/**
 * Where the pill should be after a scroll event: 1 (shrink) when the page is
 * moving down and is past the top zone, 0 (whole) when moving up or back at
 * the top, or -1 when the event changes nothing. Pure so it can be tested;
 * the worklet directive lets the scroll handler call it on the UI thread.
 */
export function chromeShrinkTarget(y: number, lastY: number, current: number): number {
  'worklet'
  if (y <= TOP_ZONE) return current === 0 ? -1 : 0
  const dy = y - lastY
  if (dy > DEAD_BAND && current !== 1) return 1
  if (dy < -DEAD_BAND && current !== 0) return 0
  return -1
}

/** Feed one scroll event into the shared value. UI thread only. */
export function driveChromeShrink(
  y: number,
  lastY: SharedValue<number>,
  target: SharedValue<number>,
): void {
  'worklet'
  const t = chromeShrinkTarget(y, lastY.value, target.value)
  lastY.value = y
  if (t >= 0) {
    target.value = t
    tabBarShrink.value = withTiming(t, SHRINK)
  }
}

/** Bring the pill back whole — a tab change, a screen that starts fresh. */
export function expandChrome(): void {
  tabBarShrink.value = withTiming(0, SHRINK)
}

/** A scroll handler for plain lists (Animated.ScrollView) that only drives
 *  the pill. Lists with their own worklet call driveChromeShrink inside it. */
export function useChromeScrollHandler() {
  const lastY = useSharedValue(0)
  const target = useSharedValue(0)
  return useAnimatedScrollHandler({
    onScroll: (e) => {
      driveChromeShrink(e.contentOffset.y, lastY, target)
    },
  })
}
