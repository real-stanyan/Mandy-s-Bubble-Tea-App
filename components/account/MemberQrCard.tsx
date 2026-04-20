import { memo, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Modal, TouchableOpacity } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS, SPACING } from '@/constants/theme'

interface Props {
  customerId: string
  phoneE164: string
}

export const MemberQrCard = memo(function MemberQrCard({ customerId, phoneE164 }: Props) {
  const [open, setOpen] = useState(false)
  if (!customerId || !phoneE164) return null

  const memberId = `M-${customerId.slice(-8).toUpperCase()}`

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.qrBox}>
          <QRCode value={phoneE164} size={84} ecl="M" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>MEMBER QR</Text>
          <Text style={styles.title}>Scan at the counter</Text>
          <Text style={styles.memberId} numberOfLines={1}>{memberId}</Text>
          <View style={styles.expandBtn}>
            <Text style={styles.expandText}>Expand</Text>
            <Icon name="chevR" color={T.cream} size={10} />
          </View>
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalQr}>
              <QRCode value={phoneE164} size={260} ecl="M" />
            </View>
            <Text style={styles.modalMemberId}>{memberId}</Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setOpen(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  card: {
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  qrBox: {
    width: 96,
    height: 96,
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 17,
    letterSpacing: -0.3,
    color: T.ink,
    lineHeight: 20,
  },
  memberId: {
    marginTop: 4,
    fontSize: 11.5,
    color: T.ink3,
    fontFamily: 'JetBrainsMono_700Bold',
  },
  expandBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
  },
  expandText: {
    color: T.cream,
    fontSize: 11.5,
    fontFamily: 'Inter_600SemiBold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: RADIUS.card,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  modalQr: {
    padding: 8,
  },
  modalMemberId: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 14,
    letterSpacing: 1.5,
    color: T.ink,
  },
  modalClose: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
  },
  modalCloseText: {
    color: T.cream,
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
  },
})
