import { View, Text, FlatList, StyleSheet } from 'react-native'
import type { LoyaltyEvent } from '@/types/square'

interface Props {
  events: LoyaltyEvent[]
}

export function ActivityHistory({ events }: Props) {
  if (events.length === 0) return null

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Recent Activity</Text>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        scrollEnabled={false}
        renderItem={({ item }) => {
          const isAccumulate = item.type === 'ACCUMULATE_POINTS'
          const points = item.accumulatePoints?.points
          const date = new Date(item.createdAt).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
          })
          return (
            <View style={styles.row}>
              <Text style={styles.icon}>{isAccumulate ? '⭐' : '🎁'}</Text>
              <View style={styles.info}>
                <Text style={styles.eventText}>
                  {isAccumulate
                    ? `Earned ${points} star${points !== 1 ? 's' : ''}`
                    : 'Redeemed free drink'}
                </Text>
                <Text style={styles.date}>{date}</Text>
              </View>
              {isAccumulate && points != null ? (
                <Text style={styles.points}>+{points}</Text>
              ) : null}
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginTop: 24, paddingHorizontal: 16 },
  heading: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  icon: { fontSize: 20 },
  info: { flex: 1 },
  eventText: { fontSize: 15 },
  date: { fontSize: 13, color: '#888', marginTop: 2 },
  points: { fontSize: 16, fontWeight: '600', color: '#2e7d32' },
})
