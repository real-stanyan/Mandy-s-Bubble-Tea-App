import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Confetti } from './Confetti'

export interface PrizeReveal {
  rollId: string
  tier_id: string
  prize_type: 'thank_you' | 'digital' | 'physical'
  label: string
  payload: Record<string, unknown>
  claim_code?: string
  expires_at: string | null
}

interface Props {
  prize: PrizeReveal | null
  onDismiss: () => void
}

export function PrizeRevealModal({ prize, onDismiss }: Props) {
  if (!prize) return null

  const isThankYou = prize.prize_type === 'thank_you'
  const isPhysical = prize.prize_type === 'physical'
  const bg = isThankYou ? '#EAEAEA' : isPhysical ? '#F5E6C8' : '#C43A10'
  const fg = isThankYou ? '#333' : isPhysical ? '#333' : '#fff'

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        {!isThankYou && (
          <View testID="confetti">
            <Confetti />
          </View>
        )}
        <Pressable style={[styles.card, { backgroundColor: bg }]} onPress={() => {}}>
          <Text style={[styles.headline, { color: fg }]}>
            {isThankYou ? 'Aww!' : '🎉 You won!'}
          </Text>
          <Text style={[styles.label, { color: fg }]}>{prize.label}</Text>
          {prize.prize_type === 'digital' && (
            <Text style={[styles.note, { color: fg }]}>
              Auto-applies on your next order
            </Text>
          )}
          {isPhysical && prize.claim_code && (
            <View style={styles.claim}>
              <Text style={styles.claimCode}>{prize.claim_code}</Text>
              <View testID="claim-qr">
                <QRCode value={`mandybt-claim:${prize.claim_code}`} size={140} />
              </View>
              <Text style={styles.claimNote}>Show at the counter within 7 days</Text>
            </View>
          )}
          <Pressable
            testID="prize-dismiss"
            style={[
              styles.button,
              { backgroundColor: isThankYou ? '#333' : '#fff' },
            ]}
            onPress={onDismiss}
          >
            <Text
              style={[
                styles.buttonLabel,
                { color: isThankYou ? '#fff' : '#C43A10' },
              ]}
            >
              {isThankYou ? 'Got it' : 'Sweet!'}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  headline: { fontSize: 26, fontWeight: '700', marginBottom: 12 },
  label: { fontSize: 22, fontWeight: '600', textAlign: 'center' },
  note: { fontSize: 14, marginTop: 12, opacity: 0.8 },
  claim: { marginTop: 18, alignItems: 'center' },
  claimCode: {
    fontFamily: 'Menlo',
    fontSize: 32,
    letterSpacing: 4,
    marginBottom: 16,
    color: '#333',
  },
  claimNote: { marginTop: 12, fontSize: 13, color: '#555' },
  button: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
})
