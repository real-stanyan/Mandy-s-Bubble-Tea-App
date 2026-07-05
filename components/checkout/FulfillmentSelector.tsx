import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BRAND } from '@/lib/constants'
import { deliverySubtitle, isDeliveryEligible, type FulfillmentType } from '@/lib/delivery'

type Props = {
  value: FulfillmentType
  onChange: (t: FulfillmentType) => void
  drinksSubtotalCents: number
}

export function FulfillmentSelector({ value, onChange, drinksSubtotalCents }: Props) {
  const eligible = isDeliveryEligible(drinksSubtotalCents)
  return (
    <View style={styles.row}>
      <Option
        active={value === 'PICKUP'}
        title="Pickup"
        subtitle="~10 min · 34 Davenport St"
        onPress={() => onChange('PICKUP')}
        testID="fulfillment-pickup"
      />
      <Option
        active={value === 'DELIVERY'}
        title="Delivery"
        subtitle={deliverySubtitle(drinksSubtotalCents)}
        disabled={!eligible}
        onPress={() => eligible && onChange('DELIVERY')}
        testID="fulfillment-delivery"
      />
    </View>
  )
}

function Option({
  active, title, subtitle, onPress, disabled, testID,
}: { active: boolean; title: string; subtitle: string; onPress: () => void; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled: !!disabled }}
      style={[
        styles.option,
        active && { borderColor: BRAND.color, backgroundColor: BRAND.accentColor },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.title, active && { color: BRAND.color }]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 8, marginHorizontal: 16 },
  option: {
    flex: 1, borderWidth: 1.5, borderColor: '#E5DED3', borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff',
  },
  disabled: { opacity: 0.5 },
  title: { fontSize: 15, fontWeight: '700', color: '#3A3A3A' },
  subtitle: { fontSize: 12, color: '#7A7A7A', marginTop: 2 },
})
