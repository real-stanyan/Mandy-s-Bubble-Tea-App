import { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import { Icon } from '@/components/brand/Icon'
import { T, FONT, RADIUS, SHADOW } from '@/constants/theme'
import { formatPrice } from '@/lib/utils'

export interface OrderPlacedProps {
  pickupNumber: string
  totalCents: number
  starsEarned: number
  storeName: string
  onTrack: () => void
}

export function OrderPlaced({
  pickupNumber,
  totalCents,
  starsEarned,
  storeName,
  onTrack,
}: OrderPlacedProps) {
  const checkScale = useSharedValue(0.3)
  const overlayOpacity = useSharedValue(0)

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
    overlayOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
    checkScale.value = withSequence(
      withTiming(1.1, { duration: 280, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 14, stiffness: 180 }),
    )
  }, [checkScale, overlayOpacity])

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }))
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }))

  return (
    <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="auto">
      <View style={styles.content}>
        <Animated.View style={[styles.checkBubble, checkStyle, iosSageShadow]}>
          <Icon name="check" size={40} color="#fff" />
        </Animated.View>
        <Text style={styles.eyebrow}>Order placed</Text>
        <Text style={styles.headline}>You’re all set</Text>
        <Text style={styles.body}>
          Order <Text style={styles.bodyMono}>{pickupNumber}</Text> will be ready in ~6 min at Mandy’s — {storeName}.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Total charged</Text>
            <Text style={styles.infoValue}>{formatPrice(totalCents)}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.infoCol}>
            <Text style={styles.infoLabel}>Stars earned</Text>
            <View style={styles.starsRow}>
              <Text style={styles.starsValue}>+{starsEarned}</Text>
              <Icon name="star" size={18} color={T.star} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.ctaWrap}>
        <Pressable onPress={onTrack} style={styles.cta}>
          <Text style={styles.ctaText}>Track my order</Text>
          <Icon name="arrow" size={14} color={T.cream} />
        </Pressable>
      </View>
    </Animated.View>
  )
}

const iosSageShadow = Platform.select({
  ios: {
    shadowColor: SHADOW.successBubble.shadowColor,
    shadowOffset: SHADOW.successBubble.shadowOffset,
    shadowOpacity: SHADOW.successBubble.shadowOpacity,
    shadowRadius: SHADOW.successBubble.shadowRadius,
  },
  android: { elevation: SHADOW.successBubble.elevation },
  default: {},
})

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 80,
    backgroundColor: T.bg,
    flexDirection: 'column',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  checkBubble: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: T.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  headline: {
    marginTop: 6,
    fontFamily: FONT.serif,
    fontSize: 28,
    fontWeight: '500',
    letterSpacing: -0.7,
    color: T.ink,
    lineHeight: 32,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    fontFamily: FONT.sans,
    fontSize: 14,
    lineHeight: 20,
    color: T.ink2,
    textAlign: 'center',
    maxWidth: 280,
  },
  bodyMono: {
    fontFamily: FONT.mono,
    fontWeight: '700',
    color: T.ink,
  },
  infoCard: {
    marginTop: 22,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: RADIUS.card,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  infoCol: {
    alignItems: 'flex-start',
  },
  infoDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: T.line,
  },
  infoLabel: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: T.ink3,
    textTransform: 'uppercase',
  },
  infoValue: {
    marginTop: 3,
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    color: T.ink,
  },
  starsRow: {
    marginTop: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsValue: {
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    color: T.brand,
  },
  ctaWrap: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: 999,
    backgroundColor: T.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ctaText: {
    fontFamily: FONT.sans,
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: T.cream,
  },
})
