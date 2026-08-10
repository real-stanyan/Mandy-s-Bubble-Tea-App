import { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { T, FONT, SHADOW } from '@/constants/theme'
import { DELIVERY_DRIVER, distanceKmText, etaText } from '@/lib/delivery'
import { deriveDeliverySteps } from '@/lib/dispatch-steps'
import { useDeliveryTracking } from '@/hooks/use-delivery-tracking'
import { DeliveryTimeline } from '@/components/delivery/DeliveryTimeline'
import { DriverRow } from '@/components/delivery/DriverRow'
import { FreshnessBar, useFreshness } from '@/components/delivery/FreshnessBar'
import { TrackingMap, type TrackingMapHandle } from '@/components/delivery/TrackingMap'
import { DashedBorder } from '@/components/ui/DashedBorder'
import {
  StatusPill,
  TRACKING_AMBER as AMBER,
  TRACKING_AMBER_TEXT as AMBER_TEXT,
} from '@/components/delivery/StatusPill'
import type { OrderHistoryItem } from '@/store/orders'

// List cards poll at a relaxed cadence — the full-screen tracker owns the 5s
// "live" feel; the list just needs the state machine to advance.
const LIST_POLL_MS = 10_000

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? Number(cents) / 100 : cents / 100
  return `A$${n.toFixed(2)}`
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return order.referenceId
  return `#${order.id.slice(-6).toUpperCase()}`
}

function driverFirstName(): string {
  return DELIVERY_DRIVER.name.split(' ')[0] || DELIVERY_DRIVER.name
}

interface Props {
  order: OrderHistoryItem
  // Only the newest active delivery order gets `live` — it polls the status
  // endpoint and may render the inline live map (S3). Other delivery cards
  // stay static (S1 shape from the fulfillment state) so we never stack
  // multiple WebViews in the list.
  live: boolean
  onTrack: (order: OrderHistoryItem) => void
}

/**
 * Delivery list card, three states (design S1/S2/S3):
 *  - pending  → paper card, amber "Finding your driver" + 4-step stepper
 *  - accepted → same shell + driver strip with Call
 *  - picked_up→ sage gradient shell with inline 190px live map, freshness
 *               chip, ETA pill, order-number block and driver strip.
 * Pickup orders never come through here — they keep ActiveOrderCard.
 */
export function DeliveryHeroCard({ order, live, onTrack }: Props) {
  const { state, dispatchStatus, tracking } = useDeliveryTracking(
    order.id,
    live,
    LIST_POLL_MS,
  )
  const effState = state ?? order.fulfillmentState
  const ui = deriveDeliverySteps({
    state: effState,
    dispatchStatus,
    driverName: driverFirstName(),
  })

  const hasDriver = !!tracking && tracking.driverLat != null && tracking.driverLng != null
  const info = useFreshness(hasDriver, tracking?.locationUpdatedAt ?? null)
  const stale = info.state === 'stale'

  const mapRef = useRef<TrackingMapHandle>(null)
  useEffect(() => {
    if (tracking) mapRef.current?.update({ ...tracking, stale })
  }, [tracking, stale])

  const showLiveMap = live && ui.kind === 'active' && ui.stepIndex >= 2 && !!tracking

  if (showLiveMap && tracking) {
    const eta = etaText(tracking.etaSeconds)
    const distance = distanceKmText(
      tracking.driverLat,
      tracking.driverLng,
      tracking.destLat,
      tracking.destLng,
    )
    const pill =
      info.state === 'live' || info.state === 'recent'
        ? { label: 'Live', dot: T.green }
        : info.state === 'stale'
          ? { label: 'Paused', dot: AMBER }
          : { label: 'On the way', dot: AMBER }
    return (
      <Pressable
        onPress={() => onTrack(order)}
        style={({ pressed }) => [
          styles.container,
          iosShadow('readyCard'),
          pressed && { opacity: 0.92 },
        ]}
      >
        <LinearGradient
          colors={[T.sage, '#8CA07D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.sageInner}
        >
          <View style={styles.headerRow}>
            <Text style={[styles.eyebrow, { color: 'rgba(42,30,20,0.62)' }]}>
              OUT FOR DELIVERY
            </Text>
            <StatusPill label={pill.label} dot={pill.dot} />
          </View>

          <View style={styles.mapWrap}>
            {/* Glanceable preview — taps fall through to the card (detail page
                has the interactive map). */}
            {Platform.OS === 'android' ? (
              // Android: react-native-webview white-outs when clipped inside a
              // rounded, elevated card (SurfaceView z-order punch-through) —
              // it blanks the whole card. Show a static store→home preview
              // here; the full-screen tracker keeps the live WebView map.
              <View style={styles.mapFill} pointerEvents="none">
                <View style={[styles.staticPin, styles.staticPinStore]}>
                  <Text style={styles.staticPinEmoji}>🧋</Text>
                </View>
                <View style={[styles.staticPin, styles.staticPinDest]}>
                  <Text style={styles.staticPinEmoji}>🏠</Text>
                </View>
                <View style={styles.staticHint}>
                  <Text style={styles.staticHintText}>Tap to track live ↗</Text>
                </View>
              </View>
            ) : (
              <View style={styles.mapFill} pointerEvents="none">
                <TrackingMap ref={mapRef} initial={{ ...tracking, stale }} bottomInset={0} />
              </View>
            )}
            <View style={styles.mapChip} pointerEvents="none">
              <FreshnessBar hasDriver={hasDriver} locationUpdatedAt={tracking.locationUpdatedAt} />
            </View>
            {eta && !stale ? (
              <View style={styles.etaPill} pointerEvents="none">
                <Text style={styles.etaPillLabel}>ETA </Text>
                <Text style={styles.etaPillValue}>{eta}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.dashbox}>
            <DashedBorder radius={12} color="rgba(42,30,20,0.3)" />
            <View>
              <Text style={styles.tinyLabel}>ORDER NUMBER</Text>
              <Text style={styles.orderNum}>{referenceLabel(order)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.tinyLabel}>QUOTE ON DELIVERY</Text>
              <Text style={[styles.tinyLabel, { marginTop: 3 }]}>TAP MAP TO EXPAND ↗</Text>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
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
          </View>
        </LinearGradient>
      </Pressable>
    )
  }

  // Paper shell (S1 pending / S2 accepted; also the fallback for picked_up
  // before tracking data arrives or on non-live cards).
  const headingColor = ui.tone === 'green' ? T.greenDark : AMBER_TEXT
  const dotColor = ui.tone === 'green' ? T.green : AMBER
  const showDriverRow = ui.kind === 'active' && ui.stepIndex === 1
  const etaHint =
    ui.stepIndex >= 2 ? 'Tap to track your driver live' : 'ETA appears once your driver picks up'

  return (
    <Pressable
      onPress={() => onTrack(order)}
      style={({ pressed }) => [
        styles.container,
        styles.paperCard,
        iosShadow('card'),
        pressed && { opacity: 0.92 },
      ]}
    >
      <View style={styles.paperInner}>
        <View style={styles.headerRow}>
          <Text style={[styles.eyebrow, { color: T.ink3 }]} numberOfLines={1}>
            DELIVERY · {referenceLabel(order)}
          </Text>
          <StatusPill label={ui.pillLabel} dot={dotColor} />
        </View>

        <Text style={[styles.heading, { color: headingColor }]}>{ui.heading}</Text>
        <Text style={styles.sub}>{ui.body}</Text>

        <DeliveryTimeline
          stepIndex={ui.stepIndex}
          tone={ui.tone}
          completed={ui.kind === 'completed'}
        />

        {showDriverRow ? (
          <View style={{ marginTop: 14 }}>
            <DriverRow variant="paper" sub="Your driver · scooter 🛵" />
          </View>
        ) : null}

        <View style={styles.hairline} />
        <View style={styles.microRow}>
          <Text style={styles.microItems}>
            🧋 {order.lineCount} {order.lineCount === 1 ? 'item' : 'items'} ·{' '}
            {formatCents(order.totalCents)}
          </Text>
          <Text style={styles.etaHint}>{etaHint}</Text>
        </View>
      </View>
    </Pressable>
  )
}

function iosShadow(preset: 'card' | 'readyCard') {
  return Platform.select({
    ios: {
      shadowColor: SHADOW[preset].shadowColor,
      shadowOffset: SHADOW[preset].shadowOffset,
      shadowOpacity: SHADOW[preset].shadowOpacity,
      shadowRadius: SHADOW[preset].shadowRadius,
    },
    android: { elevation: SHADOW[preset].elevation },
  })
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  paperCard: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
  },
  paperInner: {
    padding: 16,
  },
  sageInner: {
    padding: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  heading: {
    marginTop: 10,
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  sub: {
    marginTop: 5,
    fontFamily: FONT.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink3,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.line,
    marginTop: 13,
    marginBottom: 11,
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  microItems: {
    fontFamily: FONT.sans,
    fontSize: 12,
    color: T.ink2,
  },
  etaHint: {
    fontFamily: FONT.sans,
    fontSize: 11,
    fontStyle: 'italic',
    color: T.ink3,
    flexShrink: 1,
    textAlign: 'right',
  },
  mapWrap: {
    height: 190,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 13,
    backgroundColor: '#E8E5DE',
  },
  mapFill: {
    ...StyleSheet.absoluteFillObject,
  },
  // Android static map preview (WebView white-outs when clipped in the card).
  staticPin: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  staticPinStore: {
    top: 62,
    left: 26,
    borderColor: T.brand,
  },
  staticPinDest: {
    bottom: 26,
    right: 30,
    borderColor: '#5B7A52',
  },
  staticPinEmoji: {
    fontSize: 17,
    lineHeight: 20,
  },
  staticHint: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(42,30,20,0.82)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
  },
  staticHintText: {
    fontFamily: FONT.mono,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: T.cream,
  },
  mapChip: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  etaPill: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: 'rgba(42,30,20,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  etaPillLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    color: 'rgba(255,243,222,0.65)',
  },
  etaPillValue: {
    fontFamily: FONT.mono,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: T.cream,
  },
  dashbox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,249,240,0.5)',
  },
  tinyLabel: {
    fontFamily: FONT.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.ink3,
  },
  orderNum: {
    fontFamily: FONT.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: T.ink,
    marginTop: 3,
  },
})
