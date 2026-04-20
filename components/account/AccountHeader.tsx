import { memo } from 'react'
import { View, Text } from 'react-native'
import { T, TYPE, RADIUS, SPACING } from '@/constants/theme'
import type { AuthProfile } from '@/components/auth/AuthProvider'

interface Props {
  profile: AuthProfile
}

// Header block at the top of the Account tab: round avatar with initials
// (brand-filled), member name in Fraunces, E.164 phone rendered as the
// familiar "0412 345 678" AU format. When both names are missing we
// fall back to a cup glyph and "Member" — keeps the card from reading
// blank for edge-case profiles.
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
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.md,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: RADIUS.pill,
          backgroundColor: T.brand,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'Fraunces_500Medium',
            fontSize: 24,
            letterSpacing: -0.5,
            color: '#fff',
          }}
        >
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[TYPE.screenTitleSm, { color: T.ink }]} numberOfLines={1}>
          {fullName}
        </Text>
        <Text
          style={[TYPE.body, { color: T.ink3, marginTop: 2 }]}
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
