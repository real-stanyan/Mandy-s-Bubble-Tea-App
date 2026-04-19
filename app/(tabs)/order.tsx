import { useCallback, useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { useCartStore } from '@/store/cart'
import { isUnfinished, type OrderHistoryItem } from '@/store/orders'
import { useOrderHistory } from '@/hooks/use-order-history'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'
import {
  OrdersFilterPills,
  type OrdersFilter,
} from '@/components/orders/OrdersFilterPills'
import {
  ActiveOrderCard,
} from '@/components/orders/ActiveOrderCard'
import { PastOrderRow } from '@/components/orders/PastOrderRow'
import type { TimelineStatus } from '@/components/orders/StatusTimeline'
import { reorder } from '@/components/orders/reorder'

function timelineStatusFor(order: OrderHistoryItem): TimelineStatus {
  if (order.state === 'OPEN' && order.fulfillmentState === 'PREPARED') {
    return 'READY'
  }
  if (order.state === 'OPEN') {
    return 'PREPARING'
  }
  return 'OPEN'
}

function subtitleText(activeCount: number, pastCount: number): string {
  if (activeCount === 0 && pastCount === 0) return ''
  if (activeCount > 0) {
    return `${activeCount} in progress · ${pastCount} past`
  }
  return `${pastCount} past order${pastCount === 1 ? '' : 's'}`
}

export default function OrderScreen() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const { orders, loading, refresh } = useOrderHistory()
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<OrdersFilter>('all')
  const replaceCart = useCartStore((s) => s.clearCart)
  const addItem = useCartStore((s) => s.addItem)

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

  const handleTrack = useCallback(
    (order: OrderHistoryItem) => {
      router.push({
        pathname: '/order-detail',
        params: {
          orderId: order.id,
          referenceId: order.referenceId ?? '',
          createdAt: order.createdAt ?? '',
          state: order.state ?? '',
          totalCents: order.totalCents,
          itemSummary: order.itemSummary,
          lineCount: String(order.lineCount),
          from: 'orders',
        },
      })
    },
    [router],
  )

  const handleReorder = useCallback(
    (order: OrderHistoryItem) => {
      const result = reorder(replaceCart, addItem, order)
      if (result === 'empty') {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Sign in to view your orders</Text>
        <Pressable
          style={({ pressed }) => [styles.signInBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
      </View>
    )
  }

  if (loading && orders.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={T.brand} />
      </View>
    )
  }

  const showActive = filter === 'all' || filter === 'active'
  const showPast = filter === 'all' || filter === 'past'
  const subtitle = subtitleText(activeOrders.length, pastOrders.length)
  const isCompletelyEmpty = orders.length === 0

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onPullRefresh}
            tintColor={T.brand}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerMain}>
            <Text style={styles.title}>My Orders</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            <Icon name="clock" color={T.ink} size={18} />
          </View>
        </View>

        <OrdersFilterPills
          value={filter}
          activeCount={activeOrders.length}
          onChange={setFilter}
        />

        {isCompletelyEmpty ? (
          <EmptyAllState />
        ) : (
          <>
            {showActive && activeOrders.length > 0 ? (
              <>
                <SectionHead
                  label="In progress"
                  count={`${activeOrders.length} order${activeOrders.length === 1 ? '' : 's'}`}
                />
                {activeOrders.map((order) => (
                  <ActiveOrderCard
                    key={order.id}
                    order={order}
                    status={timelineStatusFor(order)}
                    onTrack={handleTrack}
                  />
                ))}
              </>
            ) : null}

            {showPast ? (
              <>
                <SectionHead label="Past orders" />
                {pastOrders.length > 0 ? (
                  pastOrders.map((order) => (
                    <PastOrderRow
                      key={order.id}
                      order={order}
                      onOpen={handleTrack}
                      onReorder={handleReorder}
                    />
                  ))
                ) : (
                  <EmptyPastState />
                )}
              </>
            ) : null}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

function SectionHead({ label, count }: { label: string; count?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  )
}

function EmptyAllState() {
  return (
    <View style={styles.emptyAll}>
      <View style={styles.emptyIconCircle}>
        <Icon name="receipt" color={T.ink4} size={28} />
      </View>
      <Text style={styles.emptyTitle}>No orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Your orders will show up here once you place one.
      </Text>
    </View>
  )
}

function EmptyPastState() {
  return (
    <View style={styles.emptyPast}>
      <View style={styles.emptyIconCircle}>
        <Icon name="receipt" color={T.ink4} size={24} />
      </View>
      <Text style={styles.emptyTitle}>No past orders yet</Text>
      <Text style={styles.emptySubtitle}>
        Your past orders will show up here.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 56,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
    paddingRight: 12,
  },
  title: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 28,
    letterSpacing: -0.5,
    color: T.ink,
    lineHeight: 32,
  },
  subtitle: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 13,
    color: T.ink3,
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(42,30,20,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    color: T.ink,
    letterSpacing: -0.2,
  },
  sectionCount: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    color: T.ink3,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
    backgroundColor: T.bg,
  },
  muted: {
    fontFamily: FONT.sans,
    color: T.ink3,
    fontSize: 14,
    textAlign: 'center',
  },
  signInBtn: {
    backgroundColor: T.ink,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  signInText: {
    color: '#fff',
    fontFamily: FONT.sans,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyAll: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 40,
  },
  emptyPast: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(42,30,20,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    color: T.ink2,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink3,
    lineHeight: 18,
    textAlign: 'center',
  },
})
