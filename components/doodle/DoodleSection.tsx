import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { PressScale } from '@/components/ui/PressScale'
import { CardBlock } from '@/components/checkout/CardBlock'
import { DoodleModal } from './DoodleModal'
import { StickerPreview, selectionSummary } from './StickerPreview'
import type { DoodleSlot } from '@/lib/doodle/cartToSlots'
import { useAuth } from '@/components/auth/AuthProvider'
import { T, CTA, FONT, RADIUS } from '@/constants/theme'
import { PHOTO_LABELS_OFFLINE, PHOTO_LABELS_OFFLINE_NOTICE } from '@/lib/doodle/label-mode'

interface Props {
  slots: DoodleSlot[]
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

const CARD_STICKER_W = 92

export function DoodleSection({ slots, onSlotChange }: Props) {
  if (PHOTO_LABELS_OFFLINE) return <DoodleOfflineNotice slots={slots} onSlotChange={onSlotChange} />
  return <DoodlePickerSection slots={slots} onSlotChange={onSlotChange} />
}

// Shown while the 40×30 text-only paper is loaded (lib/doodle/label-mode.ts).
// Also drains any selection still persisted in the cart — a stale pending
// AI/draw pick would otherwise block Pay with no picker left to clear it.
function DoodleOfflineNotice({ slots, onSlotChange }: Props) {
  useEffect(() => {
    slots.forEach((slot, i) => {
      if (slot.selection != null) onSlotChange(i, { ...slot, selection: null })
    })
  }, [slots, onSlotChange])

  if (slots.length === 0) return null
  return (
    <CardBlock eyebrow="Cup labels" title="Back soon 💤">
      <Text style={styles.hint}>{PHOTO_LABELS_OFFLINE_NOTICE}</Text>
    </CardBlock>
  )
}

// One card per cup, each carrying a small to-scale sticker — the same
// object the picker shows large — so the checkout answers "what's on my
// cups" at a glance and the row reads as a set of stickers, not a set of
// settings.
function DoodlePickerSection({ slots, onSlotChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const { profile } = useAuth()
  const greeting = profile?.first_name ? `Hi, ${profile.first_name}` : 'Hi there'
  if (slots.length === 0) return null

  return (
    <CardBlock eyebrow="Cup labels · optional" title="Stickers on your cups 🐱">
      <Text style={styles.hint}>
        Every cup gets a printed sticker. Leave it for a surprise lucky cat, or tap a cup to
        put your own design on it.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {slots.map((slot, i) => {
          const chosen = slot.selection != null
          const cupFraction = slot.totalCups > 1 ? `${slot.cupIdx + 1}/${slot.totalCups}` : ''
          return (
            <PressScale
              haptic
              key={`${slot.lineId}:${slot.cupIdx}`}
              onPress={() => setOpenIdx(i)}
              accessibilityRole="button"
              accessibilityLabel={`${chosen ? 'Change' : 'Choose'} the label for ${slot.drinkName}${
                slot.totalCups > 1 ? `, cup ${slot.cupIdx + 1} of ${slot.totalCups}` : ''
              }`}
              style={[styles.cup, chosen && styles.cupChosen]}
            >
              <View style={styles.cupSticker}>
                <StickerPreview
                  selection={slot.selection}
                  greeting={greeting}
                  cupFraction={cupFraction}
                  drinkName={slot.drinkName}
                  variationName={slot.variationName}
                  width={CARD_STICKER_W}
                />
              </View>
              <Text style={styles.cupName} numberOfLines={1}>
                {slot.drinkName}
              </Text>
              <Text style={[styles.cupSummary, chosen && styles.cupSummaryChosen]} numberOfLines={1}>
                {selectionSummary(slot.selection)}
              </Text>
              <View style={[styles.cupBtn, chosen && styles.cupBtnGhost]}>
                <Text style={[styles.cupBtnText, chosen && styles.cupBtnGhostText]}>
                  {chosen ? 'Change' : 'Choose'}
                </Text>
              </View>
            </PressScale>
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
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontFamily: FONT.sans,
    fontSize: 12,
    lineHeight: 16,
    color: T.ink3,
  },
  row: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  cup: {
    width: 148,
    padding: 12,
    borderRadius: RADIUS.tile,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    alignItems: 'center',
    gap: 6,
  },
  cupChosen: {
    borderColor: T.brand,
    backgroundColor: T.paper,
  },
  cupSticker: { paddingVertical: 8 },
  cupName: {
    alignSelf: 'stretch',
    fontFamily: FONT.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: T.ink,
    textAlign: 'center',
  },
  cupSummary: {
    alignSelf: 'stretch',
    fontFamily: FONT.sans,
    fontSize: 11,
    color: T.ink3,
    textAlign: 'center',
  },
  cupSummaryChosen: { color: T.brand, fontWeight: '700' },
  cupBtn: {
    marginTop: 4,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: CTA.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cupBtnGhost: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
  },
  cupBtnText: { fontFamily: FONT.sans, fontSize: 12, fontWeight: '700', color: CTA.on },
  cupBtnGhostText: { color: T.ink2 },
})
