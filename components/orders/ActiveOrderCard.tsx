import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { CupArt } from '@/components/brand/CupArt'
import { Icon } from '@/components/brand/Icon'
import { hashColor } from '@/components/brand/color'
import { T, FONT, SHADOW } from '@/constants/theme'
import { placedRelative } from '@/components/orders/time'
import { StatusTimeline, type TimelineStatus } from '@/components/orders/StatusTimeline'
import type { OrderHistoryItem, OrderHistoryLine, OrderHistoryLineModifier } from '@/store/orders'

function formatCents(cents: string | number): string {
  const n = typeof cents === 'string' ? Number(cents) / 100 : cents / 100
  return `A$${n.toFixed(2)}`
}

function referenceLabel(order: OrderHistoryItem): string {
  if (order.referenceId) return `#${order.referenceId}`
  return `#${order.id.slice(-6).toUpperCase()}`
}

// Group modifiers by listName the same way CartItem does. Returns a
// dot-joined summary like "Size: Large 700ml · Sugar: 50%".
function modifierSummary(line: OrderHistoryLine): string {
  if (line.modifiers.length === 0) {
    return line.variationName || ''
  }
  const groups = new Map<string, string[]>()
  for (const m of line.modifiers) {
    const bucket = groups.get(m.listName) ?? []
    bucket.push(m.name)
    groups.set(m.listName, bucket)
  }
  const parts: string[] = []
  if (line.variationName) parts.push(line.variationName)
  for (const [list, names] of groups) {
    parts.push(`${list}: ${names.join(', ')}`)
  }
  return parts.join(' · ')
}

// Line items have quantity ≥ 1. Our cart store dedupes by lineId but
// still carries each add as quantity 1; orders API aggregates. Show
// quantity only when > 1 to avoid visual clutter.
function lineQtyLabel(line: OrderHistoryLine): string {
  return line.quantity > 1 ? `${line.quantity}× ${line.name}` : line.name
}

function lineUnitPrice(line: OrderHistoryLine): number {
  const mods = line.modifiers.reduce(
    (sum: number, m: OrderHistoryLineModifier) => sum + Number(m.priceCents || '0'),
    0,
  )
  return (Number(line.basePriceCents || '0') + mods) * line.quantity
}

interface Props {
  order: OrderHistoryItem
  status: TimelineStatus
  onTrack: (order: OrderHistoryItem) => void
}

export function ActiveOrderCard({ order, status, onTrack }: Props) {
  const ready = status === 'READY'

  const eyebrowColor = ready ? 'rgba(255,255,255,0.75)' : T.brand
  const textColor = ready ? '#fff' : T.ink
  const subTextColor = ready ? 'rgba(255,255,255,0.85)' : T.ink3
  const dashedColor = ready ? 'rgba(255,255,255,0.3)' : T.line
  const footerBorderColor = ready ? 'rgba(255,255,255,0.25)' : T.line
  const pillBg = ready ? 'rgba(255,255,255,0.2)' : 'rgba(141,85,36,0.12)'
  const pillText = ready ? '#fff' : T.brand
  const tileBg = ready ? 'rgba(255,255,255,0.18)' : '#f1ebe4'
  const priceColor = ready ? '#fff' : T.ink2

  const shell = (
    <>
      <View style={styles.header}>
        <View style={styles.headerMain}>
          <Text style={[styles.eyebrow, { color: eyebrowColor }]}>
            {ready ? 'READY FOR PICKUP' : 'IN PROGRESS'}
          </Text>
          <Text style={[styles.title, { color: textColor }]}>
            Order {referenceLabel(order)}
          </Text>
          <Text style={[styles.meta, { color: subTextColor }]}>
            Placed {placedRelative(order.createdAt)} · {order.lineCount}
            {' '}
            {order.lineCount === 1 ? 'item' : 'items'}
          </Text>
        </View>

        <View style={[styles.statusPill, { backgroundColor: pillBg }]}>
          <Icon name="clock" color={pillText} size={12} />
          <Text style={[styles.statusPillText, { color: pillText }]}>
            {ready ? 'Now' : 'Preparing'}
          </Text>
        </View>
      </View>

      {!ready ? <StatusTimeline status={status} /> : null}

      <View style={[styles.items, { borderTopColor: dashedColor }]}>
        {order.lineItems.map((line, i) => (
          <View key={`${line.variationId}-${i}`} style={styles.itemRow}>
            <View style={[styles.itemTile, { backgroundColor: tileBg }]}>
              <CupArt
                fill={hashColor(line.name)}
                stroke={ready ? '#fff' : T.ink}
                size={22}
              />
            </View>
            <View style={styles.itemMain}>
              <Text style={[styles.itemName, { color: textColor }]} numberOfLines={1}>
                {lineQtyLabel(line)}
              </Text>
              {modifierSummary(line) ? (
                <Text
                  style={[styles.itemMods, { color: subTextColor }]}
                  numberOfLines={1}
                >
                  {modifierSummary(line)}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.itemPrice, { color: priceColor }]}>
              {formatCents(lineUnitPrice(line))}
            </Text>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { borderTopColor: footerBorderColor }]}>
        <View>
          <Text style={[styles.totalLabel, { color: subTextColor }]}>TOTAL</Text>
          <Text style={[styles.totalValue, { color: textColor }]}>
            {formatCents(order.totalCents)}
          </Text>
        </View>
        <Pressable
          onPress={() => onTrack(order)}
          style={({ pressed }) => [
            styles.cta,
            ready ? styles.ctaReady : styles.ctaPreparing,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text
            style={[
              styles.ctaText,
              { color: ready ? T.greenDark : '#fff' },
            ]}
          >
            {ready ? 'Show pickup' : 'Track order'}
          </Text>
          <Icon
            name={ready ? 'qr' : 'arrow'}
            color={ready ? T.greenDark : '#fff'}
            size={ready ? 14 : 12}
          />
        </Pressable>
      </View>
    </>
  )

  if (ready) {
    return (
      <View style={[styles.container, iosShadow('readyCard')]}>
        <LinearGradient
          colors={[T.sage, '#8CA07D']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {shell}
        </LinearGradient>
      </View>
    )
  }

  return (
    <View style={[styles.container, styles.paperCard, iosShadow('card')]}>
      {shell}
    </View>
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
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 4,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 4,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    letterSpacing: -0.5,
    lineHeight: 26,
  },
  meta: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginLeft: 8,
    flexShrink: 0,
  },
  statusPillText: {
    fontFamily: FONT.sans,
    fontSize: 11.5,
    fontWeight: '700',
  },
  items: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    marginTop: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  itemTile: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontFamily: FONT.sans,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 16,
  },
  itemMods: {
    marginTop: 1,
    fontFamily: FONT.sans,
    fontSize: 11,
  },
  itemPrice: {
    fontFamily: FONT.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalLabel: {
    fontFamily: FONT.sans,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  totalValue: {
    fontFamily: FONT.mono,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  ctaPreparing: {
    backgroundColor: T.brand,
  },
  ctaReady: {
    backgroundColor: '#fff',
  },
  ctaText: {
    fontFamily: FONT.sans,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
})
