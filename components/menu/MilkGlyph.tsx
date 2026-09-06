import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg'
import type { MilkIdentity } from '@/lib/menu/milk-identity'

// A milk's face: a gable-top carton in its own colours with a small icon on
// the label band (a star for the house blend, a bean, an oat spike, an
// almond), or a glass bottle for plain fresh milk. Drawn, like the topping
// glyphs — Square has no images for modifiers.

type Props = { identity: MilkIdentity; size?: number }

const OUTLINE = 'rgba(42,30,20,0.35)'
const FOLD = 'rgba(42,30,20,0.25)'

export function MilkGlyph({ identity, size = 38 }: Props) {
  const { glyph, body, band } = identity
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {glyph === 'bottle' ? <Bottle cap={band} /> : <Carton body={body} band={band} glyph={glyph} />}
    </Svg>
  )
}

function Carton({ body, band, glyph }: { body: string; band: string; glyph: MilkIdentity['glyph'] }) {
  return (
    <G>
      <Path
        d="M11 12 L20 6 L29 12 V33 a2 2 0 0 1 -2 2 H13 a2 2 0 0 1 -2 -2 Z"
        fill={body}
        stroke={OUTLINE}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Path d="M11 12 H29" stroke={FOLD} strokeWidth={1} />
      <Path d="M20 6 V12" stroke={FOLD} strokeWidth={1} />
      <Rect x={11} y={18} width={18} height={7} fill={band} opacity={0.9} />
      {glyph === 'blend' && (
        <Path d="M20 19.5 l1.3 2.7 3 .4 -2.2 2.1 .5 3 -2.6 -1.4 -2.6 1.4 .5 -3 -2.2 -2.1 3 -.4z" fill="#fff" />
      )}
      {glyph === 'soy' && (
        <G fill="#fff">
          <Ellipse cx={17.5} cy={21.5} rx={3} ry={2} rotation={-20} origin="17.5, 21.5" />
          <Ellipse cx={23} cy={21.5} rx={3} ry={2} rotation={-20} origin="23, 21.5" />
        </G>
      )}
      {glyph === 'oat' && (
        <G fill="#fff">
          <Path d="M20 26 V18" stroke="#fff" strokeWidth={1.4} />
          <Ellipse cx={17.5} cy={20} rx={1.6} ry={2.4} rotation={-30} origin="17.5, 20" />
          <Ellipse cx={22.5} cy={20} rx={1.6} ry={2.4} rotation={30} origin="22.5, 20" />
          <Ellipse cx={18} cy={23.5} rx={1.6} ry={2.4} rotation={-30} origin="18, 23.5" />
          <Ellipse cx={22} cy={23.5} rx={1.6} ry={2.4} rotation={30} origin="22, 23.5" />
        </G>
      )}
      {glyph === 'almond' && (
        <G rotation={20} origin="20, 21.5">
          <Ellipse cx={20} cy={21.5} rx={2.6} ry={3.6} fill="#fff" />
          <Path d="M19 19 q1 2 1 5" stroke={band} strokeWidth={0.8} fill="none" />
        </G>
      )}
      {glyph === 'coconut' && (
        <G>
          <Circle cx={20} cy={21.5} r={3} fill="#fff" />
          <Circle cx={19} cy={20.6} r={0.6} fill={band} />
          <Circle cx={21} cy={20.6} r={0.6} fill={band} />
          <Circle cx={20} cy={22.4} r={0.6} fill={band} />
        </G>
      )}
    </G>
  )
}

function Bottle({ cap }: { cap: string }) {
  return (
    <G>
      <Path
        d="M16 7 h8 v4 c3 2 4 4 4 7 v13 a3 3 0 0 1 -3 3 H15 a3 3 0 0 1 -3 -3 V18 c0 -3 1 -5 4 -7 Z"
        fill="#FFFFFF"
        stroke={OUTLINE}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Rect x={15} y={5} width={10} height={3.5} rx={1} fill={cap} />
      <Path d="M13 22 c0 -2 1 -3 3 -4 h8 c2 1 3 2 3 4 v9 H13 Z" fill="#F7F3EA" />
      <Ellipse cx={17} cy={20} rx={2} ry={4} fill="#fff" opacity={0.9} />
    </G>
  )
}
