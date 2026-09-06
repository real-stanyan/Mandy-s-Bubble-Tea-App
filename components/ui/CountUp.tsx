import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { COUNT_UP_MS, countUpFrame } from '@/lib/motion/count-up'

// A number that arrives: ticks from what it last showed (0 on first mount)
// to `value` over 900ms, ease-out. Stars, drinks, rewards. Integers only —
// a balance never reads 5.4 — and Reduce Motion shows the number outright.
// Plain rAF + state: ~50 Text renders per count, nothing a phone notices.
//
// Layout comes from the FINAL value and never moves while the digits tick:
// an invisible Text sizes the box (and gives the row its baseline), the live
// digits are painted over it. A Text whose content changed every frame inside
// an alignItems: 'baseline' row drifted upward on iOS and ran into the eyebrow
// above it (Stan's phone, 2026-09-06).

type Props = {
  value: number
  durationMs?: number
  style?: StyleProp<TextStyle>
  /** Render the number; defaults to String(n). */
  format?: (n: number) => string
  numberOfLines?: number
}

export function CountUp({ value, durationMs = COUNT_UP_MS, style, format, numberOfLines }: Props) {
  const reduced = useReducedMotion()
  const target = Number.isFinite(value) ? Math.round(value) : 0
  const shownRef = useRef(reduced ? target : 0)
  const [shown, setShown] = useState(shownRef.current)

  useEffect(() => {
    if (reduced) {
      shownRef.current = target
      setShown(target)
      return
    }
    const from = shownRef.current
    if (from === target) return
    const t0 = Date.now()
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (Date.now() - t0) / durationMs)
      const v = countUpFrame(from, target, p)
      shownRef.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs, reduced])

  const fmt = format ?? String
  const label = fmt(target)
  return (
    <View accessible accessibilityLabel={label}>
      <Text
        style={[style, styles.ghost]}
        numberOfLines={numberOfLines}
        accessible={false}
        importantForAccessibility="no"
      >
        {label}
      </Text>
      <Text
        style={[style, styles.live]}
        numberOfLines={numberOfLines}
        accessible={false}
        importantForAccessibility="no"
      >
        {fmt(shown)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  ghost: { opacity: 0 },
  live: { ...StyleSheet.absoluteFillObject },
})
