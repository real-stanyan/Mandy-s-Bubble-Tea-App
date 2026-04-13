import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLoyalty } from '@/hooks/use-loyalty'
import { formatAUPhone } from '@/lib/utils'
import { BRAND, LOYALTY, STORAGE_KEYS } from '@/lib/constants'
import { PhoneInput } from '@/components/account/PhoneInput'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { ActivityHistory } from '@/components/account/ActivityHistory'
import { OrderHistory } from '@/components/account/OrderHistory'
import { useOrderHistory } from '@/hooks/use-order-history'

const PHONE_KEY = STORAGE_KEYS.phone

export default function AccountScreen() {
  const [phone, setPhone] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { account, events, loading, error, refresh } = useLoyalty(phone)
  const { orders, loading: ordersLoading } = useOrderHistory(phone)

  useEffect(() => {
    AsyncStorage.getItem(PHONE_KEY).then((saved) => {
      if (saved) setPhone(saved)
      setInitializing(false)
    })
  }, [])

  const handlePhoneSubmit = async (raw: string) => {
    const formatted = formatAUPhone(raw)
    await AsyncStorage.setItem(PHONE_KEY, formatted)
    setPhone(formatted)
  }

  const handleChangeNumber = async () => {
    await AsyncStorage.removeItem(PHONE_KEY)
    setPhone(null)
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <PhoneInput onSubmit={handlePhoneSubmit} loading={loading} />
        <HowItWorks />
        <StoreInfo />
      </ScrollView>
    )
  }

  if (loading && !account) {
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
        <TouchableOpacity onPress={refresh} style={styles.retryBtn}>
          <Text style={styles.retryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!account) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundTitle}>No loyalty account found</Text>
          <Text style={styles.notFoundSubtitle}>
            Visit us in store to start earning stars!
          </Text>
        </View>
        <TouchableOpacity onPress={handleChangeNumber}>
          <Text style={styles.changeNumber}>Try a different number</Text>
        </TouchableOpacity>
        <StoreInfo />
      </ScrollView>
    )
  }

  return (
    <ScrollView>
      <LoyaltyCard account={account} />
      <TouchableOpacity onPress={handleChangeNumber}>
        <Text style={styles.changeNumber}>Use a different number</Text>
      </TouchableOpacity>
      <HowItWorks />
      <OrderHistory orders={orders} />
      <ActivityHistory events={events} />
      <StoreInfo />
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
  changeNumber: {
    color: BRAND.color,
    textAlign: 'center',
    marginTop: 16,
    fontSize: 15,
  },
  notFoundBox: { alignItems: 'center', padding: 24, gap: 8 },
  notFoundTitle: { fontSize: 18, fontWeight: '600' },
  notFoundSubtitle: { fontSize: 15, color: '#888', textAlign: 'center' },
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
