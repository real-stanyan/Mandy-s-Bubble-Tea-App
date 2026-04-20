import { memo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LegalModal } from '@/components/legal/LegalModal'
import type { LegalKind } from '@/lib/legal'
import { T, SPACING } from '@/constants/theme'

export const LegalFooter = memo(function LegalFooter() {
  const [kind, setKind] = useState<LegalKind | null>(null)

  return (
    <>
      <View style={styles.wrap}>
        <Pressable onPress={() => setKind('privacy')} hitSlop={8}>
          <Text style={styles.link}>Privacy</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={() => setKind('terms')} hitSlop={8}>
          <Text style={styles.link}>Terms</Text>
        </Pressable>
      </View>

      <LegalModal
        visible={kind !== null}
        kind={kind ?? 'privacy'}
        onClose={() => setKind(null)}
      />
    </>
  )
})

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  link: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.ink3,
  },
  dot: {
    color: T.ink4,
    fontSize: 12,
  },
})
