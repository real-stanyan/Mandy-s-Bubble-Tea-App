import { View, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated'
import { LOYALTY } from '@/lib/constants'

interface Props {
  current: number
}

export function StarsProgress({ current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: LOYALTY.starsForReward }).map((_, i) => (
        <Segment key={i} filled={i < current} />
      ))}
    </View>
  )
}

function Segment({ filled }: { filled: boolean }) {
  const animStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? '#fff' : 'rgba(255,255,255,0.25)', {
      duration: 300,
    }),
  }))

  return <Animated.View style={[styles.segment, animStyle]} />
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    marginVertical: 12,
  },
  segment: {
    flex: 1,
    height: 8,
    borderRadius: 4,
  },
})
