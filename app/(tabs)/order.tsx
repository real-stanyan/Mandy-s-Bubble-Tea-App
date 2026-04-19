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
import { Ionicons } from '@expo/vector-icons'
import { useFocusEffect, useRouter } from 'expo-router'
import { OrderHistory } from '@/components/account/OrderHistory'
import { useOrderHistory } from '@/hooks/use-order-history'
import { isUnfinished } from '@/store/orders'
import { useAuth } from '@/components/auth/AuthProvider'
import { BRAND } from '@/lib/constants'

export default function OrderScreen() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { orders, loading, refresh } = useOrderHistory()
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
      refresh()
      // Poll while there's an active order so staff dashboard updates
      // (OPEN → PREPARED → COMPLETED) flow through without the user
      // having to leave and come back to the tab. Stops when no active
      // orders remain.
      if (!hasActiveOrder) return
      const id = setInterval(() => {
        refresh()
      }, 10_000)
      return () => clearInterval(id)
    }, [profile, refresh, hasActiveOrder]),
  )

  const onPullRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Sign in to view your orders</Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.loginText}>Sign in</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (orders.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={BRAND.color} />
        }
      >
        <View style={styles.emptyState}>
          <Ionicons name="receipt-outline" size={40} color="#ccc" />
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.emptySubtitle}>
            Your orders will show up here once you place one.
          </Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={BRAND.color} />
      }
    >
      <OrderHistory orders={activeOrders} title="In Progress" hideIfEmpty />
      <OrderHistory orders={pastOrders} title="Past Orders" hideIfEmpty />
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 },
  scrollContent: { paddingBottom: 40 },
  muted: { color: '#888', fontSize: 15, textAlign: 'center' },
  loginBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#333' },
  emptySubtitle: { fontSize: 14, color: '#888', textAlign: 'center' },
})
