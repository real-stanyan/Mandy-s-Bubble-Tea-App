import { View, Text, StyleSheet } from 'react-native'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'

export type TimelineStatus = 'OPEN' | 'PREPARING' | 'READY'

interface Step {
  key: TimelineStatus
  label: string
}

const STEPS: Step[] = [
  { key: 'OPEN', label: 'Received' },
  { key: 'PREPARING', label: 'Preparing' },
  { key: 'READY', label: 'Ready' },
]

function statusIndex(status: TimelineStatus): number {
  return STEPS.findIndex((s) => s.key === status)
}

interface Props {
  status: TimelineStatus
}

export function StatusTimeline({ status }: Props) {
  const idx = statusIndex(status)

  return (
    <View style={styles.row}>
      {STEPS.map((step, i) => {
        const done = idx >= i
        const nextDone = idx >= i + 1
        return (
          <View key={step.key} style={styles.stepGroup}>
            <View style={styles.stepCol}>
              <View
                style={[
                  styles.circle,
                  {
                    backgroundColor: done ? T.brand : 'transparent',
                    borderColor: done ? T.brand : T.ink4,
                  },
                ]}
              >
                {done ? <Icon name="check" color="#fff" size={12} /> : null}
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: done ? T.ink : T.ink3,
                    fontWeight: done ? '700' : '500',
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
            {i < STEPS.length - 1 ? (
              <View
                style={[
                  styles.bar,
                  { backgroundColor: nextDone ? T.brand : T.ink4 },
                ]}
              />
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  stepGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  stepCol: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  circle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FONT.sans,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  bar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    marginTop: -14,
    marginHorizontal: 2,
  },
})
