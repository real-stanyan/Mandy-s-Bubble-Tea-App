import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { BRAND } from '@/lib/constants'
import type { QuoteState } from '@/lib/delivery'

export function DeliveryQuoteCard({ quote }: { quote: QuoteState }) {
  if (quote.kind === 'idle') return null
  if (quote.kind === 'loading') {
    return (
      <View style={[styles.card, styles.neutral]}>
        <ActivityIndicator size="small" color={BRAND.color} />
        <Text style={styles.text}>Checking delivery availability…</Text>
      </View>
    )
  }
  if (quote.kind === 'error') {
    return (
      <View style={[styles.card, styles.error]}>
        <Text style={styles.errorText}>{quote.message}</Text>
      </View>
    )
  }
  return (
    <View style={[styles.card, styles.ok]}>
      <Text style={styles.okText}>✓ Delivery available — our team brings it to your door</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, marginTop: 8, marginHorizontal: 16 },
  neutral: { backgroundColor: '#F5F1EA' },
  ok: { backgroundColor: '#EAF3EA' },
  error: { backgroundColor: '#FBEFE0' },
  text: { fontSize: 13, color: '#5A5A5A' },
  okText: { fontSize: 13, color: '#3F7A3F', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#B07A1E', fontWeight: '600' },
})
