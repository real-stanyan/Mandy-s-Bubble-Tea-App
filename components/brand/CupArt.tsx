import React from 'react';
import Svg, { Rect, Path, Circle } from 'react-native-svg';
import { T } from '@/constants/theme';

export type CupArtProps = {
  fill?: string;
  stroke?: string;
  size?: number;
  filled?: boolean;
};

// Cup illustration with a straw and tapioca pearls. Matches the reference
// design's CupArt SVG (reference/src/shared.jsx).
export function CupArt({
  fill = T.brand,
  stroke = T.ink,
  size = 80,
  filled = true,
}: CupArtProps) {
  const h = size * 1.3;
  const pearls: [number, number][] = [
    [28, 78], [38, 84], [50, 80], [34, 90], [48, 92], [42, 72],
  ];
  return (
    <Svg width={size} height={h} viewBox="0 0 80 104">
      {/* straw */}
      <Rect x={42} y={2} width={5} height={28} rx={1.5} fill={stroke} transform="rotate(10 44 15)" />
      {/* lid */}
      <Rect x={4} y={16} width={72} height={9} rx={2.5} fill={stroke} />
      {/* cup body */}
      <Path
        d="M10 25 L70 25 L63 95 Q63 100 58 100 L22 100 Q17 100 17 95 Z"
        fill={filled ? fill : 'none'}
        stroke={stroke}
        strokeWidth={2}
      />
      {filled && pearls.map(([x, y], i) => (
        <Circle key={i} cx={x} cy={y} r={3} fill={T.ink} />
      ))}
    </Svg>
  );
}
