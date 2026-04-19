import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useAuth } from '@/components/auth/AuthProvider';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function HomeLoyaltyHero() {
  const router = useRouter();
  const { profile, loyalty, starsPerReward } = useAuth();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (!profile) return null;

  const balance = loyalty?.balance ?? 0;
  const goal = starsPerReward ?? 9;
  const toGo = Math.max(0, goal - balance);
  const reached = balance >= goal;

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <AnimatedPressable
        onPressIn={() => { scale.value = withTiming(0.985, { duration: 160 }); }}
        onPressOut={() => { scale.value = withTiming(1, { duration: 160 }); }}
        onPress={() => router.push('/promotions')}
        style={[animatedStyle, { borderRadius: RADIUS.card, ...SHADOW.miniCart, shadowColor: T.brandDark }]}
      >
        <LinearGradient
          colors={[T.brand, T.brandDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ borderRadius: RADIUS.card, padding: 22, overflow: 'hidden' }}
        >
          {/* Top row */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: T.peach }} />
                <Text style={[TYPE.eyebrow, { color: 'rgba(255,255,255,0.7)' }]}>
                  MANDY&apos;S REWARDS
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 8 }}>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 36,
                    lineHeight: 36,
                    letterSpacing: -0.8,
                    color: '#fff',
                  }}
                >
                  {balance}
                </Text>
                <Text
                  style={{
                    fontFamily: 'Fraunces_500Medium',
                    fontSize: 24,
                    color: 'rgba(255,255,255,0.45)',
                    marginLeft: 6,
                  }}
                >
                  {` / ${goal} stars`}
                </Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: 'rgba(255,255,255,0.15)',
              }}
            >
              <Icon name="star" color={T.peach} size={12} />
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 11, color: '#fff' }}>
                Member
              </Text>
            </View>
          </View>

          {/* Cups */}
          <CupProgressRow value={balance} total={goal} />

          {/* Bottom row */}
          <View
            style={{
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)', flex: 1, paddingRight: 12 }]}>
              {reached ? (
                '🎉 Free drink ready to redeem'
              ) : (
                <>
                  <Text style={{ fontFamily: 'Inter_600SemiBold', color: '#fff' }}>{toGo}</Text>
                  {` stars until a free drink`}
                </>
              )}
            </Text>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: reached ? T.peach : 'rgba(255,255,255,0.18)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'Inter_500Medium',
                  fontSize: 12.5,
                  color: reached ? T.brandDark : '#fff',
                }}
              >
                {reached ? 'Redeem' : 'View'}
              </Text>
              <Icon name="arrow" color={reached ? T.brandDark : '#fff'} size={12} />
            </View>
          </View>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
}

// Inline sub-component — not reused; Account's LoyaltyCard variant lives in Phase 6.
function CupProgressRow({ value, total }: { value: number; total: number }) {
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
            {/* lid */}
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
            {/* body (trapezoid) */}
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
