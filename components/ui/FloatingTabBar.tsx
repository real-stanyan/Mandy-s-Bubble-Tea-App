import { useContext, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from '@react-navigation/bottom-tabs'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Frost, frostAvailable } from '@/components/ui/GlassTabBar'
import { Icon, type IconName } from '@/components/brand/Icon'
import { SLIDE_MS } from '@/lib/motion/slide'
import { haptic } from '@/lib/haptics'
import { CTA, IS_EVENING } from '@/constants/theme'

// The tab bar as a floating pill of frosted glass — clear paper by day, dark
// glass at night — lifted off the bottom edge with the page scrolling on
// underneath. Icons only; the active one sits in a window nearly the pill's
// own height that slides between tabs (Slide), the home glyph filling in
// when it is the one. Proportions from the Instagram bar (Rick, 2026-09-09):
// height an eighth of the screen width, a twentieth of it clear on each side,
// the window inset four points from the pill's edge.

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

/** What content must keep clear of at the bottom: the pill and its lift.
 *  Screens inside the navigator get the same number from
 *  useBottomTabBarHeight; things mounted beside it (the mini cart bar) ask
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

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const reportHeight = useContext(BottomTabBarHeightCallbackContext)
  useEffect(() => {
    reportHeight?.(floatingTabBarClearance(insets.bottom))
  }, [reportHeight, insets.bottom])

  const [barW, setBarW] = useState(0)
  const count = state.routes.length
  const slotW = barW > 0 ? (barW - BAR_PAD * 2) / count : 0

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: floatingBarLift(insets.bottom) }]}>
      <View style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Frost small intensity={IS_EVENING ? 60 : 50} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: GLASS }]} />
        </View>
        <SlidingWindow index={state.index} slotW={slotW} />
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
      </View>
    </View>
  )
}

// The window behind the active icon: centred in its slot, capped so four
// tabs on a wide phone do not turn it into a bar of its own. First placement
// is instant; Reduce Motion keeps every placement that way.
function SlidingWindow({ index, slotW }: { index: number; slotW: number }) {
  const reduced = useReducedMotion()
  const x = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)
  const w = Math.min(WINDOW_MAX_W, Math.max(0, slotW - 8))
  useEffect(() => {
    if (slotW === 0) return
    const target = BAR_PAD + index * slotW + (slotW - w) / 2
    if (!placed.current || reduced) {
      x.value = target
      shown.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(target, SLIDE)
  }, [index, slotW, w, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }],
  }))
  if (slotW === 0) return null
  return <Animated.View pointerEvents="none" style={[styles.window, { width: w }, style]} />
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'stretch',
  },
  bar: {
    marginHorizontal: FLOATING_BAR_MARGIN,
    height: FLOATING_BAR_H,
    paddingHorizontal: BAR_PAD,
    borderRadius: FLOATING_BAR_H / 2,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: EDGE,
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: IS_EVENING ? 0.45 : 0.16,
    shadowRadius: 18,
    elevation: 8,
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

