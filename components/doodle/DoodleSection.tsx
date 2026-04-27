import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { CardBlock } from '@/components/checkout/CardBlock'
import { DoodleModal } from './DoodleModal'
import type { DoodleSlot } from '@/lib/doodle/cartToSlots'
import { T, FONT, RADIUS } from '@/constants/theme'

interface Props {
  slots: DoodleSlot[]
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

export function DoodleSection({ slots, onSlotChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (slots.length === 0) return null

  return (
    <CardBlock eyebrow="Cup labels" title="Doodle each cup (optional)">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {slots.map((slot, i) => {
          const drawn = (slot.userPaths?.length ?? 0) > 0
          return (
            <Pressable
              key={`${slot.lineId}:${slot.cupIdx}`}
              onPress={() => setOpenIdx(i)}
              style={[styles.cup, drawn && styles.cupDrawn]}
            >
              <Text style={styles.cupNum}>Cup {i + 1}</Text>
              <Text style={styles.cupName} numberOfLines={2}>{slot.drinkName}</Text>
              <Text style={styles.cupState}>
                {drawn ? '✓ doodled' : `default · ${slot.defaultKey}`}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <DoodleModal
        visible={openIdx !== null}
        slots={slots}
        initialIndex={openIdx ?? 0}
        onClose={() => setOpenIdx(null)}
        onSlotChange={onSlotChange}
      />
    </CardBlock>
  )
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  cup: {
    width: 110,
    minHeight: 110,
    padding: 12,
    borderRadius: RADIUS.small,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    justifyContent: 'space-between',
  },
  cupDrawn: { borderColor: T.brand, backgroundColor: 'rgba(196,58,16,0.06)' },
  cupNum: {
    fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.3,
    fontWeight: '700', color: T.brand, textTransform: 'uppercase',
  },
  cupName: { fontFamily: FONT.sans, fontSize: 12, fontWeight: '600', color: T.ink, marginTop: 4 },
  cupState: { fontFamily: FONT.sans, fontSize: 11, color: T.ink2, marginTop: 6 },
})
