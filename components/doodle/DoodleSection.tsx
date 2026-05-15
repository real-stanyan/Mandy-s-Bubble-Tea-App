import { useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { CardBlock } from '@/components/checkout/CardBlock'
import { DoodleModal } from './DoodleModal'
import type { DoodleSlot, SvgPath } from '@/lib/doodle/cartToSlots'
import { POOL } from '@/lib/doodle/pool'
import { T, FONT, RADIUS } from '@/constants/theme'

interface Props {
  slots: DoodleSlot[]
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

const USER_PATH_CANVAS = 400

function pathsToInlineSvg(paths: SvgPath[]): string {
  // Mirrors the server's pathsJsonToSvg shape so the preview here lines
  // up roughly with what gets binarised for print.
  const els = paths
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${USER_PATH_CANVAS} ${USER_PATH_CANVAS}" width="100%" height="100%">${els}</svg>`
}

function CupPreview({ slot }: { slot: DoodleSlot }) {
  // AI submissions are surprise-mode — no preview image, just a
  // sparkle placeholder. The aiDoodleId is set as soon as /ai-submit
  // returns; the actual Doubao result is revealed only on the
  // printed cup.
  if (slot.aiDoodleId) {
    return (
      <View style={[styles.preview, styles.surprisePreview]}>
        <Text style={styles.surpriseEmoji}>✨</Text>
        <Text style={styles.surpriseLabel}>Surprise{'\n'}on your cup</Text>
      </View>
    )
  }
  if (slot.uploadedPreviewUrl) {
    return (
      <Image source={{ uri: slot.uploadedPreviewUrl }} style={styles.preview} resizeMode="cover" />
    )
  }
  if ((slot.userPaths?.length ?? 0) > 0) {
    return (
      <View style={styles.preview}>
        <SvgXml xml={pathsToInlineSvg(slot.userPaths!)} width="100%" height="100%" />
      </View>
    )
  }
  const preset = POOL.find((p) => p.key === slot.defaultKey) ?? POOL[0]
  return (
    <View style={styles.preview}>
      <SvgXml xml={preset.svg} width="100%" height="100%" />
    </View>
  )
}

function sourceBadge(slot: DoodleSlot): string {
  if (slot.aiDoodleId) return '✨ AI'
  if (slot.uploadedDoodleId) return '📷 Photo'
  if ((slot.userPaths?.length ?? 0) > 0) return '✏️ Drawn'
  return '🎨 Preset'
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
          const isCustom =
            !!slot.aiDoodleId ||
            !!slot.uploadedDoodleId ||
            (slot.userPaths?.length ?? 0) > 0
          return (
            <Pressable
              key={`${slot.lineId}:${slot.cupIdx}`}
              onPress={() => setOpenIdx(i)}
              style={[styles.cup, isCustom && styles.cupCustom]}
            >
              <View style={styles.cupHeader}>
                <Text style={styles.cupNum}>Cup {i + 1}</Text>
                <Text style={styles.cupBadge}>{sourceBadge(slot)}</Text>
              </View>
              <CupPreview slot={slot} />
              <Text style={styles.cupName} numberOfLines={2}>
                {slot.drinkName}
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
    width: 132,
    padding: 10,
    borderRadius: RADIUS.small,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    gap: 8,
  },
  cupCustom: {
    borderColor: T.brand,
    backgroundColor: 'rgba(196,58,16,0.06)',
  },
  cupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cupNum: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  cupBadge: {
    fontFamily: FONT.sans,
    fontSize: 10,
    fontWeight: '700',
    color: T.ink2,
  },
  preview: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: RADIUS.small,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  surprisePreview: {
    backgroundColor: T.paper,
    gap: 4,
  },
  surpriseEmoji: {
    fontSize: 32,
  },
  surpriseLabel: {
    fontFamily: FONT.sans,
    fontSize: 11,
    fontWeight: '700',
    color: T.brand,
    textAlign: 'center',
    lineHeight: 14,
  },
  cupName: {
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '600',
    color: T.ink,
  },
})
