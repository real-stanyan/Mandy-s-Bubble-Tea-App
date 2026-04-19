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
import { useFocusEffect } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { useLoyalty } from '@/hooks/use-loyalty'
import { BRAND, LOYALTY } from '@/lib/constants'
import { SignInCard } from '@/components/auth/SignInCard'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { MemberQrCard } from '@/components/account/MemberQrCard'
import { PromotionsCard } from '@/components/account/PromotionsCard'
import { ActivityHistory } from '@/components/account/ActivityHistory'
import { OrderHistory } from '@/components/account/OrderHistory'
import { WelcomeDiscountCard } from '@/components/account/WelcomeDiscountCard'
import { useOrderHistory } from '@/hooks/use-order-history'
import { isUnfinished } from '@/store/orders'
import type { LoyaltyAccount } from '@/types/square'

// Zero-balance fallback used right after signup, before the loyalty account
// materialises on first purchase — keeps the dashboard from dead-ending on
// "No loyalty account found" for a freshly registered customer.
const EMPTY_LOYALTY: LoyaltyAccount = {
  id: '',
  balance: 0,
  lifetimePoints: 0,
}

export default function AccountScreen() {
  const auth = useAuth()
  const { profile, starsPerReward, signOut, refresh: refreshAuth, loading: authLoading } = auth
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
      if (!profile) return
      refreshAuth()
      refreshLoyalty()
      refreshOrders()
      if (!hasActiveOrder) return
      const id = setInterval(() => {
        refreshOrders()
      }, 10_000)
      return () => clearInterval(id)
    }, [profile, refreshAuth, refreshLoyalty, refreshOrders, hasActiveOrder]),
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
  const rewardsCount = perReward > 0 ? Math.floor((account?.balance ?? 0) / perReward) : 0

  if (authLoading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (!profile) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <SignInCard />
        <HowItWorks />
        <StoreInfo />
      </ScrollView>
    )
  }

  if (loyaltyLoading && !account) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
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
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={BRAND.color} />
      }
    >
      <WelcomeDiscountCard />
      <LoyaltyCard
        account={account ?? EMPTY_LOYALTY}
        starsPerReward={perReward}
      />
      <MemberQrCard
        customerId={profile.square_customer_id}
        phoneE164={profile.phone_e164}
      />
      <PromotionsCard rewardsCount={rewardsCount} />
      {orders.length === 0 ? (
        <OrderHistory orders={orders} />
      ) : (
        <>
          <OrderHistory orders={activeOrders} title="In Progress" hideIfEmpty />
          <OrderHistory orders={pastOrders} title="Past Orders" hideIfEmpty />
        </>
      )}
      <ActivityHistory events={events} />
      <StoreInfo />
      <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
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

function StoreInfo() {
  return (
    <View style={styles.storeInfo}>
      <Text style={styles.storeName}>{BRAND.name}</Text>
      <Text style={styles.storeDetail}>{BRAND.address}</Text>
      <Text style={styles.storeDetail}>{BRAND.phone}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrollContent: { paddingBottom: 40 },
  errorText: { color: 'red', fontSize: 16, textAlign: 'center', marginBottom: 12 },
  retryBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontWeight: '600' },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  signOutText: {
    color: '#3f3f46',
    fontSize: 15,
    fontWeight: '500',
  },
  howItWorks: {
    backgroundColor: BRAND.accentColor,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  howTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  howBullet: { fontSize: 14, lineHeight: 20 },
  storeInfo: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
    gap: 4,
  },
  storeName: { fontSize: 16, fontWeight: '600' },
  storeDetail: { fontSize: 14, color: '#888' },
})
