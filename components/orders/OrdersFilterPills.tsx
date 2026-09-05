import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { T, FONT, PIN } from '@/constants/theme'
import { SLIDE_MS, slotFor, slotFromLayout, type Slot } from '@/lib/motion/slide'

export type OrdersFilter = 'all' | 'active' | 'past'

interface Pill {
  key: OrdersFilter
  label: string
}

function pills(activeCount: number): Pill[] {
  return [
    { key: 'all', label: 'All' },
    { key: 'active', label: `Active (${activeCount})` },
    { key: 'past', label: 'Past' },
  ]
}

interface Props {
  value: OrdersFilter
  activeCount: number
  onChange: (filter: OrdersFilter) => void
}

const SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

// The dark chip is one view that slides between the pills (Slide), not a
// fill each pill paints for itself. Pills only carry their label; the chip
// underneath goes where the selection is.
export function OrdersFilterPills({ value, activeCount, onChange }: Props) {
  const reduced = useReducedMotion()
  const [slots, setSlots] = useState<Partial<Record<OrdersFilter, Slot>>>({})
  const active = slotFor(slots, value)
  const x = useSharedValue(0)
  const w = useSharedValue(0)
  const h = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)

  useEffect(() => {
    if (!active) return
    if (!placed.current || reduced) {
      // First layout (or Reduce Motion): appear in place, no travel.
      x.value = active.x
      w.value = active.width
      h.value = active.height
      shown.value = 1
      placed.current = true
      return
    }
    x.value = withTiming(active.x, SLIDE)
    w.value = withTiming(active.width, SLIDE)
    h.value = withTiming(active.height, SLIDE)
  }, [active?.x, active?.width, active?.height, reduced]) // eslint-disable-line react-hooks/exhaustive-deps

  const chip = useAnimatedStyle(() => ({
    opacity: shown.value,
    width: w.value,
    height: h.value,
    transform: [{ translateX: x.value }],
  }))

  const measure = (key: OrdersFilter) => (e: LayoutChangeEvent) => {
    const slot = slotFromLayout(e.nativeEvent.layout)
    setSlots((prev) => {
      const cur = prev[key]
      if (cur && cur.x === slot.x && cur.width === slot.width && cur.height === slot.height) return prev
      return { ...prev, [key]: slot }
    })
  }

  return (
    <View style={styles.row}>
      <Animated.View pointerEvents="none" style={[styles.chip, chip]} />
      {pills(activeCount).map((p) => {
        const selected = value === p.key
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            onLayout={measure(p.key)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.pill,
              selected && styles.pillSelected,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.label, { color: selected ? T.cream : T.ink2 }]}>{p.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  chip: {
    position: 'absolute',
    left: 0,
    top: 0,
    borderRadius: 999,
    backgroundColor: PIN.chip,
    borderWidth: 1,
    borderColor: T.ink,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: 'transparent',
  },
  pillSelected: {
    borderColor: 'transparent',
  },
  label: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    fontWeight: '600',
  },
})
