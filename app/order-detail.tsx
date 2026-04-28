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
import { OrderComplaintSection } from '@/components/account/OrderComplaintSection'
import { Icon, type IconName } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { useOrdersStore, type OrderHistoryLineModifier } from '@/store/orders'

function groupModifiers(
  mods: OrderHistoryLineModifier[],
): { listName: string; names: string[] }[] {
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

interface StateInfo {
  icon: IconName
  color: string
  bgColor: string
  title: string
  subtitle: string
}

const STATE_CONFIG: Record<string, StateInfo> = {
  COMPLETED: {
    icon: 'check',
    color: '#2e5e2e',
    bgColor: '#6b9e6f',
    title: 'Order Completed',
    subtitle: 'This order has been picked up. Enjoy your tea!',
  },
  READY: {
    icon: 'cafe',
    color: '#14532d',
    bgColor: '#16a34a',
    title: 'Ready for Pickup',
    subtitle: 'Your order is ready. Come grab it at the counter!',
  },
  OPEN: {
    icon: 'clock',
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

  const referenceId = storeOrder?.referenceId ?? params.referenceId ?? ''
  const createdAt = storeOrder?.createdAt ?? params.createdAt ?? ''
  const state = storeOrder?.state ?? params.state ?? ''
  const fulfillmentState = storeOrder?.fulfillmentState ?? null
  const totalCents = storeOrder?.totalCents ?? params.totalCents ?? '0'

  const displayState = resolveDisplayState(state, fulfillmentState)
  const stateInfo = STATE_CONFIG[displayState] ?? STATE_CONFIG.COMPLETED
  const pickupNumber = referenceId
    || (orderId ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0') : '#000')

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
          tintColor={T.brand}
        />
      }
    >
      <View style={[styles.iconCircle, { backgroundColor: stateInfo.bgColor }]}>
        <Icon name={stateInfo.icon} size={36} color="#fff" />
      </View>

      <Text style={[styles.title, { color: stateInfo.color }]}>{stateInfo.title}</Text>
      <Text style={styles.subtitle}>{stateInfo.subtitle}</Text>

      <View style={styles.pickupCard}>
        <Text style={styles.pickupLabel}>PICKUP NUMBER</Text>
        <Text style={styles.pickupNumber}>{pickupNumber}</Text>
      </View>

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
            <Icon name="pin" size={30} color={T.brand} />
          </View>
        </View>
        <View style={styles.mapOverlay}>
          <Icon name="pin" size={20} color={T.brand} />
          <View style={styles.mapTextWrap}>
            <Text style={styles.mapStoreName}>{STORE_LABEL}</Text>
            <Text style={styles.mapAddress}>{STORE_ADDRESS}</Text>
          </View>
          <Icon name="arrow" size={20} color={T.brand} />
        </View>
      </TouchableOpacity>

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

      {state === 'COMPLETED' && (
        <OrderComplaintSection
          orderId={orderId}
          pickupNumber={pickupNumber}
          orderState={state}
        />
      )}

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
  scroll: { flex: 1, backgroundColor: T.bg },
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
    fontFamily: 'Fraunces_500Medium',
    fontSize: 24,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPE.body,
    fontSize: 14,
    color: T.ink3,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  pickupCard: {
    marginTop: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.card,
    padding: 20,
    alignItems: 'center',
    backgroundColor: T.paper,
    ...SHADOW.card,
  },
  pickupLabel: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginBottom: 4,
  },
  pickupNumber: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 48,
    letterSpacing: -1,
    color: T.brand,
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
    borderColor: T.line,
    borderRadius: RADIUS.card,
    padding: 14,
    alignItems: 'center',
    backgroundColor: T.paper,
    ...SHADOW.card,
  },
  infoLabel: {
    ...TYPE.eyebrow,
    fontSize: 10,
    letterSpacing: 0.8,
    color: T.ink3,
    marginBottom: 6,
  },
  infoValue: {
    ...TYPE.bodyStrong,
    color: T.ink,
    textAlign: 'center',
  },
  infoValueLarge: {
    ...TYPE.priceLg,
    color: T.ink,
  },

  mapCard: {
    marginTop: 16,
    width: '100%',
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
  },
  mapImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: T.sage,
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
    ...TYPE.bodyStrong,
    fontSize: 14,
    color: T.ink,
  },
  mapAddress: {
    ...TYPE.body,
    fontSize: 12,
    color: T.ink3,
    marginTop: 1,
  },

  summarySection: {
    marginTop: 20,
    width: '100%',
  },
  summaryHeading: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.card,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    ...SHADOW.card,
  },
  itemImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: T.bg2,
  },
  itemImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1, gap: 2 },
  itemName: {
    ...TYPE.bodyStrong,
    fontSize: 15,
    color: T.ink,
  },
  itemVariation: {
    ...TYPE.body,
    fontSize: 13,
    color: T.ink3,
    lineHeight: 17,
  },
  itemVariationLabel: {
    color: T.ink4,
    fontFamily: 'Inter_600SemiBold',
  },
  itemQty: {
    ...TYPE.priceSm,
    fontSize: 15,
    color: T.brand,
  },

  backButton: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: T.ink4,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  backButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
  },
})
