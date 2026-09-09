import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { SLIDE_MS, slotFor, slotFromLayout, type Slot } from '@/lib/motion/slide'
import { titleCase } from '@/lib/menu/grid'
import { haptic } from '@/lib/haptics'
import { T, CTA, RADIUS } from '@/constants/theme'

// The category rail: one row of names under the header, and one brand pill
// that travels to whichever is active (Slide) — the names never repaint
// themselves. The pill is a window: it carries a second, cream copy of the
// whole row of names, counter-translated, so the name under it turns cream
// exactly as far as the pill has reached and never a frame early. Tapping
// picks; scrolling the menu moves the pill along, and the rail scrolls itself
// so the active name is never off the edge.

export const RAIL_H = 48
const RAIL_PAD = 16
const RAIL_GAP = 2
const PILL_H = 34
const SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

type Category = { id: string; name: string }

type Props = {
  categories: Category[]
  activeId: string | null
  onPress: (id: string) => void
  /** Search is on: the rail stays put but goes quiet and inert. */
  dimmed?: boolean
}

export function CategoryRail({ categories, activeId, onPress, dimmed = false }: Props) {
  const scrollRef = useRef<ScrollView>(null)
  const [slots, setSlots] = useState<Record<string, Slot>>({})
  const [railW, setRailW] = useState(0)
  const slot = slotFor(slots, activeId)

  const measure = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      const next = slotFromLayout(e.nativeEvent.layout)
      setSlots((prev) => {
        const cur = prev[id]
        if (cur && cur.x === next.x && cur.width === next.width) return prev
        return { ...prev, [id]: next }
      })
    },
    [],
  )

  // Keep the active name in view: centre it when there is room to.
  useEffect(() => {
    if (!slot || railW === 0) return
    const x = Math.max(0, slot.x + slot.width / 2 - railW / 2)
    scrollRef.current?.scrollTo({ x, animated: true })
  }, [slot?.x, slot?.width, railW]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View
      style={[styles.rail, dimmed && styles.railDimmed]}
      pointerEvents={dimmed ? 'none' : 'auto'}
      onLayout={(e) => setRailW(e.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {categories.map((c) => (
          <Pressable
            key={c.id}
            onLayout={measure(c.id)}
            onPress={() => {
              haptic.pick()
              onPress(c.id)
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: c.id === activeId }}
            style={styles.tab}
            hitSlop={{ top: 6, bottom: 6 }}
          >
            <Text style={styles.label} numberOfLines={1}>
              {titleCase(c.name)}
            </Text>
          </Pressable>
        ))}
        <SlidingPill slot={slot} categories={categories} />
      </ScrollView>
    </View>
  )
}

// The one pill, over the names, showing the cream copy through its window.
// First placement is instant; Reduce Motion keeps every placement that way.
function SlidingPill({ slot, categories }: { slot: Slot | null; categories: Category[] }) {
  const reduced = useReducedMotion()
  const x = useSharedValue(0)
  const w = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (!slot) return
    if (!placed.current || reduced) {
      x.value = slot.x
      w.value = slot.width
      shown.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(slot.x, SLIDE)
    w.value = withTiming(slot.width, SLIDE)
  }, [slot?.x, slot?.width, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  const pillStyle = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: w.value,
    transform: [{ translateX: x.value }],
  }))
  // The copy sits where the real row sits, so the pill has to undo its own
  // travel for the names to line up underneath.
  const copyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -x.value }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]}>
      <Animated.View style={[styles.copyRow, copyStyle]}>
        {categories.map((c) => (
          <View key={c.id} style={styles.tab}>
            <Text style={[styles.label, styles.labelOn]} numberOfLines={1}>
              {titleCase(c.name)}
            </Text>
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  rail: {
    height: RAIL_H,
    justifyContent: 'center',
  },
  railDimmed: {
    opacity: 0.35,
  },
  content: {
    paddingHorizontal: RAIL_PAD,
    alignItems: 'center',
    gap: RAIL_GAP,
  },
  tab: {
    height: PILL_H,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  label: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 13,
    color: T.ink2,
  },
  labelOn: {
    color: CTA.on,
  },
  pill: {
    position: 'absolute',
    left: 0,
    top: (RAIL_H - PILL_H) / 2,
    height: PILL_H,
    borderRadius: RADIUS.pill,
    backgroundColor: CTA.bg,
    overflow: 'hidden',
  },
  // Laid out exactly like the scroll content (same padding, same gap), so
  // name i in the copy lands on name i in the row.
  copyRow: {
    position: 'absolute',
    left: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: RAIL_PAD,
    gap: RAIL_GAP,
  },
})
