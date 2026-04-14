import { useEffect, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { BRAND, LOYALTY } from '@/lib/constants'
import { useLoyalty } from '@/hooks/use-loyalty'
import type { CartItem } from '@/types/square'

const PHONE_KEY = 'mbt:account:phone'

const STORE_LAT = -27.9673
const STORE_LNG = 153.4145
const STORE_LABEL = "Mandy's Bubble Tea"
const STORE_ADDRESS = '34 Davenport St, Southport QLD 4215'

// Compute OSM tile coords for store location at zoom 16
const MAP_ZOOM = 16
const n = Math.pow(2, MAP_ZOOM)
const centerX = Math.floor(((STORE_LNG + 180) / 360) * n)
const latRad = (STORE_LAT * Math.PI) / 180
const centerY = Math.floor(
  ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
)
const tileUrl = (x: number, y: number) =>
  `https://basemaps.cartocdn.com/rastertiles/voyager/${MAP_ZOOM}/${x}/${y}@2x.png`

function openMapsNavigation() {
  const url = Platform.select({
    ios: `maps:?daddr=${STORE_LAT},${STORE_LNG}&q=${encodeURIComponent(STORE_LABEL)}`,
    android: `google.navigation:q=${STORE_LAT},${STORE_LNG}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${STORE_LAT},${STORE_LNG}`,
  })
  Linking.openURL(url)
}

function formatNow(): string {
  const d = new Date()
  return d.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export default function OrderConfirmationScreen() {
  const router = useRouter()
  const { orderId, loyaltyAccrued } = useLocalSearchParams<{
    orderId: string
    loyaltyAccrued: string
    total: string
  }>()

  const [orderItems, setOrderItems] = useState<CartItem[]>([])
  const [phone, setPhone] = useState<string | null>(null)
  const { account } = useLoyalty(phone)

  const pickupNumber = orderId
    ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0')
    : '#000'

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    AsyncStorage.getItem('mbt:lastOrder:items').then((raw) => {
      if (raw) {
        try {
          setOrderItems(JSON.parse(raw))
        } catch { /* noop */ }
      }
    })

    AsyncStorage.getItem(PHONE_KEY).then((p) => {
      if (p) setPhone(p)
    })
  }, [])

  const starsEarned = loyaltyAccrued === '1' ? orderItems.reduce((sum, i) => sum + i.quantity, 0) : 0
  const currentBalance = account?.balance ?? 0
  const starsToGo = Math.max(0, LOYALTY.starsForReward - currentBalance)
  const progressRatio = Math.min(currentBalance / LOYALTY.starsForReward, 1)

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Status icon (matches order-detail COMPLETED style) */}
      <View style={[styles.iconCircle, { backgroundColor: '#6b9e6f' }]}>
        <Ionicons name="checkmark" size={36} color="#fff" />
      </View>

      <Text style={[styles.title, { color: '#2e5e2e' }]}>Ready for Pickup Soon!</Text>
      <Text style={styles.subtitle}>
        Our tea masters are crafting your order. We'll have it ready for you at
        the counter shortly.
      </Text>

      {/* Pickup number card */}
      <View style={styles.pickupCard}>
        <Text style={styles.pickupLabel}>YOUR PICKUP NUMBER</Text>
        <Text style={styles.pickupNumber}>{pickupNumber}</Text>
      </View>

      {/* Info row: date + estimated pickup time */}
      <View style={styles.infoRow}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>DATE</Text>
          <Text style={styles.infoValue}>{formatNow()}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>ESTIMATED PICKUP</Text>
          <Text style={styles.infoValueLarge}>15–20 mins</Text>
        </View>
      </View>

      {/* Map card */}
      <TouchableOpacity
        style={styles.mapCard}
        onPress={openMapsNavigation}
        activeOpacity={0.8}
      >
        <View style={styles.mapImageWrap}>
          {[0, 1].map((row) => (
            <View key={row} style={styles.tileRow}>
              {[-1, 0, 1].map((col) => (
                <Image
                  key={col}
                  source={{ uri: tileUrl(centerX + col, centerY + row) }}
                  style={styles.tile}
                />
              ))}
            </View>
          ))}
          <View style={styles.mapPinOverlay}>
            <Ionicons name="location" size={30} color={BRAND.color} />
          </View>
        </View>
        <View style={styles.mapOverlay}>
          <Ionicons name="location" size={20} color={BRAND.color} />
          <View style={styles.mapTextWrap}>
            <Text style={styles.mapStoreName}>{STORE_LABEL}</Text>
            <Text style={styles.mapAddress}>{STORE_ADDRESS}</Text>
          </View>
          <Ionicons name="navigate-outline" size={20} color={BRAND.color} />
        </View>
      </TouchableOpacity>

      {/* Loyalty stars banner */}
      {starsEarned > 0 && (
        <View style={styles.starsBanner}>
          <View style={styles.starsHeader}>
            <Text style={styles.starsIcon}>⭐</Text>
            <Text style={styles.starsTitle}>Stars Earned: +{starsEarned}</Text>
          </View>
          <Text style={styles.starsProgress}>
            Current Progress: {currentBalance}/{LOYALTY.starsForReward} Stars
          </Text>
          <View style={styles.progressBarRow}>
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${progressRatio * 100}%` }]}
              />
            </View>
            <Text style={styles.starsToGo}>
              {starsToGo > 0 ? `${starsToGo} MORE TO GO` : 'REWARD READY!'}
            </Text>
          </View>
        </View>
      )}

      {/* Order Summary */}
      {orderItems.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryHeading}>Order Summary</Text>
          {orderItems.map((item) => (
            <View key={item.lineId ?? item.variationId} style={styles.summaryRow}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
              ) : (
                <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                  <Text style={{ fontSize: 20 }}>🧋</Text>
                </View>
              )}
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.variationName ? (
                  <Text style={styles.itemVariation}>{item.variationName}</Text>
                ) : null}
                {(item.modifiers ?? []).length > 0 ? (
                  <Text style={styles.itemVariation} numberOfLines={2}>
                    {(item.modifiers ?? []).map((m) => m.name).join(', ')}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.itemQty}>{item.quantity}x</Text>
            </View>
          ))}
        </View>
      )}

      {/* Back to Home */}
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => router.replace('/(tabs)')}
        activeOpacity={0.8}
      >
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#faf8f5' },
  scrollContent: { alignItems: 'center', padding: 24, paddingTop: 60 },

  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  pickupCard: {
    marginTop: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  pickupLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pickupNumber: {
    fontSize: 48,
    fontWeight: '800',
    color: BRAND.color,
  },

  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    width: '100%',
  },
  infoBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#888',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  infoValueLarge: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },

  // Map
  mapCard: {
    marginTop: 16,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  mapImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: '#e8f0e8',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  tileRow: {
    flexDirection: 'row',
    height: 128,
  },
  tile: {
    width: '33.33%',
    height: 128,
  },
  mapPinOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -15,
    marginTop: -30,
  },
  mapOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  mapTextWrap: {
    flex: 1,
  },
  mapStoreName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  mapAddress: {
    fontSize: 12,
    color: '#888',
    marginTop: 1,
  },

  // Loyalty stars banner
  starsBanner: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#a07840',
    borderRadius: 12,
    padding: 16,
  },
  starsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  starsIcon: { fontSize: 18 },
  starsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  starsProgress: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#e8a838',
    borderRadius: 4,
  },
  starsToGo: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Order summary
  summarySection: {
    marginTop: 20,
    width: '100%',
  },
  summaryHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 15, fontWeight: '500' },
  itemVariation: { fontSize: 13, color: '#888' },
  itemQty: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.color,
  },

  // Back to Home
  homeButton: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
})
