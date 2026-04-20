import { memo } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { T, RADIUS, SPACING } from '@/constants/theme'

const STORE_ADDRESS = '34 Davenport St, Southport QLD 4215'
const STORE_PHONE = '0404 978 238'
const STORE_HOURS = 'Mon–Sun · 10:30am–10:30pm'
const MAP_QUERY = '34 Davenport St Southport QLD 4215'

export const StoreInfo = memo(function StoreInfo() {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={openDirections}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.eyebrow}>YOUR STORE</Text>
        <Text style={styles.title}>Mandy&apos;s — Southport</Text>
        <Text style={styles.body}>
          {STORE_ADDRESS}
          {'\n'}
          {STORE_PHONE} · {STORE_HOURS}
        </Text>
      </Pressable>
    </View>
  )
})

function openDirections() {
  const encoded = encodeURIComponent(MAP_QUERY)
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${encoded}`,
    android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  })
  if (url) Linking.openURL(url).catch(() => {})
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 16,
  },
  eyebrow: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.4,
    color: T.brand,
  },
  title: {
    marginTop: 4,
    fontFamily: 'Fraunces_500Medium',
    fontSize: 18,
    letterSpacing: -0.3,
    color: T.ink,
  },
  body: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    lineHeight: 18,
    color: T.ink2,
  },
})
