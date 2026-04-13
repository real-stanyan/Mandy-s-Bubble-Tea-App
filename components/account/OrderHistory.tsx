import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'
import type { OrderHistoryItem } from '@/hooks/use-order-history'

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: 'Completed', color: '#15803d' },
  OPEN: { label: 'In Progress', color: '#d97706' },
  CANCELED: { label: 'Cancelled', color: '#dc2626' },
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return d.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

interface Props {
  orders: OrderHistoryItem[]
}

export function OrderHistory({ orders }: Props) {
  const router = useRouter()

  if (orders.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="receipt-outline" size={32} color="#ccc" />
        <Text style={styles.emptyText}>No orders yet</Text>
      </View>
    )
  }

  const handlePress = (order: OrderHistoryItem) => {
    router.push({
      pathname: '/order-detail',
      params: {
        orderId: order.id,
        createdAt: order.createdAt ?? '',
        state: order.state ?? '',
        totalCents: order.totalCents,
        itemSummary: order.itemSummary,
        lineCount: String(order.lineCount),
      },
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Order History</Text>
      {orders.map((order) => {
        const stateInfo = STATE_LABELS[order.state ?? ''] ?? {
          label: order.state ?? 'Unknown',
          color: '#888',
        }
        return (
          <TouchableOpacity
            key={order.id}
            style={styles.card}
            onPress={() => handlePress(order)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <Text style={styles.date}>{formatDate(order.createdAt)}</Text>
              <View style={[styles.badge, { backgroundColor: stateInfo.color + '18' }]}>
                <Text style={[styles.badgeText, { color: stateInfo.color }]}>
                  {stateInfo.label}
                </Text>
              </View>
            </View>
            <Text style={styles.items} numberOfLines={2}>
              {order.itemSummary}
            </Text>
            <View style={styles.cardBottom}>
              <Text style={styles.total}>{formatCents(order.totalCents)}</Text>
              <View style={styles.cardRight}>
                <Text style={styles.itemCount}>
                  {order.lineCount} item{order.lineCount !== 1 ? 's' : ''}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 8,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  items: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  total: {
    fontSize: 16,
    fontWeight: '700',
    color: BRAND.color,
  },
  itemCount: {
    fontSize: 12,
    color: '#aaa',
  },
  // Empty state
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
