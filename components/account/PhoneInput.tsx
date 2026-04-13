import { useState } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native'
import { BRAND } from '@/lib/constants'

interface Props {
  onSubmit: (phone: string) => void
  loading: boolean
}

export function PhoneInput({ onSubmit, loading }: Props) {
  const [phone, setPhone] = useState('')

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Check your loyalty stars</Text>
      <Text style={styles.subtitle}>
        Enter the phone number you use in store
      </Text>
      <TextInput
        style={styles.input}
        placeholder="04xx xxx xxx"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
      />
      <TouchableOpacity
        style={[styles.button, (!phone.trim() || loading) && styles.buttonDisabled]}
        onPress={() => onSubmit(phone.trim())}
        disabled={!phone.trim() || loading}
      >
        <Text style={styles.buttonText}>
          {loading ? 'Looking up...' : 'Look Up'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#888', textAlign: 'center', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: BRAND.color,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
