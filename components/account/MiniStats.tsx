import { memo } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { T, TYPE, RADIUS, SPACING } from '@/constants/theme'

interface Props {
  drinks: number
  rewards: number
  stars: number
  onPressDrinks?: () => void
  onPressRewards?: () => void
}

export const MiniStats = memo(function MiniStats({
  drinks,
  rewards,
  stars,
  onPressDrinks,
  onPressRewards,
}: Props) {
  return (
    <View style={styles.row}>
      <Tile n={drinks} label="Drinks" onPress={onPressDrinks} />
      <Tile n={rewards} label="Rewards" onPress={onPressRewards} />
      <Tile n={stars} label="Stars" />
    </View>
  )
})

function Tile({ n, label, onPress }: { n: number; label: string; onPress?: () => void }) {
  const content = (
    <>
      <Text style={styles.num}>{n}</Text>
      <Text style={styles.label}>{label}</Text>
    </>
  )

  if (!onPress) {
    return <View style={styles.tile}>{content}</View>
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${n} ${label}`}
    >
      {content}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  tile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: T.paper,
    borderRadius: RADIUS.tile,
    borderWidth: 1,
    borderColor: T.line,
  },
  tilePressed: {
    opacity: 0.75,
    backgroundColor: T.cream,
  },
  num: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    color: T.ink,
    lineHeight: 24,
  },
  label: {
    ...TYPE.eyebrow,
    color: T.ink3,
    marginTop: 4,
  },
})
