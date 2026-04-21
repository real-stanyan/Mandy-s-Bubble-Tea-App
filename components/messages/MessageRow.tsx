import { Pressable, Text, View, StyleSheet } from 'react-native'
import { Icon, type IconName } from '@/components/brand/Icon'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import { brisbaneYMD } from '@/components/home/helpers'
import type { InboxEntry } from '@/hooks/use-message-events'

type OrderEntry = Extract<InboxEntry, { kind: 'order' }>

const STATE_DISPLAY: Record<
  OrderEntry['state'],
  { icon: IconName; iconColor: string; iconBg: string; title: string; bodySuffix: string }
> = {
  PLACED: {
    icon: 'clock',
    iconColor: '#92400e',
    iconBg: '#fde7c7',
    title: 'Order placed',
    bodySuffix: '',
  },
  READY: {
    icon: 'cafe',
    iconColor: '#14532d',
    iconBg: '#cdebd0',
    title: 'Your order is ready 🧋',
    bodySuffix: 'Pickup at Mandy\u2019s Bubble Tea',
  },
  COMPLETED: {
    icon: 'check',
    iconColor: '#2e5e2e',
    iconBg: '#d6e8d6',
    title: 'Order picked up',
    bodySuffix: 'Thanks!',
  },
}

function formatCents(cents: string): string {
  const n = Number(cents) / 100
  return `A$${n.toFixed(2)}`
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const nowDate = new Date()
  const dYMD = brisbaneYMD(d)
  const nowYMD = brisbaneYMD(nowDate)
  const time = d.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  })
  if (dYMD.y === nowYMD.y && dYMD.m === nowYMD.m && dYMD.d === nowYMD.d) return time
  const yesterdayDate = new Date(nowDate.getTime() - 24 * 60 * 60 * 1000)
  const yYMD = brisbaneYMD(yesterdayDate)
  if (dYMD.y === yYMD.y && dYMD.m === yYMD.m && dYMD.d === yYMD.d) return `Yesterday ${time}`
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function MessageRow({
  entry,
  onPress,
}: {
  entry: OrderEntry
  onPress: () => void
}) {
  const display = STATE_DISPLAY[entry.state]
  const refLabel = entry.referenceId ?? `#${entry.orderId.slice(-3)}`
  const bodyParts = [refLabel]
  if (entry.state === 'PLACED') bodyParts.push(formatCents(entry.totalCents))
  if (display.bodySuffix) bodyParts.push(display.bodySuffix)

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: display.iconBg }]}>
        <Icon name={display.icon} color={display.iconColor} size={18} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {display.title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {bodyParts.join(' · ')}
        </Text>
      </View>
      <Text style={styles.time}>{formatRelative(entry.timestamp)}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
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
  rowPressed: { opacity: 0.7 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { ...TYPE.bodyStrong, fontSize: 15, color: T.ink },
  subtitle: { ...TYPE.body, fontSize: 13, color: T.ink3 },
  time: { ...TYPE.body, fontSize: 12, color: T.ink3 },
})
