import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { T, FONT, RADIUS } from '@/constants/theme'

// Full-screen min-version wall. Shown only when /api/app-config says this
// build is below the minimum supported build (see lib/app-config.ts —
// fail-open everywhere else). No dismiss affordance on purpose: builds
// below minBuild have a known-broken payment flow.
export function UpdateRequired({ storeUrl }: { storeUrl: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.eyebrow}>Update required</Text>
      <Text style={styles.title}>A fresh cup awaits</Text>
      <Text style={styles.body}>
        This version of the Mandy&apos;s app is no longer supported. Please
        update to keep ordering — it only takes a moment.
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() => {
          Linking.openURL(storeUrl).catch(() => {})
        }}
        accessibilityRole="button"
        accessibilityLabel="Update the app"
      >
        <Text style={styles.btnText}>Update now</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#C43A10',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '700',
    color: T.cream,
    textTransform: 'uppercase',
    opacity: 0.85,
  },
  title: {
    marginTop: 10,
    fontFamily: FONT.serif,
    fontSize: 30,
    fontWeight: '500',
    letterSpacing: -0.5,
    color: '#fff',
    textAlign: 'center',
  },
  body: {
    marginTop: 12,
    fontFamily: FONT.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: T.cream,
    textAlign: 'center',
    opacity: 0.95,
  },
  btn: {
    marginTop: 28,
    minWidth: 200,
    height: 54,
    borderRadius: RADIUS.pill,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  btnText: {
    fontFamily: FONT.sans,
    fontSize: 16,
    fontWeight: '700',
    color: '#C43A10',
  },
})
