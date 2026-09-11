import { useContext, useEffect, useRef } from 'react'
import { Dimensions, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type DerivedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { Frost, frostAvailable } from '@/components/ui/GlassTabBar'
import { DockGlow } from '@/components/ui/DockGlow'
import { CartCapsule, useCartDock } from '@/components/cart/CartCapsule'
import { Icon, type IconName } from '@/components/brand/Icon'
import { SLIDE_MS } from '@/lib/motion/slide'
import { SHRINK_DROP, SHRINK_SCALE, expandChrome, tabBarShrink } from '@/lib/motion/chrome'
import { pillWidth, slotWidth } from '@/lib/motion/cart-dock'
import { haptic } from '@/lib/haptics'
import { CTA, IS_EVENING, clippedShadow } from '@/constants/theme'

// The tab bar as a floating pill of frosted glass — clear paper by day, dark
// glass at night — lifted off the bottom edge with the page scrolling on
// underneath. Icons only; the active one sits in a window nearly the pill's
// own height that slides between tabs (Slide), the home glyph filling in
// when it is the one. Proportions from the Instagram bar (Rick, 2026-09-09):
// height an eighth of the screen width, a twentieth of it clear on each side,
// the window inset four points from the pill's edge.
//
// The pill is one end of the bottom dock (lib/motion/cart-dock). While the
// bag holds anything, the bag capsule (components/cart/CartCapsule) sits at
// the row's right end, the pill's own height and radius, and the pill gives
// up that much of the row: one shared value moves both, so the pill lands
// on its new width as the capsule slides in. Empty, the pill has the row.
//
// Behind both, in the same row so it shrinks with the dock, the light
// (components/ui/DockGlow): a halo along the pill, a pool under the showing
// tab that follows the pages, and a glow behind the capsule.

export const FLOATING_BAR_H = 52
export const FLOATING_BAR_MARGIN = 20
/** Lift off the bottom edge. Where the device reports a home-indicator inset
 *  the pill sits a little inside it (as Instagram does); where there is only
 *  a sliver, well clear of the gesture handle. */
export function floatingBarLift(insetBottom: number): number {
  return Math.max(14, insetBottom - 8)
}
const BAR_PAD = 4
const WINDOW_H = FLOATING_BAR_H - 8
const WINDOW_MAX_W = 78
const SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

/** What content must keep clear of at the bottom: the dock and its lift.
 *  Screens inside the navigator get the same number from
 *  useBottomTabBarHeight; things mounted beside it (the chat launcher) ask
 *  here. */
export function floatingTabBarClearance(insetBottom: number): number {
  return FLOATING_BAR_H + floatingBarLift(insetBottom)
}

const ICONS: Record<string, IconName> = {
  index: 'home',
  menu: 'cafe',
  order: 'receipt',
  account: 'user',
}

// Frosted glass carries a light tint by day and, at night, a warm grey one a
// clear step lighter than the espresso page — the way the Instagram bar sits
// grey on black rather than black on black (Rick, 2026-09-09). Where the
// device cannot blur, the same surfaces go nearly solid so the page does not
// muddy through them.
const BLURRED = frostAvailable(true)
const GLASS = IS_EVENING
  ? BLURRED
    ? 'rgba(58,50,43,0.74)'
    : 'rgba(58,50,43,0.97)'
  : BLURRED
    ? 'rgba(255,249,240,0.58)'
    : 'rgba(255,249,240,0.96)'
const EDGE = IS_EVENING ? 'rgba(245,237,225,0.14)' : 'rgba(42,30,20,0.10)'
const ON = IS_EVENING ? '#F5EDE1' : '#2A1E14'
const DIM = IS_EVENING ? 'rgba(245,237,225,0.58)' : 'rgba(42,30,20,0.5)'
const WINDOW = IS_EVENING ? 'rgba(245,237,225,0.15)' : 'rgba(42,30,20,0.08)'

/** The row's width before it has been measured: the window less the margins. */
const ROW_W = Dimensions.get('window').width - FLOATING_BAR_MARGIN * 2

type Props = BottomTabBarProps & {
  /** Where the pager is, in pages (components/navigation/SwipeTabs). Given,
   *  the window follows it — under the finger during a swipe, and along the
   *  same travel as the pages after a tap. */
  position?: SharedValue<number>
}

export function FloatingTabBar({ state, descriptors, navigation, insets, position }: Props) {
  const reportHeight = useContext(BottomTabBarHeightCallbackContext)
  useEffect(() => {
    reportHeight?.(floatingTabBarClearance(insets.bottom))
  }, [reportHeight, insets.bottom])

  const count = state.routes.length

  // The dock: the bag capsule and how far in it is. The pill's width and
  // every slot in it follow on the UI thread, so the icons keep their
  // places under the finger while the row rearranges.
  const dock = useCartDock()
  const rowW = useSharedValue(ROW_W)
  const onRowLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    if (w > 0) rowW.value = w
  }
  const barStyle = useAnimatedStyle(() => ({
    width: pillWidth(rowW.value, dock.capsuleW.value, dock.open.value),
  }))
  const slotW = useDerivedValue(() =>
    slotWidth(pillWidth(rowW.value, dock.capsuleW.value, dock.open.value), BAR_PAD, count),
  )

  // Reading down the page shrinks the dock toward its centre and lets it sit
  // a touch lower; scrolling up brings it back (lib/motion/chrome).
  const shrinkStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: tabBarShrink.value * SHRINK_DROP },
      { scale: 1 - (1 - SHRINK_SCALE) * tabBarShrink.value },
    ],
  }))

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: floatingBarLift(insets.bottom) }]}>
      <Animated.View style={[styles.row, shrinkStyle]} onLayout={onRowLayout} pointerEvents="box-none">
        <DockGlow
          rowW={rowW}
          rowW0={ROW_W}
          dock={dock}
          slotW={slotW}
          position={position}
          index={state.index}
          count={count}
          height={FLOATING_BAR_H}
          pad={BAR_PAD}
        />
        <Animated.View style={[styles.bar, barStyle]}>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Frost small intensity={IS_EVENING ? 60 : 50} />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]} />
          </View>
          <SlidingWindow index={state.index} slotW={slotW} position={position} />
          {state.routes.map((route, i) => {
            const focused = state.index === i
            const { options } = descriptors[route.key]
            const label =
              options.tabBarAccessibilityLabel ??
              (typeof options.title === 'string' ? options.title : route.name)
            const badge = options.tabBarBadge
            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!focused && !event.defaultPrevented) {
                haptic.pick()
                // A fresh tab starts with the dock whole.
                expandChrome()
                navigation.navigate(route.name, route.params)
              }
            }
            const onLongPress = () => {
              navigation.emit({ type: 'tabLongPress', target: route.key })
            }
            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                testID={options.tabBarButtonTestID}
                style={styles.tab}
                hitSlop={{ top: 8, bottom: 8 }}
              >
                <View>
                  <Icon
                    name={ICONS[route.name] ?? 'home'}
                    size={22}
                    color={focused ? ON : DIM}
                    filled={focused}
                  />
                  {badge != null && badge !== 0 && badge !== '' ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText} numberOfLines={1}>
                        {String(badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            )
          })}
        </Animated.View>
        <CartCapsule dock={dock} />
      </Animated.View>
    </View>
  )
}

// The window behind the active icon: centred in its slot, capped so four
// tabs on a wide phone do not turn it into a bar of its own. The slot is a
// value on the UI thread — it narrows as the capsule comes in — and the
// window keeps to it frame by frame. With a pager position it simply sits
// where the pages are — a swipe drags it along under the finger, a tap
// moves it on the same curve as the pages. Without one, first placement
// is instant and later ones Slide; Reduce Motion keeps every placement
// instant.
function SlidingWindow({
  index,
  slotW,
  position,
}: {
  index: number
  slotW: DerivedValue<number>
  position?: SharedValue<number>
}) {
  const reduced = useReducedMotion()
  const x = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (position) return
    const slot = slotW.value
    if (slot <= 0) return
    const w = Math.min(WINDOW_MAX_W, Math.max(0, slot - 8))
    const target = BAR_PAD + index * slot + (slot - w) / 2
    if (!placed.current || reduced) {
      x.value = target
      shown.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(target, SLIDE)
  }, [index, reduced, position, slotW, x, shown])
  const style = useAnimatedStyle(() => {
    const slot = slotW.value
    const w = Math.min(WINDOW_MAX_W, Math.max(0, slot - 8))
    if (position) {
      return {
        width: w,
        opacity: slot > 0 ? 1 : 0,
        transform: [{ translateX: BAR_PAD + position.value * slot + (slot - w) / 2 }],
      }
    }
    return {
      width: w,
      opacity: shown.value,
      transform: [{ translateX: x.value }],
    }
  })
  return <Animated.View pointerEvents="none" style={[styles.window, style]} />
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'stretch',
  },
  // The dock: the pill from the left, the capsule against the right edge.
  row: {
    marginHorizontal: FLOATING_BAR_MARGIN,
    height: FLOATING_BAR_H,
  },
  bar: {
    height: FLOATING_BAR_H,
    paddingHorizontal: BAR_PAD,
    borderRadius: FLOATING_BAR_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: EDGE,
    // The pill clips (the window slides inside it), so on iOS a shadow of
    // its own could never show; only Android's elevation does.
    ...clippedShadow(8),
  },
  window: {
    position: 'absolute',
    left: 0,
    top: (FLOATING_BAR_H - WINDOW_H) / 2,
    height: WINDOW_H,
    borderRadius: WINDOW_H / 2,
    backgroundColor: WINDOW,
  },
  tab: {
    flex: 1,
    height: FLOATING_BAR_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: CTA.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    lineHeight: 12,
    color: CTA.on,
  },
})
