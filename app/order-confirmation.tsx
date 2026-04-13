import { useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { Ionicons } from '@expo/vector-icons'
import { BRAND } from '@/lib/constants'

export default function OrderConfirmationScreen() {
  const router = useRouter()
  const { orderId, starsEarned } = useLocalSearchParams<{
    orderId: string
    starsEarned: string
  }>()

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])

  const handleBackToMenu = () => {
    router.replace('/(tabs)')
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name="checkmark-circle" size={80} color="#2e7d32" />
      </View>

      <Text style={styles.title}>Order Confirmed!</Text>
      {orderId ? (
        <Text style={styles.orderId}>Order #{orderId.slice(-6).toUpperCase()}</Text>
      ) : null}

      <View style={styles.infoCard}>
        <Ionicons name="location-outline" size={20} color="#666" />
        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>Pickup at</Text>
          <Text style={styles.infoValue}>{BRAND.address}</Text>
        </View>
      </View>

      {starsEarned && Number(starsEarned) > 0 ? (
        <View style={styles.starsCard}>
          <Text style={styles.starsText}>
            ⭐ You earned {starsEarned} star{Number(starsEarned) !== 1 ? 's' : ''}!
          </Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.button}
        onPress={handleBackToMenu}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Back to Menu</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  iconWrapper: { marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  orderId: { fontSize: 16, color: '#888', fontFamily: 'monospace' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    marginTop: 8,
  },
  infoContent: { flex: 1 },
  infoLabel: { fontSize: 13, color: '#888' },
  infoValue: { fontSize: 15, fontWeight: '500', marginTop: 2 },
  starsCard: {
    backgroundColor: BRAND.accentColor,
    padding: 16,
    borderRadius: 12,
    width: '100%',
  },
  starsText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  button: {
    backgroundColor: BRAND.color,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
})
