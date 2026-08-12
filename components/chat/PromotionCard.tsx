import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { T, RADIUS, PIN, IS_EVENING } from '@/constants/theme'
import { useChat } from '@/store/chat'
import type { ApiPromotion } from '@/lib/chat/api'

/** A promotion Mandy pointed at. Every word and number is server-authored —
 *  the model only chose WHICH promotion to show, never what it says or what
 *  it is worth. Cream poster face, so its ink is pinned to day values the
 *  way the other light-surface cards are (evening flips T.ink light). */
export function PromotionCard({ promotion }: { promotion: ApiPromotion }) {
  const close = useChat((s) => s.close)

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{promotion.title}</Text>
      <Text style={styles.detail}>{promotion.detail}</Text>
      {promotion.href && promotion.cta ? (
        <Pressable
          onPress={() => {
            close()
            router.push(promotion.href as never)
          }}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{promotion.cta}</Text>
        </Pressable>
      ) : null}
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
  title: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: PIN.ink },
  detail: {
    marginTop: 4,
    fontFamily: 'ShantellSans_400Regular',
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
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 13.5,
    // Evening brand is light gold; white on it is the unreadable blob this
    // codebase keeps re-learning. Same call as the proposal card's Pay now.
    color: IS_EVENING ? PIN.ink : '#fff',
  },
})
