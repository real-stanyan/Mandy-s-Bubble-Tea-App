import { useCallback, useEffect, useRef, useState } from 'react'
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
  Alert,
} from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { OrderComplaintSection } from '@/components/account/OrderComplaintSection'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { Icon, type IconName } from '@/components/brand/Icon'
import { TrackingMap, type TrackingMapHandle } from '@/components/delivery/TrackingMap'
import { FreshnessBar, useFreshness } from '@/components/delivery/FreshnessBar'
import { DeliveryTimeline } from '@/components/delivery/DeliveryTimeline'
import { DriverRow } from '@/components/delivery/DriverRow'
import {
  StatusPill,
  TRACKING_AMBER,
  TRACKING_AMBER_TEXT,
  TRACKING_STALE_TEXT,
} from '@/components/delivery/StatusPill'
import { DashedBorder } from '@/components/ui/DashedBorder'
import { useDeliveryTracking } from '@/hooks/use-delivery-tracking'
import { DELIVERY_DRIVER, distanceKmText, etaText } from '@/lib/delivery'
import { deriveDeliverySteps } from '@/lib/dispatch-steps'
import { reorder } from '@/components/orders/reorder'
import { useCartStore } from '@/store/cart'
import { T, FONT, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import {
  effectiveOrderState,
  useOrdersStore,
  type OrderHistoryLineModifier,
} from '@/store/orders'

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
// Label-free pale tiles for the pre-dispatch delivery preview (S6) — same
// CARTO style the live tracking map uses, so the two read as one system.
const lightTileUrl = (x: number, y: number) =>
  `https://basemaps.cartocdn.com/light_nolabels/${MAP_ZOOM}/${x}/${y}@2x.png`

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

// Customer-visible state lives on the fulfillment for self-delivery orders
// (driver flips PREPARED/COMPLETED while order.state stays OPEN until staff
// close the ticket in POS) — shared mapping in store/orders.ts.
function resolveDisplayState(state: string | null | undefined, fulfillmentState: string | null | undefined) {
  return effectiveOrderState(state ?? null, fulfillmentState ?? null) || 'COMPLETED'
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

// "Today · 6:42 pm · by Rick" for the delivered hero (S7). Uses the order's
// updatedAt (the completion write) — null when unknown, and the row is hidden
// rather than showing a made-up time.
function deliveredMetaLine(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const day = sameDay
    ? 'Today'
    : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  const first = DELIVERY_DRIVER.name.split(' ')[0] || DELIVERY_DRIVER.name
  return `${day} · ${time} · by ${first}`
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

export default function OrderDetailScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
  const replaceCart = useCartStore((s) => s.clearCart)
  const addItem = useCartStore((s) => s.addItem)

  // While focused, refresh on mount + poll every 10s so staff actions
  // in Square Dashboard (OPEN → PREPARED → COMPLETED) flow through even
  // if the user is sitting on this screen waiting. Terminal states stop
  // polling inside the interval (checked via ref) so the callback stays
  // stable across state transitions — otherwise flipping isTerminal to
  // true would re-subscribe useFocusEffect mid-render and double-fire
  // refreshOrders, making the native header back button drop taps.
  const isTerminalRef = useRef(false)
  {
    const eff = effectiveOrderState(
      storeOrder?.state ?? null,
      storeOrder?.fulfillmentState ?? null,
    )
    isTerminalRef.current = eff === 'COMPLETED' || eff === 'CANCELED'
  }
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
  const isDelivery = (referenceId ?? '').toUpperCase().startsWith('DE')
  const createdAt = storeOrder?.createdAt ?? params.createdAt ?? ''
  const state = storeOrder?.state ?? params.state ?? ''
  const fulfillmentState = storeOrder?.fulfillmentState ?? null
  const totalCents = storeOrder?.totalCents ?? params.totalCents ?? '0'

  const displayState = resolveDisplayState(state, fulfillmentState)
  const isTerminal = displayState === 'COMPLETED' || displayState === 'CANCELED'
  const {
    state: liveFulfillmentState,
    dispatchStatus,
    tracking,
  } = useDeliveryTracking(orderId, isDelivery && !isTerminal)
  const mapRef = useRef<TrackingMapHandle>(null)
  const hasDriver = !!tracking && tracking.driverLat != null && tracking.driverLng != null
  const freshInfo = useFreshness(hasDriver, tracking?.locationUpdatedAt ?? null)
  const stale = freshInfo.state === 'stale'
  useEffect(() => {
    if (tracking) mapRef.current?.update({ ...tracking, stale })
  }, [tracking, stale])
  // Measured height of the tracker's bottom sheet — pushed into the map so
  // the follow cam recentres the driver into the visible band above it.
  const [sheetH, setSheetH] = useState(0)
  // S7 "View receipt" flips to the classic detail page (incl. complaints).
  const [showReceipt, setShowReceipt] = useState(false)

  const driverFirst = DELIVERY_DRIVER.name.split(' ')[0] || DELIVERY_DRIVER.name
  const dispatchUi = deriveDeliverySteps({
    state: liveFulfillmentState ?? fulfillmentState,
    dispatchStatus,
    driverName: driverFirst,
  })

  const outForDelivery = isDelivery && !!tracking

  const stateInfo = STATE_CONFIG[displayState] ?? STATE_CONFIG.COMPLETED
  const pickupNumber = referenceId
    || (orderId ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0') : '#000')

  let headerTitle = stateInfo.title
  let headerSubtitle = stateInfo.subtitle
  if (isDelivery) {
    if (outForDelivery) {
      headerTitle = 'Out for Delivery'
      headerSubtitle = 'Your driver is on the way to your address.'
    } else if (displayState === 'COMPLETED') {
      headerTitle = 'Delivered'
      headerSubtitle = 'Your order has been delivered. Enjoy your tea!'
    } else if (displayState === 'CANCELED') {
      /* keep stateInfo */
    } else {
      headerTitle = 'Order In Progress'
      headerSubtitle = 'Our tea masters are crafting your order.'
    }
  }

  const items = storeOrder
    ? storeOrder.lineItems.map((l) => ({
        quantity: l.quantity,
        name: l.name,
        imageUrl: l.imageUrl,
        modifiers: l.modifiers,
        priceCents:
          (Number(l.basePriceCents || '0') +
            l.modifiers.reduce((s, m) => s + Number(m.priceCents || '0'), 0)) *
          l.quantity,
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
            priceCents: null as number | null,
          }
        })

  const handleReorder = useCallback(() => {
    if (!storeOrder) return
    const result = reorder(replaceCart, addItem, storeOrder)
    if (result === 'empty') {
      Alert.alert('Unavailable', 'These items are no longer available.')
      return
    }
    router.push('/checkout')
  }, [storeOrder, replaceCart, addItem, router])

  // ── S4/S5 · Out for delivery → full-bleed live map + bottom sheet ─────────
  // The native stack header stays for back navigation. All other states keep
  // the in-flow detail page below.
  if (outForDelivery && tracking) {
    const eta = etaText(tracking.etaSeconds)
    const showEta = !!eta && !stale
    const distance = distanceKmText(
      tracking.driverLat,
      tracking.driverLng,
      tracking.destLat,
      tracking.destLng,
    )
    return (
      <View style={styles.trackRoot}>
        <View style={StyleSheet.absoluteFill}>
          <TrackingMap ref={mapRef} initial={{ ...tracking, stale }} bottomInset={sheetH} />
        </View>

        <View style={styles.trackFreshness} pointerEvents="none">
          <FreshnessBar hasDriver={hasDriver} locationUpdatedAt={tracking.locationUpdatedAt} />
        </View>

        <View
          style={[styles.trackSheet, { paddingBottom: insets.bottom + 18 }]}
          onLayout={(e) => setSheetH(Math.round(e.nativeEvent.layout.height))}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle}>{dispatchUi.heading}</Text>
            <StatusPill
              label={stale ? 'Paused' : 'Live'}
              dot={stale ? TRACKING_AMBER : T.green}
            />
          </View>
          <DeliveryTimeline
            compact
            stepIndex={dispatchUi.stepIndex}
            tone={dispatchUi.tone}
            completed={dispatchUi.kind === 'completed'}
          />
          <DriverRow
            variant="white"
            sub={
              stale
                ? 'waiting for GPS signal…'
                : distance
                  ? `${distance} · scooter 🛵`
                  : 'On the way with your order'
            }
          />
          <View style={styles.tilesRow}>
            <View style={styles.tileDashed}>
              <DashedBorder radius={RADIUS.tile} color="rgba(42,30,20,0.26)" />
              <Text style={styles.tileLbl}>ORDER NUMBER</Text>
              <Text style={styles.tileVal}>{pickupNumber}</Text>
              <Text style={styles.tileSub}>Quote on delivery</Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLbl}>ARRIVING IN</Text>
              <Text
                style={[
                  styles.tileVal,
                  { color: showEta ? T.greenDark : T.ink3 },
                ]}
              >
                {showEta ? eta : '—'}
              </Text>
              <Text
                style={[
                  styles.tileSub,
                  !showEta && { color: TRACKING_STALE_TEXT },
                ]}
              >
                {showEta ? 'via route · live' : 'will update on reconnect'}
              </Text>
            </View>
          </View>
          {items.length > 0 ? (
            <ScrollView style={styles.sheetItems} bounces={false}>
              {items.map((item, i) => (
                <View key={i} style={styles.sheetItemRow}>
                  <Text style={styles.sheetItemEmoji}>🧋</Text>
                  <Text style={styles.sheetItemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sheetItemQty}>×{item.quantity}</Text>
                  {item.priceCents != null ? (
                    <Text style={styles.sheetItemPrice}>
                      {formatCents(String(item.priceCents))}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    )
  }

  // ── S7 · Delivered → celebration screen (View receipt flips back to the
  // classic detail page below, which keeps the complaint section). ──────────
  if (isDelivery && displayState === 'COMPLETED' && !showReceipt) {
    const deliveredLine = deliveredMetaLine(storeOrder?.updatedAt ?? null)
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.deliveredContent}>
        <View style={styles.checkHaloOuter}>
          <View style={styles.checkHaloInner}>
            <LinearGradient
              colors={[T.green, T.greenDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.checkCircle}
            >
              <Icon name="check" size={34} color="#fff" />
            </LinearGradient>
          </View>
        </View>
        <Text style={styles.deliveredTitle}>Delivered</Text>
        <Text style={styles.deliveredSub}>Enjoy your drink 🧋</Text>
        {deliveredLine ? (
          <Text style={styles.deliveredMeta}>{deliveredLine}</Text>
        ) : null}

        <View style={styles.deliveredStepper}>
          <DeliveryTimeline stepIndex={3} tone="green" completed />
        </View>

        <View style={styles.deliveredCard}>
          {items.map((item, i) => (
            <View
              key={i}
              style={[styles.sheetItemRow, i > 0 && styles.sheetItemRowDivider]}
            >
              <Text style={styles.sheetItemEmoji}>🧋</Text>
              <Text style={styles.sheetItemName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sheetItemQty}>×{item.quantity}</Text>
              {item.priceCents != null ? (
                <Text style={styles.sheetItemPrice}>
                  {formatCents(String(item.priceCents))}
                </Text>
              ) : null}
            </View>
          ))}
          <View style={styles.deliveredDashbox}>
            <DashedBorder radius={RADIUS.tile} color="rgba(42,30,20,0.26)" />
            <View>
              <Text style={styles.tileLbl}>ORDER NUMBER</Text>
              <Text style={styles.deliveredOrderNum}>{pickupNumber}</Text>
            </View>
            <Text style={styles.tileLbl}>PAID · INCL. DELIVERY</Text>
          </View>
        </View>

        {storeOrder ? (
          <TouchableOpacity onPress={handleReorder} activeOpacity={0.85} style={styles.reorderWrap}>
            <LinearGradient
              colors={[T.brand, T.brandDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.reorderBtn}
            >
              <Text style={styles.reorderText}>Reorder these drinks</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setShowReceipt(true)} activeOpacity={0.7}>
          <Text style={styles.receiptLink}>View receipt</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    )
  }

  // ── S6 · Delivery placed but not out yet (pending / accepted) ────────────
  const preDispatch =
    isDelivery && !isTerminal && dispatchUi.kind === 'active' && dispatchUi.stepIndex < 2

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={preDispatch ? styles.preScrollContent : styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={T.brand}
        />
      }
    >
      {preDispatch ? (
        <>
          {/* Static store-pin map. We have no destination coordinates until
              the tracking payload unlocks at pickup (the server gates it), so
              we honestly show the store + a "route appears at pickup" note
              instead of guessing a second pin. */}
          <View style={styles.preMap}>
            {[0, 1].map((row) => (
              <View key={row} style={styles.tileRow}>
                {[-1, 0, 1].map((col) => (
                  <Image
                    key={col}
                    source={{ uri: lightTileUrl(centerX + col, centerY + row) }}
                    style={styles.tile150}
                  />
                ))}
              </View>
            ))}
            <View style={styles.preMapPin} pointerEvents="none">
              <Text style={{ fontSize: 15 }}>🧋</Text>
            </View>
            <View style={styles.preMapNote} pointerEvents="none">
              <Text style={styles.preMapNoteText}>ROUTE APPEARS AT PICKUP</Text>
            </View>
          </View>

          {/* Overlapping centered status card (amber pill + graded copy +
              4-step stepper). */}
          <View style={styles.preStatusCard}>
            <StatusPill label={dispatchUi.pillLabel} dot={TRACKING_AMBER} />
            <Text style={styles.preHeading}>{dispatchUi.heading}</Text>
            <Text style={styles.preBody}>{dispatchUi.body}</Text>
            <DeliveryTimeline stepIndex={dispatchUi.stepIndex} tone={dispatchUi.tone} />
          </View>

          <View style={styles.preInfoCard}>
            {dispatchUi.stepIndex >= 1 ? (
              <DriverRow variant="paper" sub="Your driver · scooter 🛵" />
            ) : (
              <DriverRow variant="ghost" sub="assigned in a moment" />
            )}
            <View style={styles.preDashbox}>
              <DashedBorder radius={RADIUS.tile} color="rgba(42,30,20,0.26)" />
              <View>
                <Text style={styles.tileLbl}>ORDER NUMBER</Text>
                <Text style={styles.deliveredOrderNum}>{pickupNumber}</Text>
              </View>
              <Text style={styles.tileLbl}>QUOTE ON DELIVERY</Text>
            </View>
            {items.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                {items.map((item, i) => (
                  <View
                    key={i}
                    style={[styles.sheetItemRow, i > 0 && styles.sheetItemRowDivider]}
                  >
                    <Text style={styles.sheetItemEmoji}>🧋</Text>
                    <Text style={styles.sheetItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.sheetItemQty}>×{item.quantity}</Text>
                    {item.priceCents != null ? (
                      <Text style={styles.sheetItemPrice}>
                        {formatCents(String(item.priceCents))}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={[styles.infoRow, { paddingHorizontal: 16 }]}>
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
            style={[styles.backButton, { marginHorizontal: 16 }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.backButtonText}>Back to {backLabel}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </>
      ) : (
        <>
          <View style={[styles.iconCircle, { backgroundColor: stateInfo.bgColor }]}>
            <Icon name={stateInfo.icon} size={36} color="#fff" />
          </View>

          <Text style={[styles.title, { color: stateInfo.color }]}>{headerTitle}</Text>
          <Text style={styles.subtitle}>{headerSubtitle}</Text>

          <View style={styles.pickupCard}>
            <Text style={styles.pickupLabel}>{isDelivery ? 'ORDER NUMBER' : 'PICKUP NUMBER'}</Text>
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
                      style={styles.tile150}
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
                    <SquareImage url={item.imageUrl} width={IMG_THUMB} style={styles.itemImage} />
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

          {displayState === 'COMPLETED' && (
            <OrderComplaintSection
              orderId={orderId}
              pickupNumber={pickupNumber}
              orderState={displayState}
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
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: T.bg },
  scrollContent: { alignItems: 'center', padding: 24, paddingTop: 60 },
  preScrollContent: { paddingTop: 12, paddingBottom: 24 },

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
  tile150: {
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

  // Full-screen live tracking (below the native stack header) — full-bleed
  // map, freshness chip up top, bottom sheet (S4/S5).
  trackRoot: { flex: 1, backgroundColor: '#E8E5DE' },
  trackFreshness: { position: 'absolute', left: 0, right: 0, top: 14, alignItems: 'center' },
  trackSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 999, backgroundColor: T.line, marginBottom: 2 },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sheetTitle: { fontFamily: 'Fraunces_500Medium', fontSize: 21, color: T.ink, letterSpacing: -0.3 },
  tilesRow: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.tile,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  tileDashed: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: RADIUS.tile,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  tileLbl: {
    fontFamily: FONT.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.ink3,
  },
  tileVal: {
    fontFamily: FONT.mono,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: T.ink,
    marginTop: 4,
  },
  tileSub: {
    fontFamily: FONT.sans,
    fontSize: 9.5,
    color: T.ink3,
    marginTop: 3,
  },
  sheetItems: { maxHeight: 96, marginTop: 2, borderTopWidth: 1, borderTopColor: T.line, paddingTop: 6 },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 6,
  },
  sheetItemRowDivider: {
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  sheetItemEmoji: { fontSize: 13 },
  sheetItemName: { ...TYPE.body, flex: 1, fontSize: 13, color: T.ink2 },
  sheetItemQty: { fontFamily: FONT.mono, fontSize: 11, color: T.ink3 },
  sheetItemPrice: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: T.ink },

  // S6 · pre-dispatch delivery detail
  preMap: {
    height: 212,
    borderRadius: RADIUS.card,
    marginHorizontal: 16,
    overflow: 'hidden',
    backgroundColor: '#E8E5DE',
  },
  preMapPin: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    marginLeft: -17,
    marginTop: -17,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  preMapNote: {
    position: 'absolute',
    top: 12,
    left: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  preMapNoteText: {
    fontFamily: FONT.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: T.ink3,
  },
  preStatusCard: {
    marginTop: -52,
    marginHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 8,
  },
  preHeading: {
    marginTop: 12,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 21,
    letterSpacing: -0.3,
    color: TRACKING_AMBER_TEXT,
    textAlign: 'center',
  },
  preBody: {
    marginTop: 6,
    fontFamily: FONT.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink3,
    textAlign: 'center',
  },
  preInfoCard: {
    marginTop: 14,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 14,
    ...SHADOW.card,
  },
  preDashbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderRadius: RADIUS.tile,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,249,240,0.6)',
  },

  // S7 · delivered celebration
  deliveredContent: {
    alignItems: 'center',
    paddingTop: 34,
    paddingHorizontal: 16,
  },
  checkHaloOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(60,169,110,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHaloInner: {
    width: 102,
    height: 102,
    borderRadius: 51,
    backgroundColor: 'rgba(60,169,110,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2E7F52',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  deliveredTitle: {
    marginTop: 18,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 32,
    letterSpacing: -0.5,
    color: T.ink,
  },
  deliveredSub: {
    marginTop: 7,
    fontFamily: FONT.sans,
    fontSize: 14.5,
    color: T.ink2,
  },
  deliveredMeta: {
    marginTop: 9,
    fontFamily: FONT.mono,
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: T.ink3,
  },
  deliveredStepper: {
    width: '100%',
    paddingHorizontal: 18,
    marginTop: 6,
  },
  deliveredCard: {
    marginTop: 22,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 14,
    ...SHADOW.card,
  },
  deliveredDashbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    borderRadius: RADIUS.tile,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,249,240,0.6)',
  },
  deliveredOrderNum: {
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: T.ink,
    marginTop: 3,
  },
  reorderWrap: {
    width: '100%',
    marginTop: 16,
    shadowColor: '#6B3E15',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 6,
  },
  reorderBtn: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  reorderText: {
    color: T.paper,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15.5,
  },
  receiptLink: {
    marginTop: 13,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: T.ink3,
    textDecorationLine: 'underline',
  },
})
