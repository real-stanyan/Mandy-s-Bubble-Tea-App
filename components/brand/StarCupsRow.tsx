import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { T } from '@/constants/theme';

interface Props {
  value: number;
  total: number;
}

export function StarCupsRow({ value, total }: Props) {
  const cups = Array.from({ length: total }, (_, i) => i < value);
  return (
    <View
      style={{
        marginTop: 22,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}
    >
      {cups.map((filled, i) => (
        <View
          key={i}
          style={{
            width: 22,
            height: 28,
            transform: filled ? [] : [{ translateY: 2 }],
            opacity: filled ? 1 : 0.35,
          }}
        >
          <Svg width={22} height={28} viewBox="0 0 22 28">
            <Rect
              x={2}
              y={5}
              width={18}
              height={2.6}
              rx={1}
              fill={filled ? T.peach : 'none'}
              stroke="#fff"
              strokeWidth={1.2}
            />
            <Path
              d="M3.4 8 L18.6 8 L17 24 Q17 26 15 26 L7 26 Q5 26 5 24 Z"
              fill={filled ? T.peach : 'none'}
              stroke="#fff"
              strokeWidth={1.2}
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      ))}
    </View>
  );
}
