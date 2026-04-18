import { useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLoyalty } from '@/hooks/use-loyalty'
import { useWelcomeDiscountStore } from '@/store/welcomeDiscount'
import { WelcomeDiscountCard } from '@/components/account/WelcomeDiscountCard'
import { BRAND, LOYALTY, STORAGE_KEYS } from '@/lib/constants'

export default function PromotionsScreen() {
  const [phone, setPhone] = useState<string | null>(null)
  const refreshWelcome = useWelcomeDiscountStore((s) => s.refresh)
  const welcomeAvailable = useWelcomeDiscountStore((s) => s.available)
  const { account } = useLoyalty(phone)
  const rewards = account?.availableRewards ?? []

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.phone).then((p) => {
      setPhone(p)
      if (p) refreshWelcome(p)
    })
  }, [refreshWelcome])

  const hasAny = welcomeAvailable || rewards.length > 0

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionLabel}>Your Rewards</Text>

      <WelcomeDiscountCard />

      {rewards.length > 0 && (
        <View style={styles.rewardCard}>
          <Text style={styles.rewardBadge}>
            🎉 {rewards.length} Free Drink{rewards.length > 1 ? 's' : ''}
          </Text>
          <Text style={styles.rewardTitle}>Loyalty Reward</Text>
          <Text style={styles.rewardHint}>
            Show this screen at the counter to redeem
          </Text>
        </View>
      )}

      {!hasAny && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No active promotions</Text>
          <Text style={styles.emptyHint}>
            Earn {LOYALTY.starsForReward} stars and unlock a free drink of your choice.
          </Text>
        </View>
      )}

      <View style={styles.howItWorks}>
        <Text style={styles.howTitle}>How it works</Text>
        <Text style={styles.howBullet}>☕ Buy any drink = earn 1 star</Text>
        <Text style={styles.howBullet}>
          ⭐ {LOYALTY.starsForReward} stars = 1 free drink of your choice
        </Text>
        <Text style={styles.howBullet}>📱 Show this screen at the counter to redeem</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { paddingVertical: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#71717a',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  rewardCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    gap: 6,
  },
  rewardBadge: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.color,
  },
  rewardTitle: { fontSize: 20, fontWeight: '700', color: '#18181b' },
  rewardHint: { fontSize: 13, color: '#555', textAlign: 'center' },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: 16,
    backgroundColor: BRAND.accentColor,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: BRAND.color },
  emptyHint: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    lineHeight: 18,
  },
  howItWorks: {
    backgroundColor: BRAND.accentColor,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  howTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  howBullet: { fontSize: 14, lineHeight: 20 },
})
