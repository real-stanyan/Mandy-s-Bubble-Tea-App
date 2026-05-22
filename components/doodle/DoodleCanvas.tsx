// components/doodle/DoodleCanvas.tsx
import { useMemo, useRef, useState } from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import type { SvgPath } from '@/lib/doodle/types'

// Square 400×400 vector canvas — matches the server-side cup-label middle
// band geometry (472×472 dots ≈ 40mm × 40mm on a 300 DPI Zebra ZD410).
// Vector units, not dots — server resvg renders our SVG paths into the
// 472-dot middle band. Keeping the app draw area square avoids clipping
// the lower half of the drawing on the printed sticker.
export const CANVAS_W = 400
export const CANVAS_H = 400

interface Props {
  paths: SvgPath[]
  brushWidth: number
  onPathsChange: (next: SvgPath[]) => void
  onDrawStart?: () => void
  onDrawEnd?: () => void
}

export function DoodleCanvas({ paths, brushWidth, onPathsChange, onDrawStart, onDrawEnd }: Props) {
  const [layout, setLayout] = useState<{ w: number; h: number }>({ w: 1, h: 1 })
  const currentPath = useRef<string>('')
  const [draftD, setDraftD] = useState<string>('')

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: e => {
          onDrawStart?.()
          const x = (e.nativeEvent.locationX / layout.w) * CANVAS_W
          const y = (e.nativeEvent.locationY / layout.h) * CANVAS_H
          currentPath.current = `M${x.toFixed(1)},${y.toFixed(1)}`
          setDraftD(currentPath.current)
        },
        onPanResponderMove: e => {
          const x = (e.nativeEvent.locationX / layout.w) * CANVAS_W
          const y = (e.nativeEvent.locationY / layout.h) * CANVAS_H
          currentPath.current += ` L${x.toFixed(1)},${y.toFixed(1)}`
          setDraftD(currentPath.current)
        },
        onPanResponderRelease: () => {
          if (currentPath.current && currentPath.current.includes('L')) {
            onPathsChange([
              ...paths,
              { d: currentPath.current, stroke: '#000', width: brushWidth },
            ])
          }
          currentPath.current = ''
          setDraftD('')
          onDrawEnd?.()
        },
        onPanResponderTerminate: () => {
          currentPath.current = ''
          setDraftD('')
          onDrawEnd?.()
        },
      }),
    [layout.w, layout.h, paths, brushWidth, onPathsChange, onDrawStart, onDrawEnd],
  )

  return (
    <View
      style={styles.box}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout
        setLayout({ w: width || 1, h: height || 1 })
      }}
      {...responder.panHandlers}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {paths.map((p, i) => (
          <Path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {draftD ? (
          <Path
            d={draftD}
            stroke="#000"
            strokeWidth={brushWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    aspectRatio: CANVAS_W / CANVAS_H,
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
})
