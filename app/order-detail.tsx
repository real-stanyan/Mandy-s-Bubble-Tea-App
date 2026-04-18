import { useCallback, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { useOrdersStore, type OrderHistoryLineModifier } from '@/store/orders'

function groupModifiers(
  mods: OrderHistoryLineModifier[],
): Array<{ listName: string; names: string[] }> {
  const byList = new Map<string, string[]>()
  for (const m of mods) {
    const key = m.listName || 'OTHER'
    const arr = byList.get(key) ?? []
    arr.push(m.name)
    byList.set(key, arr)
  }
  return Array.from(byList.entries()).map(([listName, names]) => ({ listName, names }))
}

function titleCase(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

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
  READY: {
    icon: 'cafe-outline',
    color: '#14532d',
    bgColor: '#16a34a',
    title: 'Ready for Pickup',
    subtitle: 'Your order is ready. Come grab it at the counter!',
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

function resolveDisplayState(state: string | null | undefined, fulfillmentState: string | null | undefined) {
  if (state === 'OPEN' && fulfillmentState === 'PREPARED') return 'READY'
  return state ?? 'COMPLETED'
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
  const params = useLocalSearchParams<{
    orderId: string
    referenceId: string
    createdAt: string
    state: string
    totalCents: string
    itemSummary: string
    lineCount: string
    from?: string
  }>()
  const { orderId, from } = params
  const backLabel = from === 'orders' ? 'My Orders' : 'Account'

  const storeOrder = useOrdersStore((s) =>
    s.orders.find((o) => o.id === orderId) ?? null,
  )
  const refreshOrders = useOrdersStore((s) => s.refresh)
  const [refreshing, setRefreshing] = useState(false)

  // While focused, refresh on mount + poll every 10s so staff actions
  // in Square Dashboard (OPEN → PREPARED → COMPLETED) flow through even
  // if the user is sitting on this screen waiting. Terminal states stop
  // polling inside the interval (checked via ref) so the callback stays
  // stable across state transitions — otherwise flipping isTerminal to
  // true would re-subscribe useFocusEffect mid-render and double-fire
  // refreshOrders, making the native header back button drop taps.
  const isTerminalRef = useRef(false)
  isTerminalRef.current =
    storeOrder?.state === 'COMPLETED' || storeOrder?.state === 'CANCELED'
  useFocusEffect(
    useCallback(() => {
      refreshOrders()
      const id = setInterval(() => {
        if (isTerminalRef.current) {
          clearInterval(id)
          return
        }
        refreshOrders()
      }, 10_000)
      return () => clearInterval(id)
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

  // Prefer fresh store data; fall back to route params if the order
  // hasn't re-hydrated yet (e.g. cold entry via deep link).
  const referenceId = storeOrder?.referenceId ?? params.referenceId ?? ''
  const createdAt = storeOrder?.createdAt ?? params.createdAt ?? ''
  const state = storeOrder?.state ?? params.state ?? ''
  const fulfillmentState = storeOrder?.fulfillmentState ?? null
  const totalCents = storeOrder?.totalCents ?? params.totalCents ?? '0'

  const displayState = resolveDisplayState(state, fulfillmentState)
  const stateInfo = STATE_CONFIG[displayState] ?? STATE_CONFIG.COMPLETED
  const pickupNumber = referenceId
    || (orderId ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0') : '#000')

  // Prefer the store's lineItems (each already carries imageUrl from the
  // history endpoint). Fall back to parsing the summary string when the
  // order isn't in the store (cold deep-link entry).
  const items = storeOrder
    ? storeOrder.lineItems.map((l) => ({
        quantity: l.quantity,
        name: l.name,
        imageUrl: l.imageUrl,
        modifiers: l.modifiers,
      }))
    : (params.itemSummary ?? '')
        .split(', ')
        .filter(Boolean)
        .map((s) => {
          const match = s.match(/^(\d+)× (.+)$/)
          const parsed = match
            ? { quantity: Number(match[1]), name: match[2] }
            : { quantity: 1, name: s }
          return {
            ...parsed,
            imageUrl: null as string | null,
            modifiers: [] as OrderHistoryLineModifier[],
          }
        })

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={BRAND.color}
        />
      }
    >
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
            <Text style={styles.infoValueLarge}>{formatCents(totalCents)}</Text>
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
            {items.map((item, i) => (
              <View key={i} style={styles.summaryRow}>
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
                  <Text style={styles.itemVariation} numberOfLines={1}>
                    <Text style={styles.itemVariationLabel}>Size:</Text> Large 700ml
                  </Text>
                  {groupModifiers(item.modifiers ?? []).map((g) => (
                    <Text key={g.listName} style={styles.itemVariation} numberOfLines={2}>
                      <Text style={styles.itemVariationLabel}>{titleCase(g.listName)}:</Text>{' '}
                      {g.names.join(', ')}
                    </Text>
                  ))}
                </View>
                <Text style={styles.itemQty}>{item.quantity}x</Text>
              </View>
            ))}
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>Back to {backLabel}</Text>
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
  itemName: {
    fontSize: 15,
    fontWeight: '500',
  },
  itemVariation: { fontSize: 13, color: '#888', lineHeight: 17 },
  itemVariationLabel: { color: '#aaa', fontWeight: '600' },
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
