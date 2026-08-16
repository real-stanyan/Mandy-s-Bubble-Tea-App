import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { T, RADIUS, PIN, IS_EVENING } from '@/constants/theme'
import { useChat } from '@/store/chat'
import { chatUiStrings } from '@/lib/chat/ui-strings'

/** Rendered under Mandy's reply when a signed-out customer asked about
 *  their order: the words explain (in the customer's language, via the
 *  model), this card acts — one tap to /login, sheet closed on the way.
 *  Mirrors web's SignInCard; chrome comes from the device-locale string
 *  pack, the server only sets a boolean. Cream poster face like
 *  PromotionCard, so ink is pinned to day values. */
export function SignInCard() {
  const t = chatUiStrings()
  const close = useChat((s) => s.close)

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t.signInTitle}</Text>
      <Text style={styles.detail}>{t.signInBody}</Text>
      <Pressable
        onPress={() => {
          close()
          router.push('/login')
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>{t.signInCta}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.cream,
    padding: 12,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 14, color: PIN.ink },
  detail: {
    marginTop: 4,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: PIN.ink2,
  },
  cta: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: T.brand,
    paddingVertical: 9,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: T.brandDark },
  ctaText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    // Evening brand is light gold; white on it is unreadable — same call
    // as PromotionCard's CTA.
    color: IS_EVENING ? PIN.ink : '#fff',
  },
})
