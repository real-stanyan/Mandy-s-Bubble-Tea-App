import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/auth/AuthProvider';
import { CupArt } from '@/components/brand/CupArt';
import { Icon } from '@/components/brand/Icon';
import { T, TYPE, RADIUS } from '@/constants/theme';

export function DailySpecial() {
  const router = useRouter();
  const { profile, welcomeDiscount } = useAuth();

  if (!profile) return null;
  if (!welcomeDiscount?.available) return null;

  const drinksRemaining = welcomeDiscount.drinksRemaining ?? 2;
  const pct = welcomeDiscount.percentage ?? 30;

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
                  NEW MEMBER OFFER
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
                {`First ${drinksRemaining} `}
                <Text style={{ fontFamily: 'Fraunces_500Medium', fontStyle: 'italic' }}>milk teas</Text>
                {`\n— ${pct}% off`}
              </Text>
              <Text
                style={[TYPE.body, { marginTop: 8, color: T.ink2, lineHeight: 18, maxWidth: 180 }]}
              >
                Welcome gift for new members. Auto-applied at checkout.
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
                backgroundColor: T.ink,
              }}
            >
              <Text style={{ fontFamily: 'Inter_500Medium', fontSize: 13, color: T.cream }}>
                Start ordering
              </Text>
              <Icon name="arrow" color={T.cream} size={12} />
            </View>
          </View>

          <View
            style={{
              width: 130,
              alignItems: 'flex-end',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <View
              style={{
                position: 'absolute',
                right: -30,
                top: -20,
                width: 150,
                height: 150,
                borderRadius: 999,
                borderWidth: 2,
                borderColor: 'rgba(42,30,20,0.18)',
                borderStyle: 'dashed',
              }}
            />
            <View
              style={{
                transform: [{ rotate: '-4deg' }, { translateY: 6 }],
                shadowColor: 'rgba(107,62,21,1)',
                shadowOpacity: 0.3,
                shadowOffset: { width: 0, height: 8 },
                shadowRadius: 16,
                elevation: 4,
              }}
            >
              <CupArt fill="#FFC875" stroke={T.ink} size={100} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
