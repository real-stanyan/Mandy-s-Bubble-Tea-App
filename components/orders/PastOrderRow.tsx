import { View, Text, Pressable, StyleSheet } from 'react-native'
import { CupArt } from '@/components/brand/CupArt'
import { Icon } from '@/components/brand/Icon'
import { hashColor } from '@/components/brand/color'
import { T, FONT } from '@/constants/theme'
import { placedRelative } from '@/components/orders/time'
import type { OrderHistoryItem } from '@/store/orders'

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return `#${order.referenceId}`
  return `#${order.id.slice(-6).toUpperCase()}`
}

function itemsSummary(order: OrderHistoryItem): string {
  if (order.lineItems.length === 0) return order.itemSummary || 'Order'
  return order.lineItems
    .map((l) => `${l.quantity}× ${l.name}`)
    .join(', ')
}

interface Props {
  order: OrderHistoryItem
  onOpen: (order: OrderHistoryItem) => void
  onReorder: (order: OrderHistoryItem) => void
}

export function PastOrderRow({ order, onOpen, onReorder }: Props) {
  const thumbColor = hashColor(order.firstItemName || order.id)

  return (
    <Pressable
      onPress={() => onOpen(order)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.thumb}>
        <CupArt fill={thumbColor} stroke={T.ink} size={28} />
      </View>

      <View style={styles.middle}>
        <View style={styles.metaRow}>
          <Text style={styles.ref}>{referenceLabel(order)}</Text>
          <Text style={styles.time}>{placedRelative(order.createdAt)}</Text>
        </View>
        <Text style={styles.items} numberOfLines={1}>
          {itemsSummary(order)}
        </Text>
      </View>

      <View style={styles.right}>
        <Text style={styles.price}>{formatCents(order.totalCents)}</Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation()
            onReorder(order)
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.reorderBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.reorderText}>Reorder</Text>
          <Icon name="arrow" color={T.brand} size={10} />
        </Pressable>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#f1ebe4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  ref: {
    fontFamily: FONT.mono,
    fontSize: 11,
    color: T.ink3,
    letterSpacing: 0.3,
  },
  time: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    color: T.ink3,
  },
  items: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 18,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  price: {
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
  },
  reorderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  reorderText: {
    fontFamily: FONT.sans,
    fontSize: 11,
    fontWeight: '700',
    color: T.brand,
  },
})
