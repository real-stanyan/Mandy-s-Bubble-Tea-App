import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useAuth } from '@/components/auth/AuthProvider'
import { FlashPromoCard } from '@/components/account/FlashPromoCard'
import { WelcomeDiscountCard } from '@/components/account/WelcomeDiscountCard'
import { IgFollowPromoCard } from '@/components/account/IgFollowPromoCard'
import {
  AppDownloadDiscountCard,
  useAppDownloadStatus,
  appDownloadAvailable,
} from '@/components/account/AppDownloadDiscountCard'
import {
  TastingPromoCard,
  useTastingPromoStatus,
  tastingPromoAvailable,
} from '@/components/account/TastingPromoCard'
import {
  MysteryCouponCards,
  useMysteryCoupons,
} from '@/components/account/MysteryCouponCards'
import { LOYALTY } from '@/lib/constants'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

export default function PromotionsScreen() {
  const { loyalty, welcomeDiscount, igFollowDiscount, flashPromo, starsPerReward } = useAuth()
  const appDownloadStatus = useAppDownloadStatus()
  const tastingStatus = useTastingPromoStatus()
  const mysteryCoupons = useMysteryCoupons()
  const stars = loyalty?.balance ?? 0
  const perReward = starsPerReward || LOYALTY.starsForReward
  const rewardsCount = perReward > 0 ? Math.floor(stars / perReward) : 0
  const hasAny =
    tastingPromoAvailable(tastingStatus) ||
    flashPromo.available ||
    welcomeDiscount.available ||
    igFollowDiscount.available ||
    appDownloadAvailable(appDownloadStatus) ||
    mysteryCoupons.length > 0 ||
    rewardsCount > 0

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>YOUR REWARDS</Text>

        <TastingPromoCard status={tastingStatus} />

        <FlashPromoCard />

        <WelcomeDiscountCard />

        <AppDownloadDiscountCard status={appDownloadStatus} />

        <IgFollowPromoCard />

        <MysteryCouponCards coupons={mysteryCoupons} />

        {rewardsCount > 0 && (
          <View style={styles.rewardCard}>
            <Text style={styles.rewardBadge}>
              🎉 {rewardsCount} Free Drink{rewardsCount > 1 ? 's' : ''}
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
              Earn {perReward} stars and unlock a free drink of your choice.
            </Text>
          </View>
        )}

        <View style={styles.howItWorks}>
          <Text style={styles.howTitle}>How it works</Text>
          <Text style={styles.howBullet}>☕ Buy any drink = earn 1 star</Text>
          <Text style={styles.howBullet}>
            ⭐ {perReward} stars = 1 free drink of your choice
          </Text>
          <Text style={styles.howBullet}>📱 Show this screen at the counter to redeem</Text>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
  },
  content: { paddingVertical: 16, paddingBottom: 40 },
  sectionLabel: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  rewardCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 18,
    alignItems: 'center',
    gap: 6,
    ...SHADOW.card,
  },
  rewardBadge: {
    ...TYPE.eyebrow,
    fontSize: 12,
    letterSpacing: 1,
    color: T.brand,
  },
  rewardTitle: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
    color: T.ink,
  },
  rewardHint: {
    ...TYPE.body,
    color: T.ink3,
    textAlign: 'center',
  },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    borderRadius: RADIUS.card,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
  },
  emptyHint: {
    ...TYPE.body,
    color: T.ink3,
    textAlign: 'center',
    lineHeight: 18,
  },
  howItWorks: {
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    marginHorizontal: 16,
    marginTop: 4,
    borderRadius: RADIUS.card,
    padding: 16,
    gap: 8,
  },
  howTitle: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
    marginBottom: 4,
  },
  howBullet: {
    ...TYPE.body,
    fontSize: 14,
    lineHeight: 20,
    color: T.ink2,
  },
})
