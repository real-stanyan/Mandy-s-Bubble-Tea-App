import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Dimensions, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import {
  TabActions,
  TabRouter,
  createNavigatorFactory,
  useNavigationBuilder,
  type DefaultNavigatorOptions,
  type ParamListBase,
  type TabActionHelpers,
  type TabNavigationState,
  type TabRouterOptions,
} from '@react-navigation/native'
import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
  type BottomTabBarProps,
  type BottomTabNavigationEventMap,
  type BottomTabNavigationOptions,
  type BottomTabNavigationProp,
} from '@react-navigation/bottom-tabs'
import { withLayoutContext } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { SwipeScrollContext, type ScrollRegistry } from '@/components/navigation/HorizontalScrollView'
import { floatingTabBarClearance } from '@/components/ui/FloatingTabBar'
import { Frost, glassTabBarAvailable } from '@/components/ui/GlassTabBar'
import { IS_EVENING } from '@/constants/theme'
import { haptic } from '@/lib/haptics'
import { afterLaunch } from '@/lib/launch'
import { ambientNow, lastScrollAt, pagerBusy } from '@/lib/motion/ambient'
import { expandChrome } from '@/lib/motion/chrome'
import {
  HAZE_BLUR,
  SWIPE_SNAP,
  SWIPE_TRAVEL,
  fogSheet,
  fringeOpacity,
  hazeStrength,
  pageX,
  rubberBand,
  seamSide,
  settleTarget,
  snapVelocity,
  travelDuration,
} from '@/lib/motion/swipe-tabs'

// The tab navigator as a pager: the four pages sit side by side and a
// horizontal drag anywhere on a page pulls the next one in under the finger,
// Home to Menu to Orders to Account (Rick, 2026-09-11). A tap on the pill
// travels the same way. The page being left fogs over as it goes — a haze
// that rolls in from the join and has covered it by the time it is gone —
// and the page coming in arrives out of the same fog, clearing as it lands
// (real blur under the haze on a binary that can, iOS with expo-blur). The
// landing has a little give, the page settling like something with weight.
//
// Built on React Navigation's TabRouter, so everything the bottom-tabs
// navigator gave the screens still holds: useFocusEffect, tabPress, deep
// links, the back button returning to Home, useBottomTabBarHeight (the
// pill reports its clearance through the same contexts). Every page is
// rendered, not just the focused one — that is what makes the neighbour
// there to be dragged in. Headers are not drawn: every tab hides its own.
//
// Smoothness is all on the UI thread. The gesture writes one shared value
// (`position`, in pages: 1.4 is Menu with Orders 40% in); the row of
// pages, each page's fog and fringe, and the pill window all derive from
// it. The JS thread hears the haptic ticks, the final commit, and whether
// the pager is in motion — while it is, nothing on the pages takes a touch
// (a swipe that starts on a card must never end as a tap on it; Rick, on
// the phone).

type State = TabNavigationState<ParamListBase>
type Descriptors = BottomTabBarProps['descriptors']
type Navigation = BottomTabBarProps['navigation']

export type SwipeTabBarProps = BottomTabBarProps & {
  /** Where the pager is, in pages — the pill window follows it. */
  position: SharedValue<number>
}

type Props = DefaultNavigatorOptions<
  ParamListBase,
  string | undefined,
  State,
  BottomTabNavigationOptions,
  BottomTabNavigationEventMap,
  BottomTabNavigationProp<ParamListBase>
> &
  TabRouterOptions & {
    tabBar: (props: SwipeTabBarProps) => ReactNode
  }

function SwipeTabsNavigator({ tabBar, ...rest }: Props) {
  const { state, descriptors, navigation, NavigationContent } = useNavigationBuilder<
    State,
    TabRouterOptions,
    TabActionHelpers<ParamListBase>,
    BottomTabNavigationOptions,
    BottomTabNavigationEventMap
  >(TabRouter, rest)
  return (
    <NavigationContent>
      <Pager state={state} descriptors={descriptors} navigation={navigation} tabBar={tabBar} />
    </NavigationContent>
  )
}

export const SwipeTabs = withLayoutContext<
  BottomTabNavigationOptions,
  typeof SwipeTabsNavigator,
  State,
  BottomTabNavigationEventMap
>(createNavigatorFactory(SwipeTabsNavigator)().Navigator)

/** The finger has to move this far sideways before the pager takes the
 *  touch — a vertical list under it keeps anything shorter or steeper. Ten
 *  points, a scroll view's own slop: any less and a tap wobbles into a
 *  swipe, any more and a short swipe ends as a tap on whatever it began
 *  on. */
const ACTIVE_X = 10
const FAIL_Y = 12

/** Pages mount in waves: the one on screen, then its neighbours, then the
 *  rest one at a time — so the first swipe finds the next page laid out,
 *  and no one moment pays for four pages. The clock starts when the launch
 *  screen has gone (lib/launch). Counted from mount, the neighbour wave
 *  landed in the middle of the pour and the rest on the launch's exit fade:
 *  each a run of dropped frames in the one animation on the screen (Rick,
 *  2026-09-11), for pages nobody could see under the cover anyway. */
const NEIGHBOUR_MOUNT_MS = 450
const REST_MOUNT_MS = 1400
const REST_STAGGER_MS = 700
/** And a wave waits for the screen to be still (no scroll for STILL_MS, the
 *  pager at rest), looking again every STILL_POLL_MS, for WAVE_PATIENCE_MS
 *  at most: a page mounting under a scrolling finger is a hitch in the
 *  scroll. */
const STILL_MS = 400
const STILL_POLL_MS = 200
const WAVE_PATIENCE_MS = 3000

/** Nothing moving on the screen. Reads the UI thread's clock — a synchronous
 *  hop — so only ever at a wave's turn, never per frame. */
function screenStill(): boolean {
  return pagerBusy.value === 0 && ambientNow.value - lastScrollAt.value >= STILL_MS
}

const WINDOW_W = Dimensions.get('window').width

type PagerProps = {
  state: State
  descriptors: Descriptors
  navigation: Navigation
  tabBar: (props: SwipeTabBarProps) => ReactNode
}

function neighbours(center: number, count: number): number {
  let bits = 0
  if (center > 0) bits |= 1 << (center - 1)
  if (center < count - 1) bits |= 1 << (center + 1)
  return bits
}

/** The pages beyond the neighbours, nearest first. */
function farPages(center: number, count: number): number[] {
  const near = neighbours(center, count) | (1 << center)
  const out: number[] = []
  for (let i = 0; i < count; i++) if (!(near & (1 << i))) out.push(i)
  return out.sort((a, b) => Math.abs(a - center) - Math.abs(b - center))
}

function Pager({ state, descriptors, navigation, tabBar }: PagerProps) {
  const insets = useSafeAreaInsets()
  const reduced = useReducedMotion()
  const count = state.routes.length
  const index = state.index

  const [width, setWidth] = useState(WINDOW_W)
  const widthSv = useSharedValue(WINDOW_W)
  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const w = e.nativeEvent.layout.width
      if (w > 0) {
        setWidth(w)
        widthSv.value = w
      }
    },
    [widthSv],
  )

  // The pill reports its clearance (FloatingTabBar → callback context) and
  // the pages read it back through useBottomTabBarHeight, as under the
  // bottom-tabs navigator. Seeded with the same number so nothing jumps.
  const [tabBarHeight, setTabBarHeight] = useState(() => floatingTabBarClearance(insets.bottom))

  // Which pages exist, as bits.
  const [mountedMask, setMountedMask] = useState(() => 1 << index)
  const mount = useCallback((bits: number) => setMountedMask((m) => (m | bits) === m ? m : m | bits), [])
  const mountAround = useCallback((center: number) => mount(neighbours(center, count)), [mount, count])
  useEffect(() => {
    const first = index
    let alive = true
    // Each wave waits for a still screen, then goes as a transition: the
    // page renders in slices, and a tap that comes in meanwhile is answered
    // first.
    const wave = (bits: number) => () => {
      const deadline = Date.now() + WAVE_PATIENCE_MS
      const attempt = () => {
        if (!alive) return
        if (Date.now() < deadline && !screenStill()) {
          setTimeout(attempt, STILL_POLL_MS)
          return
        }
        startTransition(() => mount(bits))
      }
      attempt()
    }
    const cancels = [
      afterLaunch(wave(neighbours(first, count)), NEIGHBOUR_MOUNT_MS),
      ...farPages(first, count).map((page, k) =>
        afterLaunch(wave(1 << page), REST_MOUNT_MS + k * REST_STAGGER_MS),
      ),
    ]
    return () => {
      alive = false
      cancels.forEach((cancel) => cancel())
    }
    // Waves are scheduled once, from wherever the app opened.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    mount(1 << index)
  }, [index, mount])

  const position = useSharedValue(index)
  /** The page the pager itself last landed on: a state change that already
   *  matches it came from a swipe and needs no travel. */
  const settled = useSharedValue(index)
  const from = useSharedValue(index)
  const startPos = useSharedValue(0)
  const hover = useSharedValue(index)
  const dragging = useSharedValue(0)

  // While the pager moves — under the finger or landing — the pages take no
  // touches: the viewport keeps them for the gesture alone. Otherwise a
  // swipe that begins on a card and ends short lands as a tap on the card,
  // and a finger that meets a page still settling presses whatever slides
  // under it. Set from the UI thread when motion starts, cleared when the
  // landing animation reports it finished; a landing cut short by a new
  // drag never reports, and the new drag owns the flag.
  const [moving, setMoving] = useState(false)
  /** The page the motion set out from, for the one thing that has to be a
   *  React decision: which pages carry a blur sheet while it lasts — that
   *  one and its neighbours, plus wherever the pager is headed (see Fog). */
  const [departingIndex, setDepartingIndex] = useState(index)

  // The other half of "a swipe is never a tap". The pan taking the touch is
  // meant to cancel the press under the finger, but the loyalty card and
  // the drink cards still fired on release after a swipe on Rick's phone
  // (2026-09-11). So the viewport also claims the touch in RN's own
  // responder system the moment it has moved sideways by the pan's own
  // threshold: the card that held it is terminated then and there, on
  // both platforms, whatever the native side did. Vertical reading is
  // left alone (a scroll cancels the press itself), and claiming the
  // responder blocks no native scroll view — the rails keep rolling.
  const touchStart = useRef({ x: 0, y: 0 })
  const noteTouchStart = useCallback((e: GestureResponderEvent) => {
    touchStart.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
    return false
  }, [])
  const claimSideways = useCallback((e: GestureResponderEvent) => {
    const dx = e.nativeEvent.pageX - touchStart.current.x
    const dy = e.nativeEvent.pageY - touchStart.current.y
    return Math.abs(dx) >= ACTIVE_X && Math.abs(dx) > Math.abs(dy)
  }, [])
  const begin = useCallback((leaving: number) => {
    setDepartingIndex(leaving)
    setMoving(true)
  }, [])
  const rest = useCallback(() => setMoving(false), [])

  // While the pager moves the ambient loops on every page hold still
  // (lib/motion/ambient): the swipe has the frame to itself. Set from
  // whichever thread starts the motion, cleared on the UI thread when the
  // landing reports it finished — and on the way out, in case a landing
  // was cut short by the pager going away.
  useEffect(() => () => {
    pagerBusy.value = 0
  }, [])

  // The horizontal scrollers on the pages (HorizontalScrollView) register
  // their native gestures here; the pan waits for every one of them to
  // fail, so a touch that starts on a rail or a carousel is theirs.
  const [scrollers, setScrollers] = useState<NativeGesture[]>([])
  const registry = useMemo<ScrollRegistry>(
    () => ({
      register: (gesture) => {
        setScrollers((list) => (list.includes(gesture) ? list : [...list, gesture]))
        return () => setScrollers((list) => list.filter((g) => g !== gesture))
      },
    }),
    [],
  )

  // A tab press, a deep link, the back button: travel there, sweeping any
  // pages in between past (a tap two tabs over is a longer slide, not a
  // blink). Reduce Motion places the page instead.
  useEffect(() => {
    if (settled.value === index) return
    const leaving = settled.value
    const pages = index - leaving
    settled.value = index
    cancelAnimation(position)
    if (reduced) {
      position.value = index
      return
    }
    begin(leaving)
    pagerBusy.value = 1
    position.value = withTiming(
      index,
      { ...SWIPE_TRAVEL, duration: travelDuration(pages) },
      (finished) => {
        if (finished) {
          pagerBusy.value = 0
          runOnJS(rest)()
        }
      },
    )
  }, [index, reduced, position, settled, begin, rest])

  const tick = useCallback(() => haptic.tick(), [])
  const commit = useCallback(
    (target: number) => {
      const route = state.routes[target]
      if (!route) return
      haptic.pick()
      // A fresh tab starts with the pill whole.
      expandChrome()
      navigation.dispatch({
        ...TabActions.jumpTo(route.name, route.params),
        target: state.key,
      })
    },
    [navigation, state],
  )

  const pan = useMemo(() => {
    /** The finger has let go (or been taken away): land somewhere. */
    const land = (velocity: number) => {
      'worklet'
      const target = settleTarget(position.value, velocity, from.value, count)
      dragging.value = 0
      settled.value = target
      if (reduced) {
        position.value = target
        pagerBusy.value = 0
        runOnJS(rest)()
      } else {
        position.value = withSpring(
          target,
          { ...SWIPE_SNAP, velocity: snapVelocity(velocity) },
          (finished) => {
            if (finished) {
              pagerBusy.value = 0
              runOnJS(rest)()
            }
          },
        )
      }
      if (target !== from.value) runOnJS(commit)(target)
    }
    return Gesture.Pan()
      .activeOffsetX([-ACTIVE_X, ACTIVE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .requireExternalGestureToFail(...scrollers)
      .onStart(() => {
        cancelAnimation(position)
        startPos.value = position.value
        from.value = settled.value
        hover.value = Math.round(position.value)
        dragging.value = 1
        pagerBusy.value = 1
        runOnJS(begin)(settled.value)
        runOnJS(mountAround)(settled.value)
      })
      .onUpdate((e) => {
        const w = Math.max(1, widthSv.value)
        const next = rubberBand(startPos.value - e.translationX / w, count)
        position.value = next
        // A detent as the halfway line goes by, like the rail on the menu.
        const h = Math.round(next)
        if (h !== hover.value) {
          hover.value = h
          runOnJS(tick)()
        }
      })
      .onEnd((e) => {
        land(-e.velocityX / Math.max(1, widthSv.value))
      })
      .onFinalize(() => {
        // A drag the system took away mid-way (a native list grabbed the
        // touch) still has to land somewhere.
        if (dragging.value === 1) land(0)
      })
  }, [count, reduced, commit, tick, begin, rest, mountAround, scrollers, position, settled, from, startPos, hover, dragging, widthSv])

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX(0, position.value, widthSv.value) }],
  }))

  return (
    <View style={styles.root}>
      <BottomTabBarHeightContext.Provider value={tabBarHeight}>
        <SwipeScrollContext.Provider value={registry}>
        <GestureDetector gesture={pan}>
          <View
            style={styles.viewport}
            onLayout={onLayout}
            pointerEvents={moving ? 'box-only' : 'auto'}
            onStartShouldSetResponderCapture={noteTouchStart}
            onMoveShouldSetResponderCapture={claimSideways}
          >
            <Animated.View style={[styles.row, { width: width * count }, rowStyle]}>
              {state.routes.map((route, i) => {
                if (!(mountedMask & (1 << i))) return null
                return (
                  <Page
                    key={route.key}
                    index={i}
                    width={width}
                    widthSv={widthSv}
                    position={position}
                    focused={i === index}
                    blur={moving && (Math.abs(i - departingIndex) <= 1 || i === index)}
                    reduced={reduced}
                  >
                    <PageContent descriptor={descriptors[route.key]} />
                  </Page>
                )
              })}
            </Animated.View>
          </View>
        </GestureDetector>
        </SwipeScrollContext.Provider>
      </BottomTabBarHeightContext.Provider>
      <BottomTabBarHeightCallbackContext.Provider value={setTabBarHeight}>
        {tabBar({ state, descriptors, navigation, insets, position })}
      </BottomTabBarHeightCallbackContext.Provider>
    </View>
  )
}

// A page's screen, rendered once per descriptor. The pager's own state —
// in motion or at rest, which page is leaving, which pages exist — changes
// on every swipe, and the four screens must not re-render for any of it:
// the descriptors only change when the navigator's state does.
const PageContent = memo(function PageContent({ descriptor }: { descriptor: Descriptors[string] }) {
  return <>{descriptor.render()}</>
})

type PageProps = {
  index: number
  width: number
  widthSv: SharedValue<number>
  position: SharedValue<number>
  focused: boolean
  /** The pager is in motion and this page may be part of it: carry the
   *  blur sheet under the fog for as long as that lasts. */
  blur: boolean
  reduced: boolean
  children: ReactNode
}

// One page in the row. Its last sliver fades rather than being drawn to
// the edge (fringeOpacity): that is what the landing bounce would show of
// the page beyond, and it is the ground colour either way.
function Page({ index, width, widthSv, position, focused, blur, reduced, children }: PageProps) {
  const fringe = useAnimatedStyle(() => ({ opacity: fringeOpacity(index, position.value) }))
  return (
    <Animated.View
      style={[styles.page, { left: index * width, width }, fringe]}
      pointerEvents={focused ? 'auto' : 'none'}
      accessibilityElementsHidden={!focused}
      importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
    >
      {children}
      <Fog index={index} width={width} widthSv={widthSv} position={position} blur={blur} reduced={reduced} />
    </Animated.View>
  )
}

// The fog on a page in motion, by its distance from the pager
// (hazeStrength): the page being left fogs over as it goes, the page
// coming in arrives fogged and clears as it lands. One sheet per side,
// the page's width, anchored to that edge — whole fog at the edge, fading
// to nothing at the far end — and scaled from the edge by the haze
// (fogSheet); only the sheet on the seam side shows. So the join between
// the two moving pages is always whole fog on both sides, one colour, and
// the boundary between them dissolves (Rick: let the two pages fuse);
// each page emerges from the fog with distance from the join, the fog
// spreading over the page being left and draining back into the join on
// the page coming in. No edge anywhere, unlike the banded seam this
// replaces (Rick: "like a mosaic"). Under the sheet, where the binary can
// blur, one full-page blur whose intensity follows the same haze; it is
// mounted only while the pager moves and only on the pages that can be
// part of the move, so idle blur views never sit over four pages.
// Intensity is driven, never opacity: alpha on a blur view breaks the
// effect (Apple).
//
// The fog sits above everything on the page, including the floating heads
// that carry a zIndex of their own (the menu head, the strip under the
// clock): on iOS zIndex is the layer's z position, and a head at 10 would
// otherwise come through the fog sharp (Rick's phone, 2026-09-11).
export const FOG = IS_EVENING ? '#221C16' : '#FFF9F0'
const FOG_SOFT = IS_EVENING ? 'rgba(34,28,22,0.72)' : 'rgba(255,249,240,0.72)'
const CLEAR = IS_EVENING ? 'rgba(34,28,22,0)' : 'rgba(255,249,240,0)'
const FOG_FROM_RIGHT = [CLEAR, FOG_SOFT, FOG] as const
const FOG_FROM_RIGHT_STOPS = [0, 0.62, 1] as const
const FOG_FROM_LEFT = [FOG, FOG_SOFT, CLEAR] as const
const FOG_FROM_LEFT_STOPS = [0, 0.38, 1] as const

type FogProps = {
  index: number
  width: number
  widthSv: SharedValue<number>
  position: SharedValue<number>
  blur: boolean
  reduced: boolean
}

function Fog({ index, width, widthSv, position, blur, reduced }: FogProps) {
  const haze = useDerivedValue(() => (reduced ? 0 : hazeStrength(position.value, index)))
  // A sheet with nothing to show hands back { opacity: 0 }, equal to what
  // it handed back last frame, and Reanimated sends nothing native for it.
  // With its place and width in there too, all eight sheets of the four
  // pages were re-sent on every frame of every swipe — the width, a layout
  // prop, with them. The width is the page's, and sits in the static style.
  const fromRight = useAnimatedStyle(() => {
    const h = haze.value
    if (h <= 0 || seamSide(position.value, index) !== 1) return { opacity: 0 }
    const { translateX, scaleX } = fogSheet(h, 1, widthSv.value)
    return { opacity: 1, transform: [{ translateX }, { scaleX }] }
  })
  const fromLeft = useAnimatedStyle(() => {
    const h = haze.value
    if (h <= 0 || seamSide(position.value, index) !== -1) return { opacity: 0 }
    const { translateX, scaleX } = fogSheet(h, -1, widthSv.value)
    return { opacity: 1, transform: [{ translateX }, { scaleX }] }
  })
  return (
    <View
      style={styles.fog}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {blur && glassTabBarAvailable ? <Frost progress={haze} intensity={HAZE_BLUR} /> : null}
      <Animated.View style={[styles.sheet, { width }, fromRight]}>
        <LinearGradient
          colors={FOG_FROM_RIGHT}
          locations={FOG_FROM_RIGHT_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.sheet, { width }, fromLeft]}>
        <LinearGradient
          colors={FOG_FROM_LEFT}
          locations={FOG_FROM_LEFT_STOPS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // The ground is the fog's own colour: whatever shows between or beyond
  // the pages — a hairline at the join, the bounce past a mark — is fog.
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: FOG },
  row: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  page: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    // The fog sheets are wider than the page and slide across it; nothing
    // of them may reach the page next door.
    overflow: 'hidden',
  },
  fog: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
})
