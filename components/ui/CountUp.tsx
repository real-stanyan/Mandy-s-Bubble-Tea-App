import { useEffect, useRef, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useReducedMotion } from 'react-native-reanimated'
import { COUNT_UP_MS, countUpFrame } from '@/lib/motion/count-up'

// A number that arrives: ticks from what it last showed (0 on first mount)
// to `value` over 900ms, ease-out. Stars, drinks, rewards. Integers only —
// a balance never reads 5.4 — and Reduce Motion shows the number outright.
// Plain rAF + state: ~50 Text renders per count, nothing a phone notices,
// and no bridge dance to put an animated value into a <Text>.

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

  const label = format ? format(target) : String(target)
  return (
    <Text style={style} numberOfLines={numberOfLines} accessibilityLabel={label}>
      {format ? format(shown) : shown}
    </Text>
  )
}
