import { useContext, useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native'
import { NavigationContext } from '@react-navigation/native'
import { useReducedMotion } from 'react-native-reanimated'
import { launchCovered } from '@/lib/launch'
import { COUNT_UP_MS, countUpFrame } from '@/lib/motion/count-up'

// A number that arrives: ticks from what it last showed (0 on first mount)
// to `value` over 900ms, ease-out. Stars, drinks, rewards. Integers only —
// a balance never reads 5.4 — and Reduce Motion shows the number outright.
// Plain rAF + state: ~50 Text renders per count, nothing a phone notices —
// unless nobody is looking. Under the launch screen, or on a tab page that
// is not in front, the number is shown outright: fifty renders there are
// fifty commits for nothing, and under the launch they land on the frames
// the cup is pouring on.
//
// Layout comes from the FINAL value and never moves while the digits tick:
// an invisible Text sizes the box (and gives the row its baseline), the live
// digits are painted over it. A Text whose content changed every frame inside
// an alignItems: 'baseline' row drifted upward on iOS and ran into the eyebrow
// above it (Stan's phone, 2026-09-06).

/** Whether a count would be seen: not under the launch screen, and on the
 *  screen in front. */
function inView(navigation: { isFocused(): boolean } | undefined): boolean {
  return !launchCovered() && (navigation?.isFocused() ?? true)
}

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
  const navigation = useContext(NavigationContext)
  const target = Number.isFinite(value) ? Math.round(value) : 0
  const shownRef = useRef(reduced || !inView(navigation) ? target : 0)
  const [shown, setShown] = useState(shownRef.current)

  useEffect(() => {
    if (reduced || !inView(navigation)) {
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
  }, [target, durationMs, reduced, navigation])

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
