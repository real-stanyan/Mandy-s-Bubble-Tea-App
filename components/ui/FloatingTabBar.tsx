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
import { Frost, glassTabBarAvailable } from '@/components/ui/GlassTabBar'
import { Icon, type IconName } from '@/components/brand/Icon'
import { SLIDE_MS } from '@/lib/motion/slide'
import { haptic } from '@/lib/haptics'
import { IS_EVENING, T } from '@/constants/theme'

// The tab bar as a floating pill: ink-dark, lifted off the bottom edge, the
// page scrolling on underneath it. Icons only; the active one sits in a
// lighter window that slides between tabs (Slide), the home glyph filling in
// when it is the one. Native blur under the ink where the binary can blur —
// iOS — and a solid pill where it cannot. Rick's reference, 2026-09-09: the
// Instagram bar.

export const FLOATING_BAR_H = 64
/** Lift above the bottom safe inset — clear of the gesture handle on phones
 *  that report only a sliver of inset. */
export const FLOATING_BAR_GAP = 16
export const FLOATING_BAR_MARGIN = 20
const BAR_PAD = 6
const PILL_H = 48
const SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

/** What content must keep clear of at the bottom: the pill, its lift, and
 *  the inset under it. Screens inside the navigator get the same number from
 *  useBottomTabBarHeight; things mounted beside it (the mini cart bar) ask
 *  here. */
export function floatingTabBarClearance(insetBottom: number): number {
  return FLOATING_BAR_H + FLOATING_BAR_GAP + insetBottom
}

const ICONS: Record<string, IconName> = {
  index: 'home',
  menu: 'cafe',
  order: 'receipt',
  account: 'user',
}

// Cream on ink in both themes: the pill is the one deliberately dark surface
// on the day page (PIN's reasoning) and simply the card tone at night.
const BAR_BG = IS_EVENING ? 'rgba(44,37,30,0.94)' : 'rgba(42,30,20,0.92)'
const BAR_BG_SOLID = IS_EVENING ? '#2C251E' : '#2A1E14'
const ON = '#FFF3DE'
const DIM = 'rgba(255,243,222,0.55)'
const WINDOW = 'rgba(255,243,222,0.13)'

export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const reportHeight = useContext(BottomTabBarHeightCallbackContext)
  useEffect(() => {
    reportHeight?.(floatingTabBarClearance(insets.bottom))
  }, [reportHeight, insets.bottom])

  const [barW, setBarW] = useState(0)
  const count = state.routes.length
  const slotW = barW > 0 ? (barW - BAR_PAD * 2) / count : 0

  return (
    <View pointerEvents="box-none" style={[styles.root, { bottom: insets.bottom + FLOATING_BAR_GAP }]}>
      <View style={styles.bar} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Frost />
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: glassTabBarAvailable ? BAR_BG : BAR_BG_SOLID },
            ]}
          />
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
                  size={24}
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

// The lighter window behind the active icon. First placement is instant;
// Reduce Motion keeps every placement that way.
function SlidingWindow({ index, slotW }: { index: number; slotW: number }) {
  const reduced = useReducedMotion()
  const x = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (slotW === 0) return
    const target = BAR_PAD + index * slotW + 4
    if (!placed.current || reduced) {
      x.value = target
      shown.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(target, SLIDE)
  }, [index, slotW, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateX: x.value }],
  }))
  if (slotW === 0) return null
  return (
    <Animated.View pointerEvents="none" style={[styles.window, { width: slotW - 8 }, style]} />
  )
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
    borderColor: 'rgba(255,243,222,0.10)',
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 12,
  },
  window: {
    position: 'absolute',
    left: 0,
    top: (FLOATING_BAR_H - PILL_H) / 2,
    height: PILL_H,
    borderRadius: PILL_H / 2,
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
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: T.star,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    lineHeight: 12,
    color: '#2A1E14',
  },
})
