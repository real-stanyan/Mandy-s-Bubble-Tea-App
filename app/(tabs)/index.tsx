import { useCallback, useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  useWindowDimensions,
  StyleSheet,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLoyalty } from '@/hooks/use-loyalty'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { BRAND, STORAGE_KEYS } from '@/lib/constants'

const PHONE_KEY = STORAGE_KEYS.phone
const BANNER_ASPECT = 4608 / 3712
const CARD_OVERLAP = 56

export default function HomeScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const bannerHeight = width / BANNER_ASPECT
  const [phone, setPhone] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const { account, loading, refresh } = useLoyalty(phone)

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

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  return (
    <ScrollView
      style={{ backgroundColor: '#F2E8DF' }}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={{ width, height: bannerHeight }}>
        <Image
          source={require('@/assets/images/hero-banner.webp')}
          style={[styles.banner, { width, height: bannerHeight }]}
          resizeMode="cover"
        />
        <View pointerEvents="none" style={styles.bannerFade}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: `rgba(242,232,223,${((i + 1) / 12).toFixed(3)})`,
              }}
            />
          ))}
        </View>
      </View>

      <View style={[styles.overlapWrap, { marginTop: -CARD_OVERLAP }]}>
        {!phone ? (
          <View style={styles.signInCard}>
            <Text style={styles.welcome}>Welcome to {BRAND.name}</Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/account')}
            >
              <Text style={styles.loginText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : loading && !account ? (
          <ActivityIndicator
            size="large"
            color={BRAND.color}
            style={{ marginTop: 40 }}
          />
        ) : account ? (
          <LoyaltyCard account={account} />
        ) : (
          <View style={styles.signInCard}>
            <Text style={styles.muted}>
              No loyalty account found for {phone}
            </Text>
          </View>
        )}
      </View>

      <HeroCarousel height={width} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  scrollContent: { paddingBottom: 40, backgroundColor: '#F2E8DF' },
  banner: { backgroundColor: '#F2E8DF' },
  bannerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  overlapWrap: { paddingHorizontal: 0, marginBottom: 24 },
  welcome: { fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  signInCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginHorizontal: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  loginBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  muted: { color: '#888', fontSize: 15, textAlign: 'center' },
})
