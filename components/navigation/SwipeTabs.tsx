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
  SEAM_HALF,
  SWIPE_SNAP,
  SWIPE_TRAVEL,
  pageX,
  rubberBand,
  seamStrength,
  seamX,
  settleTarget,
  travelDuration,
} from '@/lib/motion/swipe-tabs'

// The tab navigator as a pager: the four pages sit side by side and a
// horizontal drag anywhere on a page pulls the next one in under the finger,
// Home to Menu to Orders to Account (Rick, 2026-09-11). A tap on the pill
// travels the same way. Between two moving pages rides a frosted seam —
// real blur on a binary that can (iOS with expo-blur), a soft breath of
// paper everywhere else — so the join never reads as a hard cut.
//
// Built on React Navigation's TabRouter, so everything the bottom-tabs
// navigator gave the screens still holds: useFocusEffect, tabPress, deep
// links, the back button returning to Home, useBottomTabBarHeight (the
// pill reports its clearance through the same contexts). Every page is
// rendered, not just the focused one — that is what makes the neighbour
// there to be dragged in. Headers are not drawn: every tab hides its own.
//
// Smoothness is all on the UI thread. The gesture writes one shared value
// (`position`, in pages: 1.4 is Menu with Orders 40% in), the row of pages
// and the seam and the pill window all derive from it; the JS thread hears
// only the haptic ticks and the final commit.

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
 *  touch — a vertical list under it keeps anything shorter or steeper. */
const ACTIVE_X = 16
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

  // A tab press, a deep link, the back button: travel there, sweeping any
  // pages in between past (a tap two tabs over is a longer slide, not a
  // blink). Reduce Motion places the page instead.
  useEffect(() => {
    if (settled.value === index) return
    const pages = index - settled.value
    settled.value = index
    cancelAnimation(position)
    if (reduced) {
      position.value = index
      return
    }
    position.value = withTiming(index, { ...SWIPE_TRAVEL, duration: travelDuration(pages) })
  }, [index, reduced, position, settled])

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

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-ACTIVE_X, ACTIVE_X])
        .failOffsetY([-FAIL_Y, FAIL_Y])
        .onStart(() => {
          cancelAnimation(position)
          startPos.value = position.value
          from.value = settled.value
          hover.value = Math.round(position.value)
          dragging.value = 1
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
          const w = Math.max(1, widthSv.value)
          const v = -e.velocityX / w
          const target = settleTarget(position.value, v, from.value, count)
          dragging.value = 0
          settled.value = target
          if (reduced) position.value = target
          else position.value = withSpring(target, { ...SWIPE_SNAP, velocity: v })
          if (target !== from.value) runOnJS(commit)(target)
        })
        .onFinalize(() => {
          // A drag the system took away mid-way (a native list grabbed the
          // touch) still has to land somewhere.
          if (dragging.value !== 1) return
          dragging.value = 0
          const target = settleTarget(position.value, 0, from.value, count)
          settled.value = target
          if (reduced) position.value = target
          else position.value = withSpring(target, SWIPE_SNAP)
          if (target !== from.value) runOnJS(commit)(target)
        }),
    [count, reduced, commit, tick, mountAround, position, settled, from, startPos, hover, dragging, widthSv],
  )

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pageX(0, position.value, widthSv.value) }],
  }))

  return (
    <View style={styles.root}>
      <BottomTabBarHeightContext.Provider value={tabBarHeight}>
        <GestureDetector gesture={pan}>
          <View style={styles.viewport} onLayout={onLayout}>
            <Animated.View style={[styles.row, { width: width * count }, rowStyle]}>
              {state.routes.map((route, i) => {
                if (!(mountedMask & (1 << i))) return null
                const focused = i === index
                return (
                  <View
                    key={route.key}
                    style={[styles.page, { left: i * width, width }]}
                    pointerEvents={focused ? 'auto' : 'none'}
                    accessibilityElementsHidden={!focused}
                    importantForAccessibility={focused ? 'auto' : 'no-hide-descendants'}
                  >
                    {descriptors[route.key].render()}
                  </View>
                )
              })}
            </Animated.View>
            <Seam position={position} widthSv={widthSv} count={count} reduced={reduced} />
          </View>
        </GestureDetector>
      </BottomTabBarHeightContext.Provider>
      <BottomTabBarHeightCallbackContext.Provider value={setTabBarHeight}>
        {tabBar({ state, descriptors, navigation, insets, position })}
      </BottomTabBarHeightCallbackContext.Provider>
    </View>
  )
}

// The frosted seam: a band astride the join between the two pages in
// motion, nothing while the pager rests. Where the binary can blur, three
// sheets stacked narrower and stronger toward the middle — a blur that
// feathers out instead of stopping at an edge; over them, everywhere, a
// breath of paper (warm grey by night) brightest at the join. Intensity is
// driven, never opacity: alpha on a blur view breaks the effect (Apple).
const BLUR_WIDE = 14
const BLUR_MID = 20
const BLUR_CORE = 26
const VEIL = IS_EVENING
  ? ['rgba(58,50,43,0)', 'rgba(58,50,43,0.5)', 'rgba(58,50,43,0)']
  : ['rgba(255,249,240,0)', 'rgba(255,249,240,0.72)', 'rgba(255,249,240,0)']

type SeamProps = {
  position: SharedValue<number>
  widthSv: SharedValue<number>
  count: number
  reduced: boolean
}

function Seam({ position, widthSv, count, reduced }: SeamProps) {
  const strength = useDerivedValue(() => (reduced ? 0 : seamStrength(position.value, count)))
  const bandStyle = useAnimatedStyle(() => ({
    opacity: strength.value > 0.002 ? 1 : 0,
    transform: [{ translateX: seamX(position.value, widthSv.value) - SEAM_HALF }],
  }))
  const veilStyle = useAnimatedStyle(() => ({ opacity: strength.value }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.seam, bandStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {glassTabBarAvailable ? (
        <>
          <View style={styles.blurWide}>
            <Frost progress={strength} intensity={BLUR_WIDE} />
          </View>
          <View style={styles.blurMid}>
            <Frost progress={strength} intensity={BLUR_MID} />
          </View>
          <View style={styles.blurCore}>
            <Frost progress={strength} intensity={BLUR_CORE} />
          </View>
        </>
      ) : null}
      <Animated.View style={[StyleSheet.absoluteFill, veilStyle]}>
        <LinearGradient
          colors={VEIL as [string, string, string]}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </Animated.View>
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
  },
  seam: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: SEAM_HALF * 2,
  },
  blurWide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  blurMid: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SEAM_HALF * 0.45,
    right: SEAM_HALF * 0.45,
  },
  blurCore: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SEAM_HALF * 0.75,
    right: SEAM_HALF * 0.75,
  },
})
