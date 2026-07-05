import { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
  AppState,
  StyleSheet,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Icon, type IconName } from '@/components/brand/Icon'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { LOYALTY } from '@/lib/constants'
import { useAuth } from '@/components/auth/AuthProvider'
import { apiFetch } from '@/lib/api'
import { useOrdersStore } from '@/store/orders'
import type { CartItem, CartModifier } from '@/types/square'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

function groupModifiers(mods: CartModifier[]): { listName: string; names: string[] }[] {
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

type FulfillmentState = 'PROPOSED' | 'RESERVED' | 'PREPARED' | 'COMPLETED' | 'CANCELED' | 'FAILED'

const TERMINAL_STATES: ReadonlySet<FulfillmentState> = new Set(['COMPLETED', 'CANCELED', 'FAILED'])
const POLL_MS = 5000

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
  const { orderId, pickupNumber: pickupNum, loyaltyAccrued } = useLocalSearchParams<{
    orderId: string
    pickupNumber: string
    loyaltyAccrued: string
    total: string
  }>()

  const { loyalty, profile, starsPerReward } = useAuth()
  const [orderItems, setOrderItems] = useState<CartItem[]>([])
  const [fulfillmentState, setFulfillmentState] = useState<FulfillmentState>('PROPOSED')
  const stateRef = useRef<FulfillmentState>('PROPOSED')
  const [waitText, setWaitText] = useState<string | null>(null)

  const pickupNumber = pickupNum
    || (orderId ? '#' + orderId.slice(-3).replace(/\D/g, '').padStart(3, '0') : '#000')

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)

    AsyncStorage.getItem('mbt:lastOrder:items').then((raw) => {
      if (raw) {
        try {
          setOrderItems(JSON.parse(raw))
        } catch { /* noop */ }
      }
    })

    if (profile) {
      useOrdersStore.getState().refresh()
    }
  }, [profile])

  useEffect(() => {
    if (!orderId) return
    let cancelled = false
    apiFetch<{ ok: boolean; text?: string }>(`/api/orders/${orderId}/wait`)
      .then((data) => {
        if (cancelled) return
        if (data.ok && data.text) setWaitText(data.text)
      })
      .catch(() => { /* keep fallback */ })
    return () => { cancelled = true }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    if (TERMINAL_STATES.has(stateRef.current)) return

    let cancelled = false

    const tick = async () => {
      try {
        const data = await apiFetch<{ ok: boolean; state: FulfillmentState | null }>(
          `/api/orders/${orderId}/status`,
        )
        if (cancelled || !data.ok || !data.state) return
        if (data.state !== stateRef.current) {
          stateRef.current = data.state
          setFulfillmentState(data.state)
          if (data.state === 'PREPARED') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
          if (TERMINAL_STATES.has(data.state)) {
            useOrdersStore.getState().refresh()
          }
        }
      } catch { /* retry next tick */ }
    }

    tick()
    const id = setInterval(tick, POLL_MS)

    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !TERMINAL_STATES.has(stateRef.current)) {
        tick()
      }
    })

    return () => {
      cancelled = true
      clearInterval(id)
      sub.remove()
    }
  }, [orderId, fulfillmentState])

  const perReward = starsPerReward || LOYALTY.starsForReward
  const starsEarned = loyaltyAccrued === '1' ? orderItems.reduce((sum, i) => sum + i.quantity, 0) : 0
  const currentBalance = loyalty?.balance ?? 0
  const starsToGo = Math.max(0, perReward - currentBalance)
  const progressRatio = perReward > 0 ? Math.min(currentBalance / perReward, 1) : 0

  const statusUi = getStatusUi(fulfillmentState)

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.iconCircle, { backgroundColor: statusUi.iconBg }]}>
        <Icon name={statusUi.icon} size={32} color="#fff" />
      </View>

      <Text style={[styles.title, { color: statusUi.headingColor }]}>{statusUi.heading}</Text>
      <Text style={styles.subtitle}>{statusUi.body}</Text>

      <View style={styles.pickupCard}>
        <Text style={styles.pickupLabel}>YOUR PICKUP NUMBER</Text>
        <Text style={styles.pickupNumber}>{pickupNumber}</Text>
      </View>

      <View style={styles.infoRow}>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>DATE</Text>
          <Text style={styles.infoValue}>{formatNow()}</Text>
        </View>
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>ESTIMATED PICKUP</Text>
          <Text style={styles.infoValueLarge}>{waitText ?? '15–20 mins'}</Text>
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

      {starsEarned > 0 && (
        <View style={styles.starsBanner}>
          <View style={styles.starsHeader}>
            <Text style={styles.starsIcon}>⭐</Text>
            <Text style={styles.starsTitle}>Stars Earned: +{starsEarned}</Text>
          </View>
          <Text style={styles.starsProgress}>
            Current Progress: {currentBalance}/{perReward} Stars
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

      {orderItems.length > 0 && (
        <View style={styles.summarySection}>
          <Text style={styles.summaryHeading}>Order Summary</Text>
          {orderItems.map((item) => (
            <View key={item.lineId ?? item.variationId} style={styles.summaryRow}>
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

type StatusUi = {
  heading: string
  body: string
  headingColor: string
  iconBg: string
  icon: IconName
}

function getStatusUi(state: FulfillmentState): StatusUi {
  switch (state) {
    case 'PREPARED':
      return {
        heading: 'Ready for Pickup!',
        body: 'Your order is ready at the counter. Show your pickup number to our team.',
        headingColor: T.brand,
        iconBg: T.brand,
        icon: 'cafe',
      }
    case 'COMPLETED':
      return {
        heading: 'Picked Up',
        body: "Enjoy your drink! Thanks for visiting Mandy's Bubble Tea.",
        headingColor: '#5B7A52',
        iconBg: '#6b9e6f',
        icon: 'check',
      }
    case 'CANCELED':
    case 'FAILED':
      return {
        heading: 'Order Canceled',
        body: 'This order was canceled. If you were charged, please speak to a team member at the counter.',
        headingColor: '#6B7280',
        iconBg: '#9CA3AF',
        icon: 'close',
      }
    case 'PROPOSED':
    case 'RESERVED':
    default:
      return {
        heading: 'Ready for Pickup Soon!',
        body: "Our tea masters are crafting your order. We'll have it ready for you at the counter shortly.",
        headingColor: '#2e5e2e',
        iconBg: '#6b9e6f',
        icon: 'check',
      }
  }
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
    color: T.ink3,
    textAlign: 'center',
    marginTop: 8,
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
    color: T.ink3,
    marginBottom: 6,
  },
  infoValue: {
    ...TYPE.bodyStrong,
    color: T.ink,
    textAlign: 'center',
  },
  infoValueLarge: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    letterSpacing: -0.3,
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
    ...SHADOW.card,
  },
  mapImageWrap: {
    width: '100%',
    height: 150,
    backgroundColor: T.bg2,
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

  starsBanner: {
    marginTop: 16,
    width: '100%',
    backgroundColor: '#a07840',
    borderRadius: RADIUS.card,
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
    fontFamily: 'Fraunces_500Medium',
    fontSize: 16,
    letterSpacing: -0.3,
    color: '#fff',
  },
  starsProgress: {
    ...TYPE.body,
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
    ...TYPE.eyebrow,
    fontSize: 11,
    color: '#fff',
  },

  summarySection: {
    marginTop: 20,
    width: '100%',
  },
  summaryHeading: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 18,
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
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  itemVariation: {
    ...TYPE.body,
    fontSize: 13,
    lineHeight: 17,
    color: T.ink3,
  },
  itemVariationLabel: {
    color: T.ink4,
    fontFamily: 'Inter_600SemiBold',
  },
  itemQty: {
    ...TYPE.priceSm,
    color: T.brand,
  },

  homeButton: {
    marginTop: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: T.ink4,
    borderRadius: RADIUS.pill,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  homeButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
  },
})
