import { Pressable, Text, View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Icon } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { InboxEntry } from '@/hooks/use-message-events'

type PromoEntry = Extract<InboxEntry, { kind: 'promo' }>

export function PromoCard({
  entry,
  onPress,
}: {
  entry: PromoEntry
  onPress: () => void
}) {
  const subtitle =
    entry.drinksRemaining > 1
      ? `Use on your next ${entry.drinksRemaining} drinks`
      : 'Tap to view your discount'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      <LinearGradient
        colors={[T.peach, '#FFE6C8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.iconWrap}>
          <Icon name="gift" color={T.brand} size={22} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>{entry.percentage}% off your first order</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Icon name="arrow" color={T.brand} size={18} />
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  wrapPressed: { opacity: 0.85 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: RADIUS.card,
    gap: 12,
    ...SHADOW.card,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...TYPE.bodyStrong, fontSize: 15, color: T.ink },
  subtitle: { ...TYPE.body, fontSize: 13, color: T.ink2 },
})
