import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Pressable,
} from 'react-native'
import { BRAND } from '@/lib/constants'

interface Props {
  visible: boolean
  message: string | null
  title?: string
  onCancel: () => void
  onRetry: () => void
}

export function PaymentErrorDialog({
  visible,
  message,
  title = 'Payment Failed',
  onCancel,
  onRetry,
}: Props) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.imageWrap}>
            <Image
              source={require('@/assets/images/payment-error.webp')}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>
            {message ?? 'Something went wrong with your payment.'}
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={styles.btnCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnRetry]}
              onPress={onRetry}
              activeOpacity={0.85}
            >
              <Text style={styles.btnRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  imageWrap: { alignItems: 'center' },
  image: { width: 160, height: 160 },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#11181C',
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCancel: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  btnCancelText: { fontSize: 15, fontWeight: '600', color: '#333' },
  btnRetry: { backgroundColor: BRAND.color },
  btnRetryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
