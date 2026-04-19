import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  ImageBackground,
  useWindowDimensions,
  StyleSheet,
} from 'react-native'
import Animated, { LinearTransition } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { LoyaltyCard } from '@/components/account/LoyaltyCard'
import { HeroCarousel } from '@/components/home/HeroCarousel'
import { WelcomeDiscountBanner } from '@/components/home/WelcomeDiscountBanner'
import { MiniCartBar } from '@/components/cart/MiniCartBar'
import { BRAND } from '@/lib/constants'
import type { LoyaltyAccount } from '@/types/square'

const BANNER_ASPECT = 4608 / 3712
const CARD_OVERLAP = 56

// Zero-balance fallback for newly-signed-up users whose Square loyalty
// account hasn't materialised yet (gets created on first purchase).
const EMPTY_LOYALTY: LoyaltyAccount = {
  id: '',
  balance: 0,
  lifetimePoints: 0,
}

export default function HomeScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const bannerHeight = width / BANNER_ASPECT
  const { profile, loyalty, starsPerReward, loading } = useAuth()

  const signedIn = !!profile
  const account: LoyaltyAccount | null = loyalty
    ? { id: loyalty.accountId, balance: loyalty.balance, lifetimePoints: loyalty.lifetimePoints }
    : null

  if (loading && !profile) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2E8DF' }}>
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

      <View style={{ marginTop: -CARD_OVERLAP }}>
        <WelcomeDiscountBanner />
        <Animated.View style={styles.overlapWrap} layout={LinearTransition.duration(260)}>
          {!signedIn ? (
            <ImageBackground
              source={require('@/assets/images/hero-banner-signed-out.webp')}
              style={styles.signInCard}
              imageStyle={styles.signInCardImage}
              resizeMode="cover"
            >
              <View style={styles.signInCta}>
                <Text style={styles.signInPitch}>First order 30% Off</Text>
                <TouchableOpacity
                  style={styles.loginBtn}
                  onPress={() => router.push('/account')}
                >
                  <Text style={styles.loginText}>Sign in</Text>
                </TouchableOpacity>
              </View>
            </ImageBackground>
          ) : (
            <LoyaltyCard
              account={account ?? EMPTY_LOYALTY}
              starsPerReward={starsPerReward}
            />
          )}
        </Animated.View>
      </View>

      <HeroCarousel />
    </ScrollView>
    <MiniCartBar />
    </View>
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
  signInCard: {
    borderRadius: 16,
    marginHorizontal: 16,
    overflow: 'hidden',
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(141,85,36,0.35)',
    shadowColor: '#5a3510',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  signInCardImage: {
    borderRadius: 16,
  },
  signInCta: {
    alignItems: 'flex-start',
    gap: 8,
  },
  signInPitch: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
