import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Dimensions, StyleSheet, View, type LayoutChangeEvent } from 'react-native'
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
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
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

import { floatingTabBarClearance } from '@/components/ui/FloatingTabBar'
import { Frost, glassTabBarAvailable } from '@/components/ui/GlassTabBar'
import { IS_EVENING } from '@/constants/theme'
import { haptic } from '@/lib/haptics'
import { expandChrome } from '@/lib/motion/chrome'
import {
  HAZE_BLUR,
  SWIPE_SNAP,
  SWIPE_TRAVEL,
  fogSheetX,
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

/** Pages mount in waves: the one on screen, then its neighbours once the
 *  first frame has settled, then the rest — so the first swipe finds the
 *  next page laid out, and the launch does not pay for four at once. */
const NEIGHBOUR_MOUNT_MS = 900
const REST_MOUNT_MS = 2200

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
    const t1 = setTimeout(() => mount(neighbours(first, count)), NEIGHBOUR_MOUNT_MS)
    const t2 = setTimeout(() => mount((1 << count) - 1), REST_MOUNT_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
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
  const begin = useCallback((leaving: number) => {
    setDepartingIndex(leaving)
    setMoving(true)
  }, [])
  const rest = useCallback(() => setMoving(false), [])

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
    position.value = withTiming(
      index,
      { ...SWIPE_TRAVEL, duration: travelDuration(pages) },
      (finished) => {
        if (finished) runOnJS(rest)()
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
        runOnJS(rest)()
      } else {
        position.value = withSpring(
          target,
          { ...SWIPE_SNAP, velocity: snapVelocity(velocity) },
          (finished) => {
            if (finished) runOnJS(rest)()
          },
        )
      }
      if (target !== from.value) runOnJS(commit)(target)
    }
    return Gesture.Pan()
      .activeOffsetX([-ACTIVE_X, ACTIVE_X])
      .failOffsetY([-FAIL_Y, FAIL_Y])
      .onStart(() => {
        cancelAnimation(position)
        startPos.value = position.value
        from.value = settled.value
        hover.value = Math.round(position.value)
        dragging.value = 1
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
  }, [count, reduced, commit, tick, begin, rest, mountAround, position, settled, from, startPos, hover, dragging, widthSv])

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX(0, position.value, widthSv.value) }],
  }))

  return (
    <View style={styles.root}>
      <BottomTabBarHeightContext.Provider value={tabBarHeight}>
        <GestureDetector gesture={pan}>
          <View style={styles.viewport} onLayout={onLayout} pointerEvents={moving ? 'box-only' : 'auto'}>
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
                    {descriptors[route.key].render()}
                  </Page>
                )
              })}
            </Animated.View>
          </View>
        </GestureDetector>
      </BottomTabBarHeightContext.Provider>
      <BottomTabBarHeightCallbackContext.Provider value={setTabBarHeight}>
        {tabBar({ state, descriptors, navigation, insets, position })}
      </BottomTabBarHeightCallbackContext.Provider>
    </View>
  )
}

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
      <Fog index={index} widthSv={widthSv} position={position} blur={blur} reduced={reduced} />
    </Animated.View>
  )
}

// The fog on a page in motion, by its distance from the pager
// (hazeStrength): the page being left fogs over as it goes, the page
// coming in arrives fogged and clears as it lands. Two sheets, each twice
// the page wide and solid on the half nearest one edge, fading over the
// other; the one on the seam side slides in as the haze grows and back
// out as it thins, so the fog always rolls in from, and drains out
// through, the join — a soft front, no edge anywhere, unlike the banded
// seam this replaces (Rick: "like a mosaic"). Under the sheet, where the
// binary can blur, one full-page blur whose intensity follows the same
// haze; it is mounted only while the pager moves and only on the pages
// that can be part of the move, so idle blur views never sit over four
// pages. Intensity is driven, never opacity: alpha on a blur view breaks
// the effect (Apple).
const FOG = IS_EVENING ? 'rgba(58,50,43,0.8)' : 'rgba(255,249,240,0.88)'
const CLEAR = IS_EVENING ? 'rgba(58,50,43,0)' : 'rgba(255,249,240,0)'
const FOG_FROM_RIGHT = [CLEAR, FOG, FOG] as const
const FOG_FROM_LEFT = [FOG, FOG, CLEAR] as const

type FogProps = {
  index: number
  widthSv: SharedValue<number>
  position: SharedValue<number>
  blur: boolean
  reduced: boolean
}

function Fog({ index, widthSv, position, blur, reduced }: FogProps) {
  const haze = useDerivedValue(() => (reduced ? 0 : hazeStrength(position.value, index)))
  const fromRight = useAnimatedStyle(() => {
    const h = haze.value
    const w = widthSv.value
    return {
      width: w * 2,
      opacity: h > 0 && seamSide(position.value, index) === 1 ? 1 : 0,
      transform: [{ translateX: fogSheetX(h, 1, w) }],
    }
  })
  const fromLeft = useAnimatedStyle(() => {
    const h = haze.value
    const w = widthSv.value
    return {
      width: w * 2,
      opacity: h > 0 && seamSide(position.value, index) === -1 ? 1 : 0,
      transform: [{ translateX: fogSheetX(h, -1, w) }],
    }
  })
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {blur && glassTabBarAvailable ? <Frost progress={haze} intensity={HAZE_BLUR} /> : null}
      <Animated.View style={[styles.sheet, fromRight]}>
        <LinearGradient
          colors={FOG_FROM_RIGHT}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[styles.sheet, fromLeft]}>
        <LinearGradient
          colors={FOG_FROM_LEFT}
          locations={[0, 0.5, 1]}
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
  viewport: { flex: 1, overflow: 'hidden' },
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
  sheet: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
})
