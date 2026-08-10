import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Svg, { Path } from 'react-native-svg'
import { T, FONT } from '@/constants/theme'
import { DELIVERY_DRIVER } from '@/lib/delivery'
import { DashedBorder } from '@/components/ui/DashedBorder'

function PhoneGlyph({ size = 12 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#fff">
      <Path d="M6.6 10.8c1.5 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.4.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.8 21 3 13.2 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
    </Svg>
  )
}

export type DriverRowVariant = 'paper' | 'white' | 'ghost'

/**
 * Driver strip shared by the list cards (S2/S3), the full-screen tracker
 * sheet (S4/S5) and the pre-dispatch detail (S6).
 *  - paper: cream card on white shells (S2)
 *  - white: white card on sage / tinted shells (S3, S4/S5 sheet)
 *  - ghost: placeholder before a driver accepts (S6) — dashed slot, no call.
 */
export function DriverRow({
  variant,
  sub,
}: {
  variant: DriverRowVariant
  // Secondary line under the name ("Your driver · scooter 🛵",
  // "1.2 km away · scooter 🛵", "waiting for GPS signal…", …).
  sub: string
}) {
  if (variant === 'ghost') {
    return (
      <View style={styles.rowGhost}>
        <DashedBorder radius={14} color="rgba(42,30,20,0.22)" />
        <View style={styles.ghostAvatar}>
          <DashedBorder radius={20} color="rgba(42,30,20,0.28)" />
          <Text style={styles.ghostMark}>?</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: T.ink3 }]}>Your driver will appear here</Text>
          <Text style={styles.sub}>{sub}</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.row, variant === 'white' ? styles.rowWhite : styles.rowPaper]}>
      <Image
        source={require('@/assets/images/driver-avatar.png')}
        style={styles.avatar}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.name} numberOfLines={1}>
          {DELIVERY_DRIVER.name}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => Linking.openURL(`tel:${DELIVERY_DRIVER.phone}`)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[T.green, T.greenDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.callBtn}
        >
          <PhoneGlyph />
          <Text style={styles.callText}>Call</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  rowPaper: {
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
  },
  rowWhite: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  rowGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.bg2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  ghostAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostMark: {
    fontFamily: FONT.sans,
    fontSize: 16,
    color: T.ink3,
  },
  name: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  sub: {
    fontFamily: FONT.sans,
    fontSize: 11,
    color: T.ink3,
    marginTop: 2,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: '#2E7F52',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  callText: {
    color: '#fff',
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 12.5,
  },
})
