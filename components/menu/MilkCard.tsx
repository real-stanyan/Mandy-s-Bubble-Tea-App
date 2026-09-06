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
import { MilkGlyph } from '@/components/menu/MilkGlyph'
import { mixHex } from '@/components/menu/ToppingTile'
import { T } from '@/constants/theme'
import { formatPrice } from '@/lib/utils'
import { MILK_KIND_LABEL, milkDisplayName, type MilkIdentity } from '@/lib/menu/milk-identity'

// One milk, as a card in a horizontal strip: its glyph, its name, the price
// (or "Included"), a check when picked, and a RECOMMENDED ribbon on the
// house default. Single choice, so picking one is a radio, not a toggle —
// the parent moves the selection; a tap on the picked card does nothing.

type CardProps = {
  name: string
  priceCents: number
  identity: MilkIdentity
  selected: boolean
  soldOut: boolean
  /** Cannot be picked right now. */
  disabled: boolean
  onPress: () => void
}

export function MilkCard({ name, priceCents, identity, selected, soldOut, disabled, onPress }: CardProps) {
  const reduced = useReducedMotion()
  const wash = mixHex(T.card, identity.band, 0.12)

  // Settle: the carton gives a little bounce when it becomes the pick.
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
    if (selected) return
    if (disabled) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {})
      return
    }
    Haptics.selectionAsync().catch(() => {})
    onPress()
  }

  const label = milkDisplayName(name)
  const priceText = soldOut ? 'Sold out' : priceCents > 0 ? `+${formatPrice(priceCents)}` : 'Included'

  return (
    <Pressable
      onPress={press}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${label}, ${priceText}${identity.recommended ? ', recommended' : ''}`}
      style={({ pressed }) => [
        styles.card,
        selected && { borderColor: identity.band, backgroundColor: wash },
        disabled && !selected && styles.cardDisabled,
        pressed && !disabled && !selected && styles.cardPressed,
      ]}
    >
      {identity.recommended ? (
        <View style={styles.ribbon}>
          <Text style={styles.ribbonText}>RECOMMENDED</Text>
        </View>
      ) : null}
      <View style={[styles.check, selected && { backgroundColor: identity.band, borderColor: identity.band }]}>
        {selected ? <Icon name="check" size={10} color="#fff" /> : null}
      </View>
      <Animated.View style={[styles.glyph, glyphStyle]}>
        <MilkGlyph identity={identity} size={38} />
      </Animated.View>
      <Text style={styles.name} numberOfLines={2}>
        {label}
      </Text>
      <Text style={[styles.price, soldOut && styles.priceSoldOut]} numberOfLines={1}>
        {priceText}
      </Text>
    </Pressable>
  )
}

/** The picked milk explained: what it is, and what it costs. */
export function MilkDetail({ name, priceCents, identity }: { name: string; priceCents: number; identity: MilkIdentity }) {
  const kind = MILK_KIND_LABEL[identity.kind]
  const blurb = identity.blurb || (kind ? kind : '')
  return (
    <View style={styles.detail} accessibilityLiveRegion="polite">
      <MilkGlyph identity={identity} size={26} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.detailTitle} numberOfLines={1}>
          {milkDisplayName(name)} · {priceCents > 0 ? `+${formatPrice(priceCents)}` : 'Included'}
        </Text>
        {blurb ? (
          <Text style={styles.detailBlurb} numberOfLines={2}>
            {blurb}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    width: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: T.line,
    backgroundColor: T.card,
    paddingTop: 10,
    paddingBottom: 9,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 5,
  },
  cardDisabled: { opacity: 0.45 },
  cardPressed: { transform: [{ scale: 0.96 }] },
  ribbon: {
    position: 'absolute',
    top: -7,
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: T.brand,
  },
  ribbonText: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 8, letterSpacing: 0.8, color: '#fff' },
  check: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { width: 38, height: 38 },
  name: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 12,
    lineHeight: 14,
    color: T.ink,
    textAlign: 'center',
    minHeight: 28,
  },
  price: { fontFamily: 'JetBrainsMono_700Bold', fontSize: 10.5, color: T.ink3 },
  priceSoldOut: { color: '#B5482A' },
  detail: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    backgroundColor: T.bg,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  detailTitle: { fontFamily: 'ShantellSans_600SemiBold', fontSize: 12.5, color: T.ink },
  detailBlurb: { fontFamily: 'ShantellSans_400Regular', fontSize: 11.5, lineHeight: 15, color: T.ink3, marginTop: 1 },
})
