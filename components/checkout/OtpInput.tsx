import { useRef, useCallback } from 'react'
import {
  View,
  TextInput,
  StyleSheet,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native'
import { BRAND } from '@/lib/constants'

const CODE_LENGTH = 6

interface Props {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  error?: boolean
}

export function OtpInput({ value, onChange, disabled, error }: Props) {
  const inputsRef = useRef<(TextInput | null)[]>([])

  const focusIndex = useCallback((i: number) => {
    inputsRef.current[i]?.focus()
  }, [])

  const handleChange = useCallback(
    (i: number, text: string) => {
      // Handle paste: if text is multiple digits, distribute across boxes
      const digits = text.replace(/\D/g, '')
      if (digits.length > 1) {
        const pasted = digits.slice(0, CODE_LENGTH)
        onChange(pasted)
        focusIndex(Math.min(pasted.length, CODE_LENGTH - 1))
        return
      }

      const digit = digits.slice(0, 1)
      const chars = value.split('')
      while (chars.length < CODE_LENGTH) chars.push('')
      chars[i] = digit
      const next = chars.join('').slice(0, CODE_LENGTH)
      onChange(next)
      if (digit && i < CODE_LENGTH - 1) {
        focusIndex(i + 1)
      }
    },
    [value, onChange, focusIndex],
  )

  const handleKeyPress = useCallback(
    (i: number, e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (e.nativeEvent.key === 'Backspace' && !value[i] && i > 0) {
        focusIndex(i - 1)
      }
    },
    [value, focusIndex],
  )

  return (
    <View style={styles.row}>
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            inputsRef.current[i] = el
          }}
          style={[
            styles.box,
            error
              ? styles.boxError
              : value[i]
                ? styles.boxFilled
                : styles.boxEmpty,
          ]}
          keyboardType="number-pad"
          maxLength={i === 0 ? CODE_LENGTH : 1}
          value={value[i] ?? ''}
          editable={!disabled}
          onChangeText={(text) => handleChange(i, text)}
          onKeyPress={(e) => handleKeyPress(i, e)}
          autoFocus={i === 0}
          selectTextOnFocus
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: 8,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  boxEmpty: {
    borderColor: '#d4d4d8',
  },
  boxFilled: {
    borderColor: BRAND.color,
  },
  boxError: {
    borderColor: '#ef4444',
  },
})
