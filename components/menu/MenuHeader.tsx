import type { RefObject } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { Frost, FROST_TINT, glassTabBarAvailable } from '@/components/ui/GlassTabBar'
import { PulseDot } from '@/components/ui/PulseDot'
import { Icon } from '@/components/brand/Icon'
import { CategoryRail, RAIL_H } from '@/components/menu/CategoryRail'
import { haptic } from '@/lib/haptics'
import { T, TYPE, RADIUS } from '@/constants/theme'

// The menu's head, floating over the grid. Three bands:
//   the row    — eyebrow + open/closed pill; once docked, the small "Menu"
//                and a search button take the eyebrow's place
//   the block  — the big title and the search field; folds away as the list
//                scrolls (height → 0, drifting up a little as it goes)
//   the rail   — category pills, always there, always at the bottom edge
// Ground: transparent at rest so the page shows through, frosting up into
// paper as the block folds — the same sheet as the tab bar where the binary
// can blur, solid paper where it cannot. Docking and undocking each give one
// soft tap under the finger.

export const HEADER_ROW_H = 44
/** Title (46) + gap (10) + search (44) + breathing room (12). */
export const HEADER_BLOCK_H = 112
/** Scroll distance over which the block folds — its own height, so the
 *  content underneath moves exactly as far as the header shrinks. */
export const HEADER_RANGE = HEADER_BLOCK_H

export function headerHeights(insetTop: number) {
  const collapsed = insetTop + HEADER_ROW_H + RAIL_H
  return { expanded: collapsed + HEADER_BLOCK_H, collapsed }
}

type Props = {
  scrollY: SharedValue<number>
  insetTop: number
  open: boolean
  statusLabel: string
  query: string
  onQueryChange: (q: string) => void
  drinkCount: number
  inputRef: RefObject<TextInput | null>
  /** The docked search button: bring the field back and focus it. */
  onSearchTap: () => void
  categories: { id: string; name: string }[]
  activeId: string | null
  onTabPress: (id: string) => void
}

export function MenuHeader({
  scrollY,
  insetTop,
  open,
  statusLabel,
  query,
  onQueryChange,
  drinkCount,
  inputRef,
  onSearchTap,
  categories,
  activeId,
  onTabPress,
}: Props) {
  const searching = query.trim().length > 0

  // One soft tap as the head docks, one as it lets go.
  useAnimatedReaction(
    () => scrollY.value >= HEADER_RANGE - 6,
    (docked, prev) => {
      if (prev !== null && docked !== prev) runOnJS(haptic.dock)()
    },
    [],
  )

  const blockStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, HEADER_RANGE], [HEADER_BLOCK_H, 0], Extrapolation.CLAMP),
    opacity: interpolate(scrollY.value, [0, HEADER_RANGE * 0.55], [1, 0], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [0, HEADER_RANGE], [0, -18], Extrapolation.CLAMP) },
    ],
  }))
  const eyebrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HEADER_RANGE * 0.4], [1, 0], Extrapolation.CLAMP),
  }))
  const dockedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HEADER_RANGE * 0.45, HEADER_RANGE], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(scrollY.value, [HEADER_RANGE * 0.45, HEADER_RANGE], [8, 0], Extrapolation.CLAMP) },
    ],
  }))
  const groundStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, HEADER_RANGE], [0, 1], Extrapolation.CLAMP),
  }))
  const hairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [HEADER_RANGE * 0.8, HEADER_RANGE], [0, 1], Extrapolation.CLAMP),
  }))

  return (
    <View style={[styles.wrap, { paddingTop: insetTop }]} pointerEvents="box-none">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Frost />
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: glassTabBarAvailable ? FROST_TINT : T.paper },
            groundStyle,
          ]}
        />
        <Animated.View style={[styles.hairline, hairlineStyle]} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <Animated.Text style={[styles.eyebrow, eyebrowStyle]} numberOfLines={1}>
            MANDY&apos;S · SOUTHPORT
          </Animated.Text>
          <Animated.Text style={[styles.dockedTitle, dockedStyle]} numberOfLines={1}>
            Menu
          </Animated.Text>
        </View>
        <View style={styles.rowRight}>
          <View style={[styles.statusPill, !open && styles.statusPillClosed]}>
            <PulseDot color={open ? T.green : T.ink4} size={7} active={open} />
            <Text
              style={[styles.statusText, { color: open ? T.greenDark : T.ink2 }]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          </View>
          <Animated.View style={dockedStyle}>
            <Pressable
              onPress={onSearchTap}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Search drinks"
              style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
            >
              <Icon name="search" color={T.ink} size={18} />
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Animated.View style={[styles.block, blockStyle]}>
        <Text style={styles.title}>Menu</Text>
        <View style={styles.search}>
          <Icon name="search" color={T.ink3} size={18} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={`Search ${drinkCount} drinks`}
            placeholderTextColor={T.ink3}
            value={query}
            onChangeText={onQueryChange}
            returnKeyType="search"
            clearButtonMode="never"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 ? (
            <Pressable
              onPress={() => {
                haptic.tap()
                onQueryChange('')
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.searchClear}
            >
              <Icon name="close" color={T.ink3} size={16} />
            </Pressable>
          ) : null}
        </View>
      </Animated.View>

      <CategoryRail
        categories={categories}
        activeId={activeId}
        onPress={onTabPress}
        dimmed={searching}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.line,
  },
  row: {
    height: HEADER_ROW_H,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    justifyContent: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  eyebrow: {
    ...TYPE.eyebrow,
    color: T.brand,
  },
  dockedTitle: {
    position: 'absolute',
    left: 0,
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.4,
    color: T.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(46,127,82,0.12)',
    flexShrink: 1,
  },
  statusPillClosed: {
    backgroundColor: 'rgba(42,30,20,0.08)',
  },
  statusText: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 12.5,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
  },
  block: {
    overflow: 'hidden',
    paddingHorizontal: 16,
  },
  title: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1,
    color: T.ink,
  },
  search: {
    marginTop: 10,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.tile,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 14,
    color: T.ink,
    paddingVertical: 0,
  },
  searchClear: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
