import { memo, useState } from 'react'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

// A soft spot of light: one radial gradient in an ellipse the size of the
// box, falling off like a real glow — a bell with a long soft edge, not a
// cone. It is a drawing that never changes: react-native-svg on Android
// rasterises a whole <Svg> in software on every change to any part of it
// (lib/motion/ambient, SVG_MOTION), so whatever should move, breathe or
// follow moves the view that holds this, and the drawing is made once.

/** Where along the radius (percent) → the share of the centre's light:
 *  close to a Gaussian, so the light has a body and fades out long. */
const FALLOFF: readonly (readonly [number, number])[] = [
  [0, 1],
  [18, 0.92],
  [36, 0.7],
  [54, 0.42],
  [72, 0.18],
  [88, 0.05],
  [100, 0],
]

let seq = 0

type Props = {
  width: number
  height: number
  color: string
  /** Opacity at the centre; the edge is always clear. */
  alpha: number
}

export const GlowBlob = memo(function GlowBlob({ width, height, color, alpha }: Props) {
  const [id] = useState(() => `glow${++seq}`)
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          {FALLOFF.map(([at, share]) => (
            <Stop key={at} offset={`${at}%`} stopColor={color} stopOpacity={alpha * share} />
          ))}
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  )
})
