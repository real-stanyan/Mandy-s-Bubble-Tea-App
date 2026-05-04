import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { useLoyalty } from '@/hooks/use-loyalty'
import { LOYALTY } from '@/lib/constants'
import { SignInCard } from '@/components/auth/SignInCard'
import { AccountHeader } from '@/components/account/AccountHeader'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { MiniStats } from '@/components/account/MiniStats'
import { MemberQrCard } from '@/components/account/MemberQrCard'
import { AddToWalletButton } from '@/components/account/AddToWalletButton'
import { PromotionsCard } from '@/components/account/PromotionsCard'
import { ActivityHistory } from '@/components/account/ActivityHistory'
import { OrderHistory } from '@/components/account/OrderHistory'
import { WelcomeDiscountCard } from '@/components/account/WelcomeDiscountCard'
import { ActivePrizes } from '@/components/account/ActivePrizes'
import { StoreInfo } from '@/components/account/StoreInfo'
import { LegalFooter } from '@/components/account/LegalFooter'
import { SignOutBtn } from '@/components/account/SignOutBtn'
import { DeleteAccountBtn } from '@/components/account/DeleteAccountBtn'
import { useOrderHistory } from '@/hooks/use-order-history'
import { isUnfinished } from '@/store/orders'
import { T } from '@/constants/theme'
import type { LoyaltyAccount } from '@/types/square'

const EMPTY_LOYALTY: LoyaltyAccount = {
  id: '',
  balance: 0,
  lifetimePoints: 0,
}

export default function AccountScreen() {
  const auth = useAuth()
  const {
    profile,
    starsPerReward,
    signOut,
    deleteAccount,
    refresh: refreshAuth,
    loading: authLoading,
  } = auth
  const { account, events, loading: loyaltyLoading, error, refresh: refreshLoyalty } = useLoyalty()
  const { orders, refresh: refreshOrders } = useOrderHistory()
  const [refreshing, setRefreshing] = useState(false)

  const { activeOrders, pastOrders } = useMemo(() => {
    const active = orders.filter(isUnfinished)
    const past = orders.filter((o) => !isUnfinished(o))
    return { activeOrders: active, pastOrders: past }
  }, [orders])

  const hasActiveOrder = activeOrders.length > 0
  useFocusEffect(
    useCallback(() => {
      refreshLoyalty()
      refreshOrders()
      if (!hasActiveOrder) return
      const id = setInterval(() => {
        refreshOrders()
      }, 10_000)
      return () => clearInterval(id)
    }, [refreshLoyalty, refreshOrders, hasActiveOrder]),
  )

  const onPullRefresh = async () => {
    setRefreshing(true)
    try {
      await Promise.all([refreshAuth(), refreshLoyalty(), refreshOrders()])
    } finally {
      setRefreshing(false)
    }
  }

  const perReward = starsPerReward || LOYALTY.starsForReward
  const balance = account?.balance ?? 0
  const lifetime = account?.lifetimePoints ?? balance
  const rewardsCount = perReward > 0 ? Math.floor(balance / perReward) : 0
  const currentStars = perReward > 0 ? balance % perReward : 0

  if (authLoading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 56 }]}
          keyboardShouldPersistTaps="handled"
        >
          <SignInCard />
          <HowItWorks />
        </ScrollView>
      </View>
    )
  }

  if (loyaltyLoading && !account) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={refreshLoyalty} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 56, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={T.brand} />
        }
      >
        <AccountHeader profile={profile} />
        <WelcomeDiscountCard />
        <ActivePrizes />
        <LoyaltyCard
          account={account ?? EMPTY_LOYALTY}
          starsPerReward={perReward}
        />
        <MiniStats
          drinks={lifetime}
          rewards={rewardsCount}
          stars={currentStars}
          onPressDrinks={() => router.push('/(tabs)/order')}
          onPressRewards={() => router.push('/promotions')}
        />
        <MemberQrCard
          customerId={profile.square_customer_id}
          phoneE164={profile.phone_e164}
        />
        <AddToWalletButton />
        <PromotionsCard rewardsCount={rewardsCount} />
        {orders.length === 0 ? (
          <OrderHistory orders={orders} />
        ) : (
          <>
            <OrderHistory orders={activeOrders} title="In Progress" hideIfEmpty />
            <OrderHistory
              orders={pastOrders.slice(0, 3)}
              title="Past Orders"
              hideIfEmpty
              onSeeAll={
                pastOrders.length > 3
                  ? () => router.push('/(tabs)/order')
                  : undefined
              }
            />
          </>
        )}
        <ActivityHistory events={events} />
        <StoreInfo />
        <LegalFooter />
        <SignOutBtn onPress={signOut} />
        <DeleteAccountBtn onConfirm={deleteAccount} />
      </ScrollView>
    </View>
  )
}

function HowItWorks() {
  return (
    <View style={styles.howItWorks}>
      <Text style={styles.howTitle}>How it works</Text>
      <Text style={styles.howBullet}>☕ Buy any drink = earn 1 star</Text>
      <Text style={styles.howBullet}>
        ⭐ {LOYALTY.starsForReward} stars = 1 free drink of your choice
      </Text>
      <Text style={styles.howBullet}>📱 Show this screen at the counter to redeem</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: T.bg,
  },
  scrollContent: { paddingBottom: 40 },
  errorText: { color: '#b91c1c', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  howItWorks: {
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  howTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
    marginBottom: 4,
  },
  howBullet: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: T.ink2,
  },
})
