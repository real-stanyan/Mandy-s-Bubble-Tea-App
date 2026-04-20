import { memo, useState } from 'react'
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon, type IconName } from '@/components/brand/Icon'
import { LegalModal } from '@/components/legal/LegalModal'
import type { LegalKind } from '@/lib/legal'
import { T, TYPE, RADIUS, SHADOW, SPACING } from '@/constants/theme'

const STORE_NAME = "Mandy's Bubble Tea"
const STORE_ADDRESS = '34 Davenport St, Southport QLD 4215'
const STORE_PHONE = '0404 978 238'
const MAP_QUERY = '34 Davenport St Southport QLD 4215'

interface Props {
  onSignOut: () => void
}

// Settings list rendered at the bottom of the Account tab. Groups store
// info + legal links + sign out into a single paper card so the tab
// ends with a clean terminal block (replacing the loose StoreInfo +
// sign-out button in the legacy layout).
export const SettingsList = memo(function SettingsList({ onSignOut }: Props) {
  const [legalKind, setLegalKind] = useState<LegalKind | null>(null)

  return (
    <>
      <View style={{ paddingHorizontal: SPACING.lg, marginTop: SPACING.xl }}>
        <Text
          style={[
            TYPE.eyebrow,
            { color: T.ink3, marginBottom: 10, marginLeft: 4 },
          ]}
        >
          SETTINGS
        </Text>
        <View style={styles.card}>
          <Row
            icon="pin"
            label={STORE_NAME}
            value={STORE_ADDRESS}
            onPress={openDirections}
          />
          <Divider />
          <Row
            icon="cafe"
            label="Call store"
            value={STORE_PHONE}
            onPress={() => callStore()}
          />
          <Divider />
          <Row
            icon="receipt"
            label="Privacy policy"
            onPress={() => setLegalKind('privacy')}
          />
          <Divider />
          <Row
            icon="receipt"
            label="Terms of service"
            onPress={() => setLegalKind('terms')}
          />
          <Divider />
          <Row icon="logout" label="Sign out" onPress={onSignOut} destructive />
        </View>
      </View>

      <LegalModal
        visible={legalKind !== null}
        kind={legalKind ?? 'privacy'}
        onClose={() => setLegalKind(null)}
      />
    </>
  )
})

interface RowProps {
  icon: IconName
  label: string
  value?: string
  onPress: () => void
  destructive?: boolean
}

function Row({ icon, label, value, onPress, destructive }: RowProps) {
  const labelColor = destructive ? T.brandDark : T.ink
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.iconWrap}>
        <Icon name={icon} color={destructive ? T.brandDark : T.ink2} size={20} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: 'Inter_500Medium',
            fontSize: 15,
            color: labelColor,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {value ? (
          <Text
            style={[TYPE.body, { color: T.ink3, marginTop: 2 }]}
            numberOfLines={1}
          >
            {value}
          </Text>
        ) : null}
      </View>
      {!destructive && <Icon name="chevR" color={T.ink4} size={18} />}
    </Pressable>
  )
}

function Divider() {
  return (
    <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: T.line, marginLeft: 54 }} />
  )
}

function openDirections() {
  const encoded = encodeURIComponent(MAP_QUERY)
  const url = Platform.select({
    ios: `http://maps.apple.com/?q=${encoded}`,
    android: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
  })
  if (url) Linking.openURL(url).catch(() => {})
}

function callStore() {
  const digits = STORE_PHONE.replace(/\s+/g, '')
  Linking.openURL(`tel:${digits}`).catch(() => {})
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
