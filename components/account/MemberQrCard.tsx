import { View, Text, StyleSheet } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { BRAND } from '@/lib/constants'

interface Props {
  customerId: string
  phoneE164: string
}

export function MemberQrCard({ customerId, phoneE164 }: Props) {
  if (!customerId || !phoneE164) return null

  const shortId = customerId.slice(-6).toUpperCase()

  return (
    <View style={styles.card}>
      <Text style={styles.title}>MEMBER CARD</Text>
      <View style={styles.qrWrap}>
        <QRCode value={phoneE164} size={160} ecl="M" />
      </View>
      <Text style={styles.shortId}>#{shortId}</Text>
      <Text style={styles.subtitle}>📱 Show this screen at the counter to redeem</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: BRAND.color,
  },
  qrWrap: {
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  shortId: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 3,
    color: '#18181b',
    fontVariant: ['tabular-nums'],
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#71717a',
  },
})
