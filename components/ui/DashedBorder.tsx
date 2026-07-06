import { useState } from 'react'
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native'
import Svg, { Rect } from 'react-native-svg'

/**
 * True dashed border overlay drawn with react-native-svg.
 *
 * Fabric (RN new architecture) renders `borderStyle: 'dashed'` as a SOLID
 * line and logs a warning — the repo has 6 legacy occurrences and we must not
 * add more. This draws a real dashed rounded rect on top of the host view
 * instead. Absolutely positioned + pointerEvents none; parent needs
 * position 'relative' (RN default) and the visual radius should match.
 */
export function DashedBorder({
  radius = 12,
  color = 'rgba(42,30,20,0.26)',
  strokeWidth = 1.5,
  dash = '5 5',
}: {
  radius?: number
  color?: string
  strokeWidth?: number
  dash?: string
}) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout
    setSize({ w: width, h: height })
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      {size.w > 0 && size.h > 0 ? (
        <Svg width={size.w} height={size.h}>
          <Rect
            x={strokeWidth / 2}
            y={strokeWidth / 2}
            width={size.w - strokeWidth}
            height={size.h - strokeWidth}
            rx={Math.min(radius, (Math.min(size.w, size.h) - strokeWidth) / 2)}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            fill="none"
          />
        </Svg>
      ) : null}
    </View>
  )
}
