import { View, Text, Pressable, StyleSheet } from 'react-native'
import { T, FONT } from '@/constants/theme'

export type OrdersFilter = 'all' | 'active' | 'past'

interface Pill {
  key: OrdersFilter
  label: string
}

function pills(activeCount: number): Pill[] {
  return [
    { key: 'all', label: 'All' },
    { key: 'active', label: `Active (${activeCount})` },
    { key: 'past', label: 'Past' },
  ]
}

interface Props {
  value: OrdersFilter
  activeCount: number
  onChange: (filter: OrdersFilter) => void
}

export function OrdersFilterPills({ value, activeCount, onChange }: Props) {
  return (
    <View style={styles.row}>
      {pills(activeCount).map((p) => {
        const selected = value === p.key
        return (
          <Pressable
            key={p.key}
            onPress={() => onChange(p.key)}
            style={({ pressed }) => [
              styles.pill,
              selected ? styles.pillActive : styles.pillInactive,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text
              style={[
                styles.label,
                { color: selected ? T.cream : T.ink2 },
              ]}
            >
              {p.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: T.ink,
    borderColor: T.ink,
  },
  pillInactive: {
    backgroundColor: 'transparent',
    borderColor: T.line,
  },
  label: {
    fontFamily: FONT.sans,
    fontSize: 12.5,
    fontWeight: '600',
  },
})
