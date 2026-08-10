import { View, Text, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { T, RADIUS, PIN, IS_EVENING } from '@/constants/theme'
import { useCartStore } from '@/store/cart'
import { useChat } from '@/store/chat'
import { chatUiStrings } from '@/lib/chat/ui-strings'
import { formatPrice } from '@/lib/utils'

/** The "ready to pay" card. Reads the LIVE cart, not a snapshot — the
 *  customer can keep chatting drinks into the cart after this card
 *  appears. Payment stays on the checkout screen; the chat never grows a
 *  second payment surface. Mirrors the web's CheckoutCard. */
export function CheckoutCard() {
  const t = chatUiStrings()
  const close = useChat((s) => s.close)
  const items = useCartStore((s) => s.items)

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const cupCount = items.reduce((n, i) => n + i.quantity, 0)

  if (items.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.sub}>{t.checkoutEmptyCart}</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.lines}>
        {items.map((i) => (
          <View key={i.lineId} style={styles.line}>
            <Text style={styles.lineName} numberOfLines={1}>
              {i.quantity > 1 ? `${i.quantity}× ` : ''}
              {i.name}
            </Text>
            <Text style={styles.linePrice}>{formatPrice(i.price * i.quantity)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text style={styles.sub}>{t.checkoutFeesNote(cupCount)}</Text>
        <Text style={styles.total}>{formatPrice(subtotal)}</Text>
      </View>

      <Pressable
        onPress={() => {
          close()
          router.push('/checkout')
        }}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>
          {t.goToCheckout} · {formatPrice(subtotal)}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    padding: 12,
  },
  lines: { gap: 6 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  lineName: {
    flex: 1,
    minWidth: 0,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 13,
    color: T.ink,
  },
  linePrice: { fontFamily: 'ShantellSans_700Bold', fontSize: 13, color: T.ink },
  sub: { fontFamily: 'ShantellSans_400Regular', fontSize: 12, color: T.ink3, flexShrink: 1 },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  total: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: T.brand },
  cta: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: T.brand,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: T.brandDark },
  ctaText: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: IS_EVENING ? PIN.ink : '#fff' },
})
