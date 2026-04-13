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
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { apiFetch } from '@/lib/api'
import type { CatalogItem } from '@/types/square'

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
// Carto CDN tiles (no API key, permissive CORS/UA)
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

const STATE_CONFIG: Record<string, { icon: string; color: string; bgColor: string; title: string; subtitle: string }> = {
  COMPLETED: {
    icon: 'checkmark',
    color: '#2e5e2e',
    bgColor: '#6b9e6f',
    title: 'Order Completed',
    subtitle: 'This order has been picked up. Enjoy your tea!',
  },
  OPEN: {
    icon: 'time-outline',
    color: '#92400e',
    bgColor: '#d97706',
    title: 'Order In Progress',
    subtitle: 'Our tea masters are crafting your order.',
  },
  CANCELED: {
    icon: 'close',
    color: '#991b1b',
    bgColor: '#dc2626',
    title: 'Order Cancelled',
    subtitle: 'This order was cancelled.',
  },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const { orderId, createdAt, state, totalCents, itemSummary, lineCount } =
    useLocalSearchParams<{
      orderId: string
      createdAt: string
      state: string
      totalCents: string
      itemSummary: string
      lineCount: string
    }>()

  // Map product names to image URLs from catalog
  const [imageMap, setImageMap] = useState<Record<string, string>>({})

  useEffect(() => {
    apiFetch<{ items: CatalogItem[] }>('/api/catalog')
      .then((data) => {
        const map: Record<string, string> = {}
        for (const item of data.items ?? []) {
          const name = item.itemData?.name
          if (name && item.imageUrl) {
            map[name] = item.imageUrl
          }
        }
        setImageMap(map)
      })
      .catch(() => {})
  }, [])

  const stateInfo = STATE_CONFIG[state ?? ''] ?? STATE_CONFIG.COMPLETED
  const pickupNumber = orderId
    ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0')
    : '#000'

  // Parse "1× Blueberry Cheese, 2× Taro" into items
  const items = (itemSummary ?? '')
    .split(', ')
    .filter(Boolean)
    .map((s) => {
      const match = s.match(/^(\d+)× (.+)$/)
      return match
        ? { quantity: Number(match[1]), name: match[2] }
        : { quantity: 1, name: s }
    })

  return (
    <>
      <Stack.Screen options={{ title: 'Order Detail' }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Status icon */}
        <View style={[styles.iconCircle, { backgroundColor: stateInfo.bgColor }]}>
          <Ionicons name={stateInfo.icon as any} size={36} color="#fff" />
        </View>

        <Text style={[styles.title, { color: stateInfo.color }]}>{stateInfo.title}</Text>
        <Text style={styles.subtitle}>{stateInfo.subtitle}</Text>

        {/* Pickup number */}
        <View style={styles.pickupCard}>
          <Text style={styles.pickupLabel}>PICKUP NUMBER</Text>
          <Text style={styles.pickupNumber}>{pickupNumber}</Text>
        </View>

        {/* Info row */}
        <View style={styles.infoRow}>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>DATE</Text>
            <Text style={styles.infoValue}>{formatDate(createdAt)}</Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>TOTAL</Text>
            <Text style={styles.infoValueLarge}>{formatCents(totalCents ?? '0')}</Text>
          </View>
        </View>

        {/* Map card */}
        <TouchableOpacity
          style={styles.mapCard}
          onPress={openMapsNavigation}
          activeOpacity={0.8}
        >
          <View style={styles.mapImageWrap}>
            {/* 3x2 tile grid centered on store */}
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
            {/* Red pin overlay at center */}
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

        {/* Order items */}
        {items.length > 0 && (
          <View style={styles.summarySection}>
            <Text style={styles.summaryHeading}>Order Summary</Text>
            {items.map((item, i) => {
              const imgUrl = imageMap[item.name]
              return (
                <View key={i} style={styles.summaryRow}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={styles.itemImage} />
                  ) : (
                    <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
                      <Text style={{ fontSize: 20 }}>🧋</Text>
                    </View>
                  )}
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemQty}>{item.quantity}x</Text>
                </View>
              )
            })}
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>Back to Account</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
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
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: 15,
    fontWeight: '600',
    color: BRAND.color,
  },

  backButton: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
})
