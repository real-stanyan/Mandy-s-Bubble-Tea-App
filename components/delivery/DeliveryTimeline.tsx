import { View, Text, StyleSheet } from 'react-native'
import { Icon } from '@/components/brand/Icon'
import { T, FONT } from '@/constants/theme'
import { DELIVERY_STEPS, stepVisual, type DeliveryTone } from '@/lib/dispatch-steps'

// Amber is a delivery-tracking-only accent (matching driver / paused states)
// mirrored from the web design tokens — deliberately not in constants/theme.
const AMBER = '#C9A227'
const AMBER_TEXT = '#A3841C'

function toneColors(tone: DeliveryTone) {
  return tone === 'green'
    ? { fill: T.green, text: T.greenDark, halo: 'rgba(60,169,110,' }
    : { fill: AMBER, text: AMBER_TEXT, halo: 'rgba(201,162,39,' }
}

interface Props {
  // Index of the current (highest reached) step, 0-3. Steps below render done.
  stepIndex: number
  tone: DeliveryTone
  // Terminal: every step (incl. the last) renders as done — S7's 4/4 stepper.
  completed?: boolean
  // Tighter geometry for the full-screen tracker sheet (S4/S5).
  compact?: boolean
}

/**
 * 4-step delivery stepper (PLACED → ACCEPTED → PICKED UP → DELIVERED).
 * Current step = tone-filled node with a concentric glow + white core dot;
 * completed steps = tone-filled with a check; connectors fill with progress.
 */
export function DeliveryTimeline({ stepIndex, tone, completed = false, compact = false }: Props) {
  const c = toneColors(tone)
  const node = compact ? 19 : 22
  const checkSize = compact ? 10 : 12

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {DELIVERY_STEPS.map((label, i) => {
        const { done, active: isActive, barLit } = stepVisual(i, stepIndex, completed)
        const lit = done || isActive
        return (
          <View key={label} style={i < DELIVERY_STEPS.length - 1 ? styles.segment : styles.segmentLast}>
            <View style={styles.stepCol}>
              <View style={[styles.nodeWrap, { width: node, height: node }]}>
                {isActive ? (
                  <>
                    <View
                      style={[
                        styles.halo,
                        {
                          width: node + 16,
                          height: node + 16,
                          borderRadius: (node + 16) / 2,
                          backgroundColor: `${c.halo}0.08)`,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.halo,
                        {
                          width: node + 8,
                          height: node + 8,
                          borderRadius: (node + 8) / 2,
                          backgroundColor: `${c.halo}0.18)`,
                        },
                      ]}
                    />
                  </>
                ) : null}
                <View
                  style={[
                    styles.node,
                    {
                      width: node,
                      height: node,
                      borderRadius: node / 2,
                      backgroundColor: lit ? c.fill : '#fff',
                      borderColor: lit ? c.fill : 'rgba(42,30,20,0.16)',
                    },
                  ]}
                >
                  {done ? (
                    <Icon name="check" color="#fff" size={checkSize} />
                  ) : isActive ? (
                    <View style={styles.core} />
                  ) : null}
                </View>
              </View>
              <Text
                style={[
                  styles.label,
                  compact && styles.labelCompact,
                  { color: isActive ? c.text : done ? T.ink2 : T.ink3 },
                ]}
              >
                {label.toUpperCase()}
              </Text>
            </View>
            {i < DELIVERY_STEPS.length - 1 ? (
              <View
                style={[
                  styles.bar,
                  { marginTop: node / 2 - 1.5 },
                  { backgroundColor: barLit ? c.fill : 'rgba(42,30,20,0.12)' },
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
    alignItems: 'flex-start',
    marginTop: 15,
  },
  rowCompact: {
    marginTop: 12,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  segmentLast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepCol: {
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
    minWidth: 52,
    zIndex: 1,
  },
  nodeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    alignSelf: 'center',
  },
  node: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#fff',
  },
  label: {
    fontFamily: FONT.mono,
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textAlign: 'center',
    lineHeight: 11,
  },
  labelCompact: {
    fontSize: 8,
    lineHeight: 10,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: -12,
    minWidth: 8,
  },
})
