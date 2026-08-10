import { memo, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS, SPACING } from '@/constants/theme'
import { LOYALTY } from '@/lib/constants'
import type { LoyaltyEvent } from '@/types/square'

interface Props {
  events: LoyaltyEvent[]
}

const COLLAPSED_LIMIT = 5

export const ActivityHistory = memo(function ActivityHistory({ events }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (events.length === 0) return null

  const canExpand = events.length > COLLAPSED_LIMIT
  const visible = expanded ? events : events.slice(0, COLLAPSED_LIMIT)

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.headLabel}>Activity</Text>
        {canExpand ? (
          <TouchableOpacity
            onPress={() => setExpanded((v) => !v)}
            activeOpacity={0.6}
            hitSlop={8}
          >
            <Text style={styles.headAction}>{expanded ? 'Show less' : 'All'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.card}>
        {visible.map((item, i) => {
          const isAccumulate = item.type === 'ACCUMULATE_POINTS'
          const points = item.accumulatePoints?.points ?? 0
          const delta = isAccumulate ? points : -LOYALTY.starsForReward
          const label = isAccumulate
            ? `Earned ${points} star${points === 1 ? '' : 's'}`
            : 'Free drink redeemed'
          const when = formatWhen(item.createdAt)
          return (
            <View
              key={item.id}
              style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.line }]}
            >
              <View
                style={[
                  styles.iconTile,
                  { backgroundColor: isAccumulate ? 'rgba(141,85,36,0.10)' : 'rgba(242,182,74,0.25)' },
                ]}
              >
                <Icon
                  name={isAccumulate ? 'star' : 'gift'}
                  color={isAccumulate ? T.brand : T.star}
                  size={16}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.label} numberOfLines={1}>{label}</Text>
                <Text style={styles.when}>{when}</Text>
              </View>
              <Text style={[styles.delta, { color: delta > 0 ? T.brand : T.ink2 }]}>
                {delta > 0 ? '+' : ''}{delta} ★
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
})

function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })
  const yest = new Date(now.getTime() - 86_400_000)
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  headLabel: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
  },
  headAction: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 12.5,
    color: T.brand,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconTile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 13.5,
    color: T.ink,
    lineHeight: 16,
  },
  when: {
    fontSize: 11.5,
    color: T.ink3,
    marginTop: 2,
    fontFamily: 'ShantellSans_400Regular',
  },
  delta: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 13,
  },
})
