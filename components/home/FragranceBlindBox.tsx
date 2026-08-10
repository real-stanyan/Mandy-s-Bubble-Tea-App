import { useMemo } from 'react';
import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS } from '@/constants/theme';

// Limited-time campaign card: "Buy 2 drinks, get a fragrance-tag blind
// box." Marketing only — the blind box is handed out in-store, so this
// just links to the menu. Mirrors DailySpecial's peach-gradient treatment.
// Gated in index.tsx by FRAGRANCE_BLIND_BOX_PROMO.
//
// Tags are uniform background-removed, string-stripped square crops. We
// show 5 of the 10 designs, re-shuffled each time the screen mounts.

const POOL = [
  require('@/assets/promo/fragrance-tags/black-opium.png'),
  require('@/assets/promo/fragrance-tags/cedarwood.png'),
  require('@/assets/promo/fragrance-tags/cherry.png'),
  require('@/assets/promo/fragrance-tags/crisp-apple.png'),
  require('@/assets/promo/fragrance-tags/freesia.png'),
  require('@/assets/promo/fragrance-tags/ocean.png'),
  require('@/assets/promo/fragrance-tags/rose.png'),
  require('@/assets/promo/fragrance-tags/sandalwood.png'),
];

const SHOW = 5;
const TILE = 62;
const ROT = ['-16deg', '-8deg', '0deg', '8deg', '16deg'];
const Z = [1, 2, 3, 2, 1];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function FragranceBlindBox() {
  const router = useRouter();
  const tags = useMemo(() => shuffle(POOL).slice(0, SHOW), []);

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
      <Pressable
        onPress={() => router.push('/(tabs)/menu')}
        style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
      >
        <LinearGradient
          colors={[T.peach, '#FFCFA3', T.cream]}
          locations={[0, 0.6, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={{
            borderRadius: RADIUS.card,
            borderWidth: 1,
            borderColor: 'rgba(141,85,36,0.12)',
            padding: 22,
            overflow: 'hidden',
          }}
        >
          <View>
            <View
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderRadius: 4,
                backgroundColor: T.ink,
              }}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_700Bold',
                  fontSize: 10,
                  letterSpacing: 1.3,
                  color: T.cream,
                }}
              >
                LIMITED · WHILE STOCKS LAST
              </Text>
            </View>
            <Text
              style={{
                marginTop: 10,
                fontFamily: 'ShantellSans_700Bold',
                fontSize: 24,
                lineHeight: 26,
                letterSpacing: -0.5,
                color: T.ink,
              }}
            >
              {'2 drinks, '}
              <Text style={{ fontFamily: 'ShantellSans_700Bold', fontStyle: 'italic' }}>
                one surprise
              </Text>
            </Text>
            <Text style={[TYPE.body, { marginTop: 8, color: T.ink2, lineHeight: 18 }]}>
              Buy any 2 drinks, get a fragrance-tag blind box — 10 designs, 10 scents.
            </Text>
          </View>

          {/* Blind-box teaser — 5 random uniform tags, fanned. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginTop: 18,
            }}
          >
            {tags.map((src, i) => (
              <View
                key={i}
                style={{
                  marginLeft: i === 0 ? 0 : -20,
                  zIndex: Z[i],
                  transform: [{ rotate: ROT[i] }],
                  borderRadius: 12,
                  backgroundColor: '#fff',
                  shadowColor: 'rgba(42,30,20,1)',
                  shadowOpacity: 0.26,
                  shadowOffset: { width: 0, height: 5 },
                  shadowRadius: 7,
                  elevation: 5,
                }}
              >
                <Image
                  source={src}
                  style={{ width: TILE, height: TILE, borderRadius: 12 }}
                  contentFit="cover"
                />
              </View>
            ))}
          </View>

          <View
            style={{
              alignSelf: 'center',
              marginTop: 18,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: T.brand,
            }}
          >
            <Text style={{ fontFamily: 'ShantellSans_500Medium', fontSize: 13, color: T.cream }}>
              Order now
            </Text>
            <Icon name="arrow" color={T.cream} size={12} />
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
