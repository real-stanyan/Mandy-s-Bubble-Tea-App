import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { resolveCupVisual } from '@/lib/cup-visual';

interface Props {
  value: number;
  total: number;
  /**
   * Drink that earned each cup, oldest first (from /api/loyalty/star-drinks).
   * A null entry — or no array at all — borrows a house drink's colour by
   * index instead. Same contract as the web's StarTrack.
   */
  drinks?: Array<string | null> | null;
  /** A free drink is banked: the whole row breathes. */
  rewardReady?: boolean;
  /** Less air above the row (the Home strip). */
  compact?: boolean;
}

/**
 * House drinks a placeholder cup borrows its colour from — index-keyed,
 * never random: random re-rolls on every render and twitches. Mirrors the
 * web's StarTrack list.
 */
const PLACEHOLDER_DRINKS = [
  'Brown Sugar Milk Tea',
  'Taro Milk Tea',
  'Matcha Milk Tea',
  'Mango Slushy',
  'Strawberry Iced Green Tea',
  'Lychee Iced Green Tea',
  'Chocolate Milk Tea',
  'Peach Iced Green Tea',
  'Passion Fruit Iced Green Tea',
  'Grapefruit Iced Green Tea',
  'Blueberry Iced Green Tea',
  'Coconut Milk Tea',
] as const;

/** Breathing floor stays clearly visible — louder-and-softer, never off. */
const BREATH_MS = 1300;

export function StarCupsRow({ value, total, drinks, rewardReady = false, compact = false }: Props) {
  const remaining = total - value;
  // Same rationing as the web: only the cup you are about to earn breathes,
  // and only within two of a reward. A banked reward outranks the nudge.
  const nudging = !rewardReady && value > 0 && remaining > 0 && remaining <= 2;

  const cups = Array.from({ length: total }, (_, i) => i < value);
  const row = (
    <View
      style={{
        marginTop: compact ? 12 : 22,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
      }}
    >
      {cups.map((filled, i) => {
        if (filled) {
          const name =
            drinks?.[i] ?? PLACEHOLDER_DRINKS[i % PLACEHOLDER_DRINKS.length];
          return <FilledCup key={i} drinkName={name} />;
        }
        return <EmptyCup key={i} breathe={nudging && i === value} />;
      })}
    </View>
  );

  return rewardReady ? <Breath floor={0.92}>{row}</Breath> : row;
}

/** An earned cup, coloured as the drink that earned it. */
function FilledCup({ drinkName }: { drinkName: string }) {
  const { liquid, liquidLight } = resolveCupVisual({ drinkName, picked: [] });
  return (
    <View style={{ width: 22, height: 28 }}>
      <Svg width={22} height={28} viewBox="0 0 22 28">
        <Path
          d="M3.4 8 L18.6 8 L17 24 Q17 26 15 26 L7 26 Q5 26 5 24 Z"
          fill={liquid}
          stroke="#fff"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        <Ellipse cx={11} cy={9.2} rx={5.4} ry={0.9} fill={liquidLight} opacity={0.9} />
        <Rect x={2} y={5} width={18} height={2.6} rx={1} fill="#F7EFE1" stroke="#fff" strokeWidth={1.2} />
      </Svg>
    </View>
  );
}

/** An unearned cup: outline only. The next one to earn breathes. */
function EmptyCup({ breathe }: { breathe: boolean }) {
  const cup = (
    <View style={{ width: 22, height: 28, transform: [{ translateY: 2 }] }}>
      <Svg width={22} height={28} viewBox="0 0 22 28">
        <Rect x={2} y={5} width={18} height={2.6} rx={1} fill="none" stroke="#fff" strokeWidth={1.2} />
        <Path
          d="M3.4 8 L18.6 8 L17 24 Q17 26 15 26 L7 26 Q5 26 5 24 Z"
          fill="none"
          stroke="#fff"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
  if (!breathe) return <View style={{ opacity: 0.35 }}>{cup}</View>;
  return <Breath floor={0.55}>{cup}</Breath>;
}

/** Opacity breath between `floor` and 1, ~2.6s a cycle, forever. */
function Breath({ floor, children }: { floor: number; children: React.ReactNode }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: BREATH_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: floor + (1 - floor) * t.value,
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
