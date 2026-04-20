import { memo, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Image } from 'expo-image'
import { usePathname, useRouter } from 'expo-router'
import { Icon } from '@/components/brand/Icon'
import { useCartStore } from '@/store/cart'
import type { OrderHistoryItem } from '@/hooks/use-order-history'
import { reorder } from '@/components/orders/reorder'
import { useCatalogImageMap } from '@/hooks/use-catalog-image-map'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

const STATE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  COMPLETED: { label: 'COMPLETED', color: '#6b7260', bg: '#eae7dc' },
  READY: { label: 'READY', color: '#14532d', bg: '#d1fae5' },
  OPEN: { label: 'IN PROGRESS', color: '#9a3412', bg: '#fde4d3' },
  CANCELED: { label: 'CANCELLED', color: '#991b1b', bg: '#fecaca' },
}

// Promote OPEN orders whose pickup fulfillment is PREPARED to a
// customer-visible "Ready" state — that's what staff flip to in the
// Square dashboard when the drink is at the counter.
function effectiveState(
  state: string | null,
  fulfillmentState: string | null,
): string {
  if (state === 'OPEN' && fulfillmentState === 'PREPARED') return 'READY'
  return state ?? ''
}

function formatDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const datePart = d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
  const timePart = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${datePart} · ${timePart}`
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

function parseFirstName(summary: string): string {
  if (!summary) return ''
  const first = summary.split(', ')[0] ?? ''
  const m = first.match(/^\d+× (.+)$/)
  return m ? m[1] : first
}

interface Props {
  orders: OrderHistoryItem[]
  title?: string
  hideIfEmpty?: boolean
}

export function OrderHistory({ orders, title = 'Recent Orders', hideIfEmpty = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const replaceCart = useCartStore((s) => s.clearCart)
  const addItem = useCartStore((s) => s.addItem)
  const imageByName = useCatalogImageMap()

  const goToDetail = useCallback(
    (order: OrderHistoryItem) => {
      // `from` drives order-detail's back-button label so it reads
      // "My Orders" vs "Account" depending on where we came from.
      const from = pathname === '/order' ? 'orders' : 'account'
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
          from,
        },
      })
    },
    [pathname, router],
  )

  const handleReorder = useCallback(
    (order: OrderHistoryItem) => {
      const result = reorder(replaceCart, addItem, order)
      if (result === 'empty') {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )

  if (orders.length === 0) {
    if (hideIfEmpty) return null
    return (
      <View style={styles.emptyContainer}>
        <Icon name="receipt" color={T.ink4} size={32} />
        <Text style={styles.emptyText}>No orders yet</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{title}</Text>
      </View>

      {orders.map((order) => (
        <OrderCardRow
          key={order.id}
          order={order}
          imageByName={imageByName}
          onOpen={goToDetail}
          onReorder={handleReorder}
        />
      ))}
    </View>
  )
}

interface OrderCardProps {
  order: OrderHistoryItem
  imageByName: Record<string, string>
  onOpen: (order: OrderHistoryItem) => void
  onReorder: (order: OrderHistoryItem) => void
}

const OrderCardRow = memo(function OrderCardRow({
  order,
  imageByName,
  onOpen,
  onReorder,
}: OrderCardProps) {
  const stateKey = effectiveState(order.state, order.fulfillmentState)
  const stateInfo = STATE_STYLES[stateKey] ?? {
    label: stateKey || 'UNKNOWN',
    color: '#555',
    bg: '#eee',
  }
  const isCompleted = stateKey === 'COMPLETED'
  const firstName = order.firstItemName || parseFirstName(order.itemSummary)
  const thumb = order.firstItemImageUrl ?? imageByName[firstName] ?? null
  const subtitle = `${order.lineCount} Item${order.lineCount !== 1 ? 's' : ''} · ${formatDateTime(order.createdAt)}`

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onOpen(order)}
      activeOpacity={0.85}
    >
      {thumb ? (
        <Image
          source={{ uri: thumb }}
          style={styles.thumb}
          contentFit="cover"
          contentPosition="center"
          transition={120}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={{ fontSize: 22 }}>🧋</Text>
        </View>
      )}

      <View style={styles.middle}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {firstName || 'Order'}
          </Text>
          <View style={[styles.badge, { backgroundColor: stateInfo.bg }]}>
            <Text style={[styles.badgeText, { color: stateInfo.color }]}>
              {stateInfo.label}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        <Text style={styles.price}>{formatCents(order.totalCents)}</Text>
      </View>

      <View style={styles.actions}>
        {isCompleted ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => onReorder(order)}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>Reorder</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => onOpen(order)}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>Track</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 18,
    letterSpacing: -0.3,
    color: T.ink,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...SHADOW.card,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: T.bg2,
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 15,
    color: T.ink,
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    fontFamily: 'Inter_600SemiBold',
  },
  subtitle: {
    ...TYPE.body,
    fontSize: 12,
    color: T.ink3,
  },
  price: {
    ...TYPE.priceSm,
    color: T.ink,
    marginTop: 2,
  },
  actions: {
    gap: 8,
    alignItems: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: T.ink,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    minWidth: 96,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.ink4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    minWidth: 96,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: T.ink,
    fontWeight: '700',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    ...TYPE.body,
    color: T.ink3,
  },
})
