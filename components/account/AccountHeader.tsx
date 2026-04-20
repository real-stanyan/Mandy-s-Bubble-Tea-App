import { memo } from 'react'
import { View, Text } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { T, TYPE, RADIUS, SPACING } from '@/constants/theme'
import type { AuthProfile } from '@/components/auth/AuthProvider'

interface Props {
  profile: AuthProfile
}

export const AccountHeader = memo(function AccountHeader({ profile }: Props) {
  const fullName =
    [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'Member'
  const initials = computeInitials(profile.first_name, profile.last_name)

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: SPACING.lg,
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.md,
      }}
    >
      <LinearGradient
        colors={[T.peach, T.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#8D5524',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 14,
          elevation: 6,
        }}
      >
        <Text
          style={{
            fontFamily: 'Fraunces_500Medium',
            fontSize: 22,
            letterSpacing: -0.5,
            color: '#fff',
          }}
        >
          {initials}
        </Text>
      </LinearGradient>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[TYPE.screenTitleSm, { color: T.ink }]} numberOfLines={1}>
          {fullName}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            fontSize: 12,
            color: T.ink3,
            marginTop: 2,
          }}
          numberOfLines={1}
        >
          {formatPhone(profile.phone_e164)}
        </Text>
      </View>
    </View>
  )
})

function computeInitials(first: string | null, last: string | null): string {
  const a = first?.trim()?.[0] ?? ''
  const b = last?.trim()?.[0] ?? ''
  const initials = `${a}${b}`.toUpperCase()
  return initials || '🧋'
}

function formatPhone(e164: string): string {
  if (!e164) return ''
  if (!e164.startsWith('+61')) return e164
  const local = `0${e164.slice(3).replace(/^0+/, '')}`
  if (local.length !== 10) return e164
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}
