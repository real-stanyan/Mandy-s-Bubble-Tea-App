import { useEffect, useState } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { BRAND } from '@/lib/constants'

const STORAGE_KEY = 'mbt.pickupReminderDismissed'

export function PickupReminderDialog() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (!cancelled && v !== '1') setVisible(true)
      })
      .catch(() => {
        if (!cancelled) setVisible(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {})
    setVisible(false)
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={dismiss}
    >
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Pickup Reminder</Text>
          <View style={styles.bulletList}>
            <BulletRow text="Pick Up drinks are best collected within 10 minutes of the scheduled time." />
            <BulletRow text="Please arrive on time to enjoy the best taste and ice level." />
            <BulletRow text="Orders not collected promptly may affect drink quality." />
          </View>
          <TouchableOpacity
            style={styles.btn}
            onPress={dismiss}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Got it</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

function BulletRow({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
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
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
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
  bulletList: {
    gap: 6,
    marginTop: 4,
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  btn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.color,
    marginTop: 8,
  },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
})
