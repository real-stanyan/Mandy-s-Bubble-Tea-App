import { Image } from 'expo-image';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS } from '@/constants/theme';

// Limited-time campaign card: "Buy 2 drinks, get a fragrance-tag blind
// box." Marketing only — the blind box is handed out in-store, so this
// just links to the menu. Mirrors DailySpecial's peach-gradient treatment.
// Shown to everyone (no auth gate); gated in index.tsx by
// FRAGRANCE_BLIND_BOX_PROMO — flip that to retire it.

// Background-removed cut-outs so each hanging tag shows in full on the
// gradient. w/h preserve each tag's aspect ratio; laid out as a left→right
// fan (negative marginLeft for a slight overlap) so all three read clearly.
const TAGS = [
  { src: require('@/assets/promo/fragrance-tags/black-opium.png'), w: 94, h: 117, rotate: '-10deg', ml: 0, z: 1 },
  { src: require('@/assets/promo/fragrance-tags/ocean.png'), w: 75, h: 117, rotate: '0deg', ml: -16, z: 3 },
  { src: require('@/assets/promo/fragrance-tags/crisp-apple.png'), w: 105, h: 117, rotate: '10deg', ml: -16, z: 2 },
] as const;

export function FragranceBlindBox() {
  const router = useRouter();

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
            minHeight: 180,
            flexDirection: 'row',
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, paddingRight: 6, justifyContent: 'space-between' }}>
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
                  fontFamily: 'Fraunces_500Medium',
                  fontSize: 24,
                  lineHeight: 26,
                  letterSpacing: -0.5,
                  color: T.ink,
                }}
              >
                {'2 drinks,\n'}
                <Text style={{ fontFamily: 'Fraunces_500Medium', fontStyle: 'italic' }}>
                  one surprise
                </Text>
              </Text>
              <Text
                style={[TYPE.body, { marginTop: 8, color: T.ink2, lineHeight: 18, maxWidth: 185 }]}
              >
                Buy any 2 drinks, get a fragrance-tag blind box — 10 designs, 10 scents.
              </Text>
            </View>

            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: 14,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: T.brand,
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: T.cream }}>
                Order now
              </Text>
              <Icon name="arrow" color={T.cream} size={12} />
            </View>
          </View>

          {/* Fanned blind-box teaser — 3 hanging tags, background removed
              so each shows in full, fanned left→right on the gradient. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-end',
              alignSelf: 'center',
            }}
          >
            {TAGS.map((t, i) => (
              <View
                key={i}
                style={{
                  marginLeft: t.ml,
                  zIndex: t.z,
                  transform: [{ rotate: t.rotate }],
                  shadowColor: 'rgba(42,30,20,1)',
                  shadowOpacity: 0.28,
                  shadowOffset: { width: 0, height: 6 },
                  shadowRadius: 8,
                  elevation: 5,
                }}
              >
                <Image
                  source={t.src}
                  style={{ width: t.w, height: t.h }}
                  contentFit="contain"
                />
              </View>
            ))}
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
