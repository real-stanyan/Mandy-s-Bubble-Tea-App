import { StyleSheet, Text, View } from 'react-native'
import { T, FONT } from '@/constants/theme'

// Delivery-tracking accent (shared with web design tokens; not a theme color).
export const TRACKING_AMBER = '#C9A227'
export const TRACKING_AMBER_TEXT = '#A3841C'
export const TRACKING_STALE_TEXT = '#8A6F1B'

/**
 * White status pill with a glowing state dot ("Finding driver", "Live",
 * "Paused", …) — used on the delivery list cards and the tracker sheet title.
 * The breathing halo from the mockup is approximated with a static concentric
 * ring (design allows skipping the animation).
 */
export function StatusPill({ label, dot }: { label: string; dot: string }) {
  const halo = dot === TRACKING_AMBER ? 'rgba(201,162,39,' : 'rgba(60,169,110,'
  return (
    <View style={styles.pill}>
      <View style={styles.dotWrap}>
        <View style={[styles.dotHalo, { backgroundColor: `${halo}0.2)` }]} />
        <View style={[styles.dot, { backgroundColor: dot }]} />
      </View>
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 0,
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  dotWrap: { width: 14, height: 14, alignItems: 'center', justifyContent: 'center' },
  dotHalo: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: {
    fontFamily: FONT.sans,
    fontSize: 11,
    fontWeight: '700',
    color: T.ink2,
  },
})
