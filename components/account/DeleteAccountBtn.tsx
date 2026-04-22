import { memo, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { T, RADIUS, SPACING } from '@/constants/theme'

interface Props {
  onConfirm: () => Promise<void>
}

export const DeleteAccountBtn = memo(function DeleteAccountBtn({ onConfirm }: Props) {
  const [busy, setBusy] = useState(false)

  const handlePress = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes your account, loyalty stars, and push notifications. Past orders are retained anonymously for tax purposes. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete forever',
          style: 'destructive',
          onPress: async () => {
            if (busy) return
            setBusy(true)
            try {
              await onConfirm()
            } catch (err) {
              Alert.alert(
                'Delete failed',
                err instanceof Error ? err.message : 'Please try again or contact us.',
              )
            } finally {
              setBusy(false)
            }
          },
        },
      ],
    )
  }

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        disabled={busy}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Delete account"
      >
        {busy ? (
          <ActivityIndicator color="#b91c1c" size="small" />
        ) : (
          <Text style={styles.text}>Delete account</Text>
        )}
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  text: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#b91c1c',
  },
})
