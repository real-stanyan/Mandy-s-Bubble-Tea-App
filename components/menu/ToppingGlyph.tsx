import { useRef } from 'react'
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg'
import type { ToppingIdentity } from '@/lib/menu/topping-identity'

// A topping's face, drawn — the same shape family the cup preview drops
// into the cup, at tile size. Pieces, not photos: Square has no images for
// modifiers, and a drawn pearl reads as a pearl at 20pt where a photo would
// be mud. Colours come from the identity table.

let seq = 0

type Props = { identity: ToppingIdentity; size?: number }

export function ToppingGlyph({ identity, size = 44 }: Props) {
  // Gradient ids must be unique per instance; a grid draws twenty of these.
  const uid = useRef(`tg${++seq}`).current
  const { glyph, color, edge, colors } = identity
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {glyph === 'pearl' && <Spheres color="#3B2317" gloss="#fff" />}
      {glyph === 'sphere' && <Spheres color={color} gloss="#fff" />}
      {glyph === 'pop' && <Popping color={color} uid={uid} />}
      {glyph === 'cube' && <Cubes colors={[color]} edge={edge} />}
      {glyph === 'rainbow' && <Cubes colors={colors ?? [color]} edge="rgba(0,0,0,0.18)" />}
      {glyph === 'aloe' && <Cubes colors={['#DCE8CE']} edge="#9FBF8A" rx={4} strokeWidth={1.2} />}
      {glyph === 'sago' && <Sago />}
      {glyph === 'crumb' && <Crumbs color={color} />}
      {glyph === 'pudding' && <Pudding />}
      {glyph === 'foam' && <Foam />}
      {glyph === 'brulee' && <Brulee uid={uid} />}
    </Svg>
  )
}

const TRIO: [number, number, number][] = [
  [13, 26, 9],
  [27, 26, 9],
  [20, 15, 9],
]

function Spheres({ color, gloss }: { color: string; gloss: string }) {
  return (
    <G>
      {TRIO.map(([x, y, r], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={r} fill={color} />
          <Ellipse
            cx={x - r * 0.32}
            cy={y - r * 0.38}
            rx={r * 0.3}
            ry={r * 0.18}
            fill={gloss}
            opacity={0.75}
            transform={`rotate(-25 ${x} ${y})`}
          />
        </G>
      ))}
    </G>
  )
}

function Popping({ color, uid }: { color: string; uid: string }) {
  const P: [number, number, number][] = [
    [12, 27, 8.5],
    [27, 25, 8.5],
    [20, 13, 8.5],
  ]
  return (
    <G>
      <Defs>
        <RadialGradient id={`${uid}g`} cx="35%" cy="30%" r="70%">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.6} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.15} />
        </RadialGradient>
      </Defs>
      {P.map(([x, y, r], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={r} fill={color} />
          <Circle cx={x} cy={y} r={r} fill={`url(#${uid}g)`} opacity={0.55} />
          <Circle cx={x - 3} cy={y - 3.5} r={2.2} fill="#fff" opacity={0.9} />
        </G>
      ))}
    </G>
  )
}

function Cubes({
  colors,
  edge,
  rx = 3,
  strokeWidth = 1,
}: {
  colors: string[]
  edge: string
  rx?: number
  strokeWidth?: number
}) {
  const P: [number, number, number][] = [
    [9, 15, -8],
    [22, 12, 6],
    [15, 26, -4],
  ]
  return (
    <G>
      {P.map(([x, y, rot], i) => (
        <G key={i} transform={`rotate(${rot} ${x + 7} ${y + 7})`}>
          <Rect x={x} y={y} width={14} height={14} rx={rx} fill={colors[i % colors.length]} stroke={edge} strokeWidth={strokeWidth} />
          <Rect x={x + 2} y={y + 2} width={10} height={4} rx={2} fill="#fff" opacity={0.35} />
        </G>
      ))}
    </G>
  )
}

function Sago() {
  const dots = Array.from({ length: 12 }, (_, i) => ({
    x: 8 + (i % 4) * 8,
    y: 12 + Math.floor(i / 4) * 8 + (i % 2) * 2,
  }))
  return (
    <G>
      {dots.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={3.4} fill="#EFE8DA" stroke="#D9CFB8" strokeWidth={0.8} />
      ))}
    </G>
  )
}

function Crumbs({ color }: { color: string }) {
  const C: [number, number, number, number, number][] = [
    [8, 14, 6, 4, 20],
    [18, 9, 7, 5, -15],
    [27, 16, 5, 4, 40],
    [12, 26, 5, 4, -30],
    [24, 27, 7, 5, 10],
    [32, 26, 4, 3, 60],
  ]
  return (
    <G>
      {C.map(([x, y, w, h, r], i) => (
        <Rect key={i} x={x} y={y} width={w} height={h} rx={1.2} fill={color} transform={`rotate(${r} ${x} ${y})`} />
      ))}
    </G>
  )
}

function Pudding() {
  return (
    <G>
      <Path d="M9 14 h22 l-3 18 h-16 z" fill="#F4CE6A" stroke="#D9AE4A" strokeWidth={1} />
      <Path d="M9 14 h22 l-1 6 h-20 z" fill="#C98A3C" />
      <Ellipse cx={20} cy={14} rx={11} ry={3} fill="#E0A557" />
      <Ellipse cx={16} cy={23} rx={3} ry={1.6} fill="#fff" opacity={0.45} />
    </G>
  )
}

function Foam() {
  return (
    <G>
      <Path d="M8 30 L10 16 H30 L32 30 Z" fill="#C8A681" />
      <Path
        d="M6 17 C8 8 16 6 20 10 C24 4 33 8 33 16 C36 17 34 22 30 21 H9 C6 21 5 18 6 17 Z"
        fill="#FBF1DF"
        stroke="#E8D7B8"
        strokeWidth={1}
      />
      <Ellipse cx={16} cy={13} rx={4} ry={2} fill="#fff" opacity={0.8} />
    </G>
  )
}

function Brulee({ uid }: { uid: string }) {
  return (
    <G>
      <Defs>
        <LinearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#fff" stopOpacity={0.25} />
          <Stop offset="1" stopColor="#000" stopOpacity={0.1} />
        </LinearGradient>
      </Defs>
      <Path d="M8 30 L10 16 H30 L32 30 Z" fill="#C8A681" />
      <Rect x={7} y={12} width={26} height={7} rx={3} fill="#E0A557" />
      <Rect x={7} y={12} width={26} height={7} rx={3} fill={`url(#${uid}b)`} />
      <Path d="M11 15 l4 2 M18 13 l3 4 M25 14 l4 3" stroke="#A96A26" strokeWidth={1.2} strokeLinecap="round" />
    </G>
  )
}
