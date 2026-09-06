import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Icon } from '@/components/brand/Icon'
import { PressScale } from '@/components/ui/PressScale'
import { PulseDot } from '@/components/ui/PulseDot'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { placedRelative } from '@/components/orders/time'
import { timelineStatusFor } from '@/components/orders/status'
import { isDeliveryOrder, isUnfinished, useOrdersStore, type OrderHistoryItem } from '@/store/orders'

// "Where is my drink" on Home: the newest unfinished order as one tile —
// what stage it is at, a three-step bar, a tap to the full tracking screen.
// Only when there is one; most opens of the app there is not, and the tile
// is gone rather than empty.

const STEP_INDEX = { OPEN: 0, PREPARING: 1, READY: 2 } as const

function titleFor(order: OrderHistoryItem, status: keyof typeof STEP_INDEX): string {
  const delivery = isDeliveryOrder(order)
  if (status === 'READY') return delivery ? 'Out for delivery' : 'Ready for pickup!'
  if (status === 'PREPARING') return 'Making your drinks'
  return 'Order received'
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return `#${order.referenceId}`
  return `#${order.id.slice(-6).toUpperCase()}`
}

export function OrderInProgress() {
  const router = useRouter()
  const orders = useOrdersStore((s) => s.orders)
  const order = useMemo(() => orders.find(isUnfinished) ?? null, [orders])
  if (!order) return null

  const status = timelineStatusFor(order)
  const step = STEP_INDEX[status]
  const ready = status === 'READY'
  const items = order.lineCount > 1 ? `${order.firstItemName} +${order.lineCount - 1}` : order.firstItemName

  const track = () =>
    router.push({
      pathname: '/order-detail',
      params: {
        orderId: order.id,
        referenceId: order.referenceId ?? '',
        createdAt: order.createdAt ?? '',
        state: order.state ?? '',
        totalCents: order.totalCents,
        itemSummary: order.itemSummary,
        lineCount: String(order.lineCount),
        from: 'home',
      },
    })

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <PressScale
        haptic
        onPress={track}
        accessibilityRole="button"
        accessibilityLabel={`Order ${referenceLabel(order)}, ${titleFor(order, status)}. Track it.`}
        style={{
          backgroundColor: T.card,
          borderRadius: RADIUS.card,
          borderWidth: 1,
          borderColor: ready ? T.green : 'rgba(141,85,36,0.35)',
          padding: 14,
          ...SHADOW.card,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
            <PulseDot color={ready ? T.green : T.brand} size={6} active />
            <Text style={[TYPE.eyebrow, { color: ready ? T.greenDark : T.brand }]} numberOfLines={1}>
              {`ORDER ${referenceLabel(order)} · ${isDeliveryOrder(order) ? 'DELIVERY' : 'PICKUP'}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text style={[TYPE.label, { color: T.brand }]}>Track</Text>
            <Icon name="chevR" color={T.brand} size={13} />
          </View>
        </View>
        <Text
          style={{ fontFamily: 'ShantellSans_700Bold', fontSize: 18, letterSpacing: -0.4, color: T.ink, marginTop: 6 }}
          numberOfLines={1}
        >
          {titleFor(order, status)}
        </Text>
        <Text style={[TYPE.body, { color: T.ink3, marginTop: 2 }]} numberOfLines={1}>
          {`${items} · placed ${placedRelative(order.createdAt)}`}
        </Text>
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 10 }}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                backgroundColor: i <= step ? (ready ? T.green : T.brand) : T.line,
                opacity: i === step && !ready ? 0.75 : 1,
              }}
            />
          ))}
        </View>
      </PressScale>
    </View>
  )
}
