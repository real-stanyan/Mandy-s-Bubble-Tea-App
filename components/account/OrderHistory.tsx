import { memo, useCallback, useEffect, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { usePathname, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import { useCartStore } from '@/store/cart'
import { apiFetch } from '@/lib/api'
import type { CatalogItem } from '@/types/square'
import type {
  OrderHistoryItem,
  OrderHistoryLine,
} from '@/hooks/use-order-history'

// Module-level single-flight + in-memory cache for the catalog-name ->
// image-url map. OrderHistory is mounted on two tabs (Account + My
// Orders) and we don't want each mount to refetch /api/catalog (~1MB).
let catalogImageMap: Record<string, string> | null = null
let catalogFetchInFlight: Promise<Record<string, string>> | null = null
function fetchCatalogImageMap(): Promise<Record<string, string>> {
  if (catalogImageMap) return Promise.resolve(catalogImageMap)
  if (catalogFetchInFlight) return catalogFetchInFlight
  catalogFetchInFlight = apiFetch<{ items: CatalogItem[] }>('/api/catalog')
    .then((data) => {
      const map: Record<string, string> = {}
      for (const item of data.items ?? []) {
        const name = item.itemData?.name
        if (name && item.imageUrl) map[name] = item.imageUrl
      }
      catalogImageMap = map
      return map
    })
    .finally(() => {
      catalogFetchInFlight = null
    })
  return catalogFetchInFlight
}

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
  const [imageByName, setImageByName] = useState<Record<string, string>>(
    () => catalogImageMap ?? {},
  )

  useEffect(() => {
    if (catalogImageMap) return
    let cancelled = false
    fetchCatalogImageMap()
      .then((map) => {
        if (!cancelled) setImageByName(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
      const usable = order.lineItems.filter((l) => l.variationId)
      if (usable.length === 0) {
        Alert.alert('Unavailable', 'These items are no longer available.')
        return
      }
      replaceCart()
      for (const line of usable) {
        addItemLine(addItem, line)
      }
      router.push('/checkout')
    },
    [replaceCart, addItem, router],
  )

  if (orders.length === 0) {
    if (hideIfEmpty) return null
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={32} color="#ccc" />
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
        <Image source={{ uri: thumb }} style={styles.thumb} />
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

function addItemLine(
  add: ReturnType<typeof useCartStore.getState>['addItem'],
  line: OrderHistoryLine,
) {
  const modPrice = line.modifiers.reduce(
    (sum, m) => sum + Number(m.priceCents || '0'),
    0,
  )
  const unitPrice = Number(line.basePriceCents || '0') + modPrice
  const item = {
    id: line.itemId,
    variationId: line.variationId,
    name: line.name,
    variationName: line.variationName || undefined,
    price: unitPrice,
    imageUrl: line.imageUrl ?? undefined,
    modifiers: line.modifiers.map((m) => ({
      id: m.id,
      name: m.name,
      listName: m.listName,
      priceCents: Number(m.priceCents || '0'),
    })),
  }
  const qty = Math.max(1, line.quantity)
  for (let i = 0; i < qty; i++) add(item)
}

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
    fontSize: 18,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f5f1ea',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
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
  },
  subtitle: {
    fontSize: 12,
    color: '#7a7266',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: BRAND.color,
    marginTop: 2,
  },
  actions: {
    gap: 8,
    alignItems: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: BRAND.color,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 96,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d7d2c7',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    minWidth: 96,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#4a4a4a',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#aaa',
  },
})
