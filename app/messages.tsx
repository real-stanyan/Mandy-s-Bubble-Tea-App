import { useCallback, useMemo, useState } from 'react'
import { ScrollView, Text, View, StyleSheet, RefreshControl } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useOrdersStore } from '@/store/orders'
import { useMessageEvents, type InboxEntry } from '@/hooks/use-message-events'
import { MessageRow } from '@/components/messages/MessageRow'
import { PromoCard } from '@/components/messages/PromoCard'
import { T, TYPE } from '@/constants/theme'
import { brisbaneYMD } from '@/components/home/helpers'

type OrderEntry = Extract<InboxEntry, { kind: 'order' }>

function bucketLabel(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const dYMD = brisbaneYMD(new Date(iso))
  const nowDate = new Date()
  const nowYMD = brisbaneYMD(nowDate)
  if (dYMD.y === nowYMD.y && dYMD.m === nowYMD.m && dYMD.d === nowYMD.d) return 'Today'
  const yesterdayDate = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000)
  const yYMD = brisbaneYMD(yesterdayDate)
  if (dYMD.y === yYMD.y && dYMD.m === yYMD.m && dYMD.d === yYMD.d) return 'Yesterday'
  return 'Earlier'
}

export default function MessagesScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{ from?: string }>()
  const refreshOrders = useOrdersStore((s) => s.refresh)
  const [refreshing, setRefreshing] = useState(false)

  const { promo, orderEntries } = useMessageEvents()

  // Refresh on focus so a brand-new order/state shows up without a manual pull.
  useFocusEffect(
    useCallback(() => {
      refreshOrders()
    }, [refreshOrders]),
  )

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshOrders()
    } finally {
      setRefreshing(false)
    }
  }, [refreshOrders])

  const grouped = useMemo(() => {
    const buckets: Record<'Today' | 'Yesterday' | 'Earlier', OrderEntry[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    }
    for (const e of orderEntries) {
      buckets[bucketLabel(e.timestamp)].push(e)
    }
    return (['Today', 'Yesterday', 'Earlier'] as const)
      .map((label) => ({ label, items: buckets[label] }))
      .filter((b) => b.items.length > 0)
  }, [orderEntries])

  const handleOrderPress = useCallback(
    (entry: OrderEntry) => {
      router.push({
        pathname: '/order-detail',
        params: {
          orderId: entry.orderId,
          referenceId: entry.referenceId ?? '',
          createdAt: entry.timestamp,
          state: entry.state === 'READY' ? 'OPEN' : entry.state,
          totalCents: entry.totalCents,
          itemSummary: '',
          lineCount: String(entry.lineCount),
          from: 'messages',
        },
      })
    },
    [router],
  )

  const handlePromoPress = useCallback(() => {
    router.push('/promotions')
  }, [router])

  const empty = !promo && grouped.length === 0
  // `from` is forwarded by HomeHeader so the Stack header label can swap
  // between "Home" and (if we add other entry points later) "<X>".
  void params.from

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={T.brand} />
      }
    >
      {promo ? <PromoCard entry={promo} onPress={handlePromoPress} /> : null}

      {grouped.map((bucket) => (
        <View key={bucket.label} style={styles.section}>
          <Text style={styles.sectionHead}>{bucket.label}</Text>
          {bucket.items.map((e) => (
            <MessageRow key={e.orderId} entry={e} onPress={() => handleOrderPress(e)} />
          ))}
        </View>
      ))}

      {empty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptyBody}>Place an order to get started.</Text>
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  content: { padding: 20, paddingBottom: 40 },
  section: { marginTop: 8 },
  sectionHead: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginBottom: 8,
    marginTop: 8,
  },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 6 },
  emptyTitle: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 18,
    color: T.ink,
  },
  emptyBody: { ...TYPE.body, fontSize: 13, color: T.ink3 },
})
