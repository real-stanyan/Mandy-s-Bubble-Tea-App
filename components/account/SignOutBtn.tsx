import { memo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS, SPACING } from '@/constants/theme'

interface Props {
  onPress: () => void
}

export const SignOutBtn = memo(function SignOutBtn({ onPress }: Props) {
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Icon name="logout" color={T.ink2} size={15} />
        <Text style={styles.text}>Sign out</Text>
      </Pressable>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: T.ink4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'transparent',
  },
  text: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 14,
    color: T.ink2,
  },
})
