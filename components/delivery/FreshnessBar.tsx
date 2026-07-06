import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { T } from '@/constants/theme'
import { freshness, type FreshnessState } from '@/lib/delivery-freshness'

// Delivery-tracking accent colours (shared with the web design tokens).
const AMBER = '#C9A227'
const STALE_TEXT = '#8A6F1B'

export type FreshnessInfo = { label: string; state: FreshnessState }

/**
 * Live freshness derivation on a 10s tick — kept out of render (impure) so
 * the "x ago" copy stays honest, and shared by every surface that needs the
 * stale flag (chip, ETA tile, driver-card copy, map pin styling).
 */
export function useFreshness(
  hasDriver: boolean,
  locationUpdatedAt: string | null,
): FreshnessInfo {
  const [info, setInfo] = useState<FreshnessInfo>(() =>
    freshness(hasDriver, locationUpdatedAt, Date.now()),
  )
  useEffect(() => {
    const compute = () => setInfo(freshness(hasDriver, locationUpdatedAt, Date.now()))
    compute()
    const id = setInterval(compute, 10000)
    return () => clearInterval(id)
  }, [hasDriver, locationUpdatedAt])
  return info
}

export function freshnessDotColor(state: FreshnessState): string {
  // green = live/recent; amber = waiting-for-first-fix OR stream gone stale —
  // never a healthy green light behind a dead position.
  return state === 'live' || state === 'recent' ? T.green : AMBER
}

/**
 * Floating freshness chip. 4 states (waiting / live / recent / stale) with a
 * soft halo around the dot; stale flips the copy to a muted amber.
 */
export function FreshnessBar({
  hasDriver,
  locationUpdatedAt,
}: {
  hasDriver: boolean
  locationUpdatedAt: string | null
}) {
  const info = useFreshness(hasDriver, locationUpdatedAt)
  const dot = freshnessDotColor(info.state)
  const halo =
    dot === AMBER ? 'rgba(201,162,39,' : 'rgba(60,169,110,'

  return (
    <View style={styles.bar}>
      <View style={styles.dotWrap}>
        <View style={[styles.dotHalo, { backgroundColor: `${halo}0.18)` }]} />
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      <Text style={[styles.text, info.state === 'stale' && { color: STALE_TEXT }]}>
        {info.label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  dotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600', color: T.ink2 },
})
