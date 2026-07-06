import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { T, FONT, RADIUS } from '@/constants/theme'
import { isDeliverablePostcode, DELIVERABLE_POSTCODES } from '@/lib/delivery'
import { placesAutocomplete, placeDetails, type Prediction } from '@/lib/places-client'
import type { DeliveryAddress } from '@/store/cart'

type Props = {
  value: DeliveryAddress
  onChange: (patch: Partial<DeliveryAddress>) => void
  defaultPhone?: string
}

// One Places billing session per form mount.
function useSessionToken(): string {
  const ref = useRef<string>('')
  if (!ref.current) {
    ref.current = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
  return ref.current
}

export function DeliveryAddressForm({ value, onChange, defaultPhone }: Props) {
  const sessionToken = useSessionToken()
  const [query, setQuery] = useState(value.address)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [phone, setPhone] = useState(defaultPhone ?? '')
  const confirmedRef = useRef<string>(value.lat && value.lng ? value.address : '')

  useEffect(() => {
    if (query.trim().length < 3 || query === confirmedRef.current) {
      setPredictions([])
      return
    }
    let cancelled = false
    const id = setTimeout(async () => {
      try {
        const preds = await placesAutocomplete(query, sessionToken)
        if (!cancelled) setPredictions(preds)
      } catch {
        if (!cancelled) setPredictions([])
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [query, sessionToken])

  const selectPrediction = async (p: Prediction) => {
    setPredictions([])
    setQuery(p.description)
    try {
      const d = await placeDetails(p.placeId)
      confirmedRef.current = d.address
      setQuery(d.address)
      onChange({
        address: d.address,
        lat: d.lat,
        lng: d.lng,
        ...(d.postcode ? { postcode: d.postcode } : {}),
      })
    } catch {
      // leave coords unset; quote stays idle until a valid selection
    }
  }

  const handleAddressInput = (text: string) => {
    setQuery(text)
    const diverged = text !== confirmedRef.current
    onChange({ address: text, ...(diverged ? { lat: 0, lng: 0 } : {}) })
  }

  const confirmed = !!value.lat && !!value.lng
  const pc = value.postcode.trim()

  return (
    <View style={styles.wrap}>
      <Field label="Delivery Address">
        <TextInput
          value={query}
          onChangeText={handleAddressInput}
          placeholder="Start typing your address…"
          placeholderTextColor={T.ink3}
          style={styles.input}
          autoCorrect={false}
          testID="delivery-address"
        />
        {confirmed ? (
          <Text style={styles.ok}>✓ Address confirmed</Text>
        ) : query.trim().length > 0 ? (
          <Text style={styles.warn}>Select your address from the list</Text>
        ) : null}
        {predictions.length > 0 && (
          <View style={styles.dropdown}>
            {/* Places returns ≤5 predictions — a plain map avoids nesting a
                VirtualizedList inside the checkout ScrollView (RN error). */}
            <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {predictions.map((p) => (
                <Pressable key={p.placeId} style={styles.predRow} onPress={() => selectPrediction(p)}>
                  <Text style={styles.predText}>{p.description}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
      </Field>

      <Field label="Postcode (required for delivery)">
        <TextInput
          value={value.postcode}
          onChangeText={(t) => onChange({ postcode: t.replace(/[^0-9]/g, '').slice(0, 4) })}
          placeholder="4215"
          placeholderTextColor={T.ink3}
          keyboardType="number-pad"
          maxLength={4}
          style={styles.input}
          testID="delivery-postcode"
        />
        {pc.length === 4 &&
          (isDeliverablePostcode(pc) ? (
            <Text style={styles.ok}>✓ In our delivery zone</Text>
          ) : (
            <Text style={styles.warn}>
              Sorry, we only deliver to {DELIVERABLE_POSTCODES.join(', ')}.
            </Text>
          ))}
      </Field>

      <Field label="Apartment / Unit (optional)">
        <TextInput
          value={value.unit}
          onChangeText={(t) => onChange({ unit: t })}
          placeholder="Unit 2"
          placeholderTextColor={T.ink3}
          style={styles.input}
        />
      </Field>

      <Field label="Note for driver (optional)">
        <TextInput
          value={value.driverNote}
          onChangeText={(t) => onChange({ driverNote: t.slice(0, 120) })}
          placeholder="Gate code, landmark…"
          placeholderTextColor={T.ink3}
          multiline
          style={[styles.input, styles.multiline]}
        />
      </Field>

      <Field label="Phone (required for delivery)">
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="0404 978 238"
          placeholderTextColor={T.ink3}
          keyboardType="phone-pad"
          style={styles.input}
        />
      </Field>
    </View>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8, marginHorizontal: 16 },
  field: { gap: 4 },
  label: { fontFamily: FONT.sans, fontSize: 12.5, fontWeight: '600', color: T.ink2 },
  input: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.small,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontFamily: FONT.sans,
    fontSize: 14,
    color: T.ink,
    backgroundColor: T.paper,
  },
  multiline: { minHeight: 60, textAlignVertical: 'top' },
  ok: { fontFamily: FONT.sans, fontSize: 12, color: T.greenDark, marginTop: 2 },
  warn: { fontFamily: FONT.sans, fontSize: 12, color: '#B07A1E', marginTop: 2 },
  dropdown: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.small,
    marginTop: 4,
    maxHeight: 180,
    backgroundColor: T.paper,
    overflow: 'hidden',
  },
  predRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.line,
  },
  predText: { fontFamily: FONT.sans, fontSize: 13, color: T.ink },
})
