import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CARD_INFO_H, GRID_GAP, GRID_PAD, SECTION_CARD_H, gridMetrics } from '@/lib/menu/grid'
import { RAIL_H } from '@/components/menu/CategoryRail'
import { HEADER_BLOCK_H, HEADER_ROW_H } from '@/components/menu/MenuHeader'
import { T, RADIUS } from '@/constants/theme'

// The menu before the catalog arrives: the head, the rail and two rows of
// cards drawn in the same geometry as the real thing (lib/menu/grid), so the
// grid lands on top of its own outline instead of reflowing the page.

function usePulse() {
  const opacity = useRef(new Animated.Value(0.35)).current
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 800, useNativeDriver: true }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])
  return opacity
}

function Bone({ style }: { style: object }) {
  const opacity = usePulse()
  return <Animated.View style={[styles.bone, style, { opacity }]} />
}

/** One card outline: the photo square and two lines under it. */
function SkeletonCard({ width, thumbH }: { width: number; thumbH: number }) {
  return (
    <View style={[styles.card, { width, height: thumbH + CARD_INFO_H }]}>
      <Bone style={{ width: '100%', height: thumbH - 2, borderRadius: 0 }} />
      <View style={styles.cardInfo}>
        <Bone style={{ width: '78%', height: 14 }} />
        <Bone style={{ width: '46%', height: 14 }} />
        <View style={styles.cardPriceRow}>
          <Bone style={{ width: 48, height: 14 }} />
          <Bone style={{ width: 32, height: 32, borderRadius: 16 }} />
        </View>
      </View>
    </View>
  )
}

function SkeletonRows({ width, thumbH, rows }: { width: number; thumbH: number; rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.gridRow}>
          <SkeletonCard width={width} thumbH={thumbH} />
          <SkeletonCard width={width} thumbH={thumbH} />
        </View>
      ))}
    </>
  )
}

/** Full-page skeleton in the menu's own geometry: head + rail + grid. */
export function SkeletonSection() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const m = gridMetrics(width)
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <Bone style={{ width: 132, height: 10 }} />
        <Bone style={{ width: 128, height: 30, borderRadius: 999 }} />
      </View>
      <View style={styles.block}>
        <Bone style={{ width: 118, height: 34, borderRadius: 10 }} />
        <Bone style={{ marginTop: 16, width: '100%', height: 44, borderRadius: RADIUS.tile }} />
      </View>
      <View style={styles.rail}>
        {[84, 64, 76, 118, 96].map((w, i) => (
          <Bone key={i} style={{ width: w, height: 34, borderRadius: 999 }} />
        ))}
      </View>
      <Bone style={styles.sectionCard} />
      <SkeletonRows width={m.cardW} thumbH={m.thumbH} rows={2} />
    </View>
  )
}

// Old export name, kept for anything still importing it.
export { SkeletonCard }

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
    overflow: 'hidden',
  },
  bone: {
    backgroundColor: T.line,
    borderRadius: 6,
  },
  row: {
    height: HEADER_ROW_H,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  block: {
    height: HEADER_BLOCK_H,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  rail: {
    height: RAIL_H,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionCard: {
    marginHorizontal: GRID_PAD,
    marginTop: 24,
    marginBottom: 8,
    height: SECTION_CARD_H,
    borderRadius: RADIUS.card,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  card: {
    borderRadius: RADIUS.card - 2,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    overflow: 'hidden',
  },
  cardInfo: {
    height: CARD_INFO_H,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 8,
  },
  cardPriceRow: {
    marginTop: 'auto',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
})
