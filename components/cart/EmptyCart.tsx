import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { BRAND } from '@/lib/constants'

export function EmptyCart() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🧋</Text>
      <Text style={styles.title}>Your cart is empty</Text>
      <Text style={styles.subtitle}>Browse our menu and add some drinks!</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.navigate('/(tabs)')}
      >
        <Text style={styles.buttonText}>Browse Menu</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emoji: { fontSize: 64 },
  title: { fontSize: 20, fontWeight: '600' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center' },
  button: {
    marginTop: 16,
    backgroundColor: BRAND.color,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
