import { useCallback, useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { T, SHADOW } from '@/constants/theme'
import { SLIDE_MS } from '@/lib/motion/slide'
import { nearestIndex } from '@/lib/menu/option-axis'

// Sugar and ice as a slider: one pill on a track of ticks. Tap a tick or
// drag the pill; it follows the finger and snaps to the nearest tick on
// release, ticking the haptics as it crosses each one (Slide + Settle).
// Disabled ticks (Warm while cheese cream is on) are dimmed and skipped.
// The pan only claims a touch once it has moved sideways, so the bottom
// sheet keeps its vertical scroll and pull-to-close.

export type SliderOption = {
  id: string
  /** Tick label ("50%", "Less"). */
  short: string
  /** Full name, read out and shown under the track ("Half Sugar"). */
  name: string
  disabled?: boolean
  /** Why it is off ("Not with Cheese Cream", "Sold out") — shown when someone tries it anyway. */
  disabledReason?: string | null
}

type Props = {
  options: SliderOption[]
  value: string | null
  onChange: (id: string) => void
  accessibilityLabel: string
}

const PAD = 4
const TRACK_H = 44
const SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

export function OptionSlider({ options, value, onChange, accessibilityLabel }: Props) {
  const reduced = useReducedMotion()
  const [trackW, setTrackW] = useState(0)
  const n = Math.max(1, options.length)
  const cell = trackW > 0 ? (trackW - PAD * 2) / n : 0
  const selectedIndex = Math.max(0, options.findIndex((o) => o.id === value))
  const disabledFlags = options.map((o) => !!o.disabled)

  const x = useSharedValue(0)
  const dragging = useSharedValue(0)
  const startX = useSharedValue(0)
  const hover = useSharedValue(-1)
  const placed = useRef(false)

  // The gesture is rebuilt each render, so its worklets capture the current
  // geometry and option list; the JS-side callbacks read the latest props
  // through a ref so a snap that lands after a re-render still selects.
  const latest = useRef({ onChange, options })
  latest.current = { onChange, options }
  const count = options.length

  // A disabled tick that was tapped, or that a drag would have landed on,
  // explains itself for a moment under the track instead of just refusing.
  const [note, setNote] = useState<string | null>(null)
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const explain = useCallback((reason: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
    setNote(reason)
    if (noteTimer.current) clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 2600)
  }, [])
  useEffect(() => () => {
    if (noteTimer.current) clearTimeout(noteTimer.current)
  }, [])

  const select = useCallback(
    (index: number, rawIndex?: number) => {
      const opts = latest.current.options
      if (rawIndex != null && rawIndex !== index) {
        const skipped = opts[rawIndex]
        if (skipped?.disabled) explain(skipped.disabledReason ?? 'Unavailable')
      }
      const o = opts[index]
      if (o && !o.disabled) latest.current.onChange(o.id)
    },
    [explain],
  )
  const tick = useCallback(() => {
    Haptics.selectionAsync().catch(() => {})
  }, [])

  // Settle on the selected tick whenever the selection or the geometry changes.
  useEffect(() => {
    if (cell === 0) return
    const target = selectedIndex * cell
    if (!placed.current || reduced) {
      x.value = target
      placed.current = true
      return
    }
    x.value = withTiming(target, SLIDE)
  }, [selectedIndex, cell, reduced, x])

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-10, 10])
    .onBegin(() => {
      startX.value = x.value
    })
    .onStart(() => {
      dragging.value = 1
      hover.value = Math.round(x.value / Math.max(1, cell))
    })
    .onUpdate((e) => {
      const c = Math.max(1, cell)
      const max = (count - 1) * c
      const next = Math.min(max, Math.max(0, startX.value + e.translationX))
      x.value = next
      const h = Math.round(next / c)
      if (h !== hover.value) {
        hover.value = h
        runOnJS(tick)()
      }
    })
    .onEnd(() => {
      const c = Math.max(1, cell)
      const raw = Math.min(count - 1, Math.max(0, Math.round(x.value / c)))
      const idx = nearestIndex(x.value / c, count, disabledFlags)
      dragging.value = 0
      hover.value = -1
      x.value = withSpring(idx * c, { damping: 18, stiffness: 260 })
      runOnJS(select)(idx, raw)
    })
    .onFinalize(() => {
      dragging.value = 0
      hover.value = -1
    })

  const pillStyle = useAnimatedStyle(() => ({
    width: cell,
    transform: [{ translateX: x.value }, { scale: dragging.value ? 1.04 : 1 }],
    opacity: cell > 0 ? 1 : 0,
  }))

  const onLayout = (e: LayoutChangeEvent) => setTrackW(e.nativeEvent.layout.width)
  const current = options[selectedIndex]

  return (
    <View style={styles.wrap} accessibilityRole="adjustable" accessibilityLabel={accessibilityLabel} accessibilityValue={{ text: current?.name }}>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout}>
          <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
          {options.map((o, i) => {
            const selected = i === selectedIndex
            return (
              <Pressable
                key={o.id}
                onPress={() => {
                  if (o.disabled) {
                    explain(o.disabledReason ?? 'Unavailable')
                    return
                  }
                  if (selected) return
                  Haptics.selectionAsync().catch(() => {})
                  onChange(o.id)
                }}
                accessibilityRole="button"
                accessibilityLabel={o.name}
                accessibilityState={{ selected, disabled: !!o.disabled }}
                style={styles.cellBtn}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.tick,
                    selected && styles.tickSelected,
                    o.disabled && styles.tickDisabled,
                  ]}
                >
                  {o.short}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </GestureDetector>
      <Text style={[styles.caption, note ? styles.captionNote : null]} numberOfLines={1}>
        {note ?? current?.name ?? ''}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  track: {
    height: TRACK_H,
    borderRadius: 999,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.line,
    padding: PAD,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  pill: {
    position: 'absolute',
    left: PAD,
    top: PAD,
    height: TRACK_H - PAD * 2 - 2,
    borderRadius: 999,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.card,
  },
  cellBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tick: { fontFamily: 'ShantellSans_500Medium', fontSize: 12.5, color: T.ink3 },
  tickSelected: { fontFamily: 'ShantellSans_600SemiBold', color: T.ink },
  tickDisabled: { color: T.ink4 },
  caption: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12.5,
    color: T.ink3,
    marginTop: 8,
    marginLeft: 6,
  },
  captionNote: { fontFamily: 'ShantellSans_600SemiBold', color: T.brand },
})
