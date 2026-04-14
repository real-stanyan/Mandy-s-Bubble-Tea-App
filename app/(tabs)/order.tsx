import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { OrderHistory } from '@/components/account/OrderHistory'
import { useOrderHistory } from '@/hooks/use-order-history'
import { BRAND, STORAGE_KEYS } from '@/lib/constants'

const PHONE_KEY = STORAGE_KEYS.phone

export default function OrderScreen() {
  const router = useRouter()
  const [phone, setPhone] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { orders, loading, refresh } = useOrderHistory(phone)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(PHONE_KEY).then((saved) => {
      if (saved) setPhone(saved)
      setInitializing(false)
    })
  }, [])

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem(PHONE_KEY).then((saved) => {
        setPhone(saved ?? null)
      })
      if (phone) refresh()
    }, [phone, refresh]),
  )

  const onPullRefresh = async () => {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  if (!phone) {
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

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={BRAND.color} />
      }
    >
      <OrderHistory orders={orders} />
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
})
