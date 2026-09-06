import { useEffect, useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Icon } from '@/components/brand/Icon'
import { ToppingGlyph } from '@/components/menu/ToppingGlyph'
import { T, TYPE } from '@/constants/theme'
import { formatPrice } from '@/lib/utils'
import type { ToppingIdentity } from '@/lib/menu/topping-identity'

// One topping, as a tile: its own glyph, its own colour on the border and
// a wash of it behind when picked, a texture tag, the price — and the
// price gives way to a stepper once it is in the cup. When it cannot be
// picked the tile dims and says why (sold out, the three-topping cap, not
// with Warm), instead of just refusing.

type Props = {
  name: string
  priceCents: number
  identity: ToppingIdentity
  groupLabel: string
  count: number
  /** Top 10 build: this topping is part of the drink and cannot be removed. */
  locked: boolean
  soldOut: boolean
  /** Cannot be added right now (count is 0). */
  disabled: boolean
  disabledReason?: string | null
  supportsStepper: boolean
  canIncrement: boolean
  canDecrement: boolean
  onToggle: () => void
  onIncrement: () => void
  onDecrement: () => void
  /** Show the tag only when the tile isn't already under a group header of the same name. */
  showTag?: boolean
}

/** Blend two hex colours; used for the picked wash (no color-mix in RN). */
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = p(a)
  const [br, bg, bb] = p(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${c(ar!, br!)}${c(ag!, bg!)}${c(ab!, bb!)}`
}

export function ToppingTile({
  name,
  priceCents,
  identity,
  groupLabel,
  count,
  locked,
  soldOut,
  disabled,
  disabledReason,
  supportsStepper,
  canIncrement,
  canDecrement,
  onToggle,
  onIncrement,
  onDecrement,
  showTag = false,
}: Props) {
  const reduced = useReducedMotion()
  const selected = count > 0
  // Once it is in the cup the price gives way to − n +; a locked (Top 10)
  // topping keeps the stepper too, its minus disabled at one by the parent.
  const showStepper = supportsStepper && selected
  const wash = mixHex(T.card, identity.edge, 0.09)

  // Settle: the glyph gives a little bounce when the topping lands in the cup.
  const scale = useSharedValue(1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (!selected || reduced) return
    scale.value = withSequence(
      withTiming(0.88, { duration: 90 }),
      withSpring(1, { damping: 11, stiffness: 260 }),
    )
  }, [selected, reduced, scale])
  const glyphStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  const press = () => {
    if (disabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      return
    }
    Haptics.selectionAsync().catch(() => {})
    onToggle()
  }

  const reason = soldOut ? 'Sold out' : disabled ? disabledReason ?? 'Unavailable' : null

  return (
    <Pressable
      onPress={press}
      // With the stepper showing, the tile itself stops toggling so a stray
      // tap can't empty the cup; a locked topping without a stepper stays put.
      disabled={showStepper || (locked && selected)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${name}, ${formatPrice(priceCents)}${reason ? `, ${reason}` : ''}`}
      style={({ pressed }) => [
        styles.tile,
        selected && { borderColor: identity.edge, backgroundColor: wash },
        disabled && !selected && styles.tileDisabled,
        pressed && !disabled && styles.tilePressed,
      ]}
    >
      {locked ? (
        <View style={[styles.badge, soldOut && styles.badgeSoldOut]}>
          <Text style={[styles.badgeText, soldOut && styles.badgeSoldOutText]}>{soldOut ? 'INCLUDED · SOLD OUT' : 'INCLUDED'}</Text>
        </View>
      ) : (
        <View style={[styles.check, selected && { backgroundColor: identity.edge, borderColor: identity.edge }]}>
          {selected ? <Icon name="check" size={12} color="#fff" /> : null}
        </View>
      )}

      <Animated.View style={[styles.glyph, glyphStyle]}>
        <ToppingGlyph identity={identity} size={44} />
      </Animated.View>

      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>

      <View style={styles.meta}>
        {reason ? (
          <Text style={[styles.reason, soldOut && styles.reasonSoldOut]} numberOfLines={1}>
            {reason}
          </Text>
        ) : showStepper ? (
          <View style={styles.stepper}>
            <Pressable
              onPress={onDecrement}
              disabled={!canDecrement}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Decrease ${name}`}
              style={({ pressed }) => [styles.stepBtn, !canDecrement && { opacity: 0.35 }, pressed && canDecrement && { opacity: 0.5 }]}
            >
              <Text style={styles.stepMinus}>−</Text>
            </Pressable>
            <Text style={styles.stepCount}>{count}</Text>
            <Pressable
              onPress={onIncrement}
              disabled={!canIncrement}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`Increase ${name}`}
              style={({ pressed }) => [styles.stepBtn, !canIncrement && { opacity: 0.35 }, pressed && canIncrement && { opacity: 0.5 }]}
            >
              <Icon name="plus" size={12} color={T.ink} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.price}>{priceCents > 0 ? `+${formatPrice(priceCents)}` : 'Free'}</Text>
        )}
        {showTag ? <Text style={[styles.tag, { color: identity.edge }]}>{groupLabel}</Text> : null}
      </View>
    </Pressable>
  )
}

/** Group header for a run of tiles: a colour dot, the texture, how many are in the cup. */
export function ToppingGroupHead({ label, color, picked }: { label: string; color: string; picked: number }) {
  return (
    <View style={styles.groupHead}>
      <View style={[styles.groupDot, { backgroundColor: color }]} />
      <Text style={styles.groupLabel}>{label}</Text>
      {picked > 0 ? <Text style={styles.groupPicked}>{picked} in the cup</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    width: '48.5%',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.card,
    padding: 12,
    paddingBottom: 10,
    gap: 6,
  },
  tileDisabled: { opacity: 0.45 },
  tilePressed: { transform: [{ scale: 0.97 }] },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(42,30,20,0.08)',
  },
  badgeSoldOut: { backgroundColor: 'rgba(196,58,16,0.12)' },
  badgeText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 8.5, letterSpacing: 0.8, color: T.ink2 },
  badgeSoldOutText: { color: '#B5482A' },
  glyph: { width: 44, height: 44, marginTop: 2 },
  name: { fontFamily: 'ShantellSans_600SemiBold', fontSize: 13.5, lineHeight: 17, color: T.ink, minHeight: 34 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, minHeight: 26 },
  price: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 11.5, color: T.ink3 },
  reason: { fontFamily: 'ShantellSans_600SemiBold', fontSize: 11.5, color: T.ink3, flexShrink: 1 },
  reasonSoldOut: { color: '#B5482A' },
  tag: { ...TYPE.eyebrow, fontSize: 9, letterSpacing: 1 },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 26,
    paddingHorizontal: 4,
    borderRadius: 999,
    backgroundColor: T.bg,
    borderWidth: 1,
    borderColor: T.line,
  },
  stepBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: T.card, alignItems: 'center', justifyContent: 'center' },
  stepMinus: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, lineHeight: 16, color: T.ink },
  stepCount: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 12, color: T.ink, minWidth: 12, textAlign: 'center' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 8 },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupLabel: { ...TYPE.eyebrow, color: T.ink3 },
  groupPicked: { marginLeft: 'auto', fontFamily: 'ShantellSans_500Medium', fontSize: 11, color: T.ink4 },
})
