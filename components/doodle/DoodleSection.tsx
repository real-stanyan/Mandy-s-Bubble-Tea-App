import { useState } from 'react'
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SvgXml } from 'react-native-svg'
import { Image as ExpoImage } from 'expo-image'
import { CardBlock } from '@/components/checkout/CardBlock'
import { DoodleModal } from './DoodleModal'
import type { DoodleSlot } from '@/lib/doodle/cartToSlots'
import type { SvgPath } from '@/lib/doodle/types'
import { presetImageSourceForHash } from '@/lib/doodle/gallery-remote'
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
  const s = slot.selection
  if (s === null) {
    // No pick yet → prints a random surprise design.
    return (
      <View style={[styles.preview, styles.surprisePreview]}>
        <Text style={styles.surpriseEmoji}>🎁</Text>
        <Text style={styles.surpriseLabel}>Surprise{'\n'}design</Text>
      </View>
    )
  }
  if (s.kind === 'preset') {
    // Resolve through the shared helper, not GALLERY_MANIFEST directly: a
    // hash the server added after this binary shipped is not in the manifest,
    // and indexing it returned undefined — a blank white square where the
    // customer's chosen design should be.
    return (
      <ExpoImage
        source={presetImageSourceForHash(s.hash)}
        style={styles.preview}
        contentFit="contain"
      />
    )
  }
  if (s.kind === 'photo') {
    return (
      <Image source={{ uri: s.previewUrl }} style={styles.preview} resizeMode="cover" />
    )
  }
  if (s.kind === 'ai') {
    // AI submissions are surprise-mode — no preview image until generation
    // completes. The actual Doubao result is revealed only on the printed cup.
    if (s.previewUri) {
      return <Image source={{ uri: s.previewUri }} style={styles.preview} resizeMode="cover" />
    }
    if (s.aiDoodleId) {
      return (
        <View style={[styles.preview, styles.surprisePreview]}>
          <Text style={styles.surpriseEmoji}>✨</Text>
          <Text style={styles.surpriseLabel}>Surprise{'\n'}on your cup</Text>
        </View>
      )
    }
    return (
      <View style={[styles.preview, styles.surprisePreview]}>
        <ActivityIndicator />
      </View>
    )
  }
  // kind === 'draw'
  return (
    <View style={styles.preview}>
      <SvgXml xml={pathsToInlineSvg(s.paths)} width="100%" height="100%" />
    </View>
  )
}

function sourceBadge(slot: DoodleSlot): string {
  const s = slot.selection
  if (s === null) return '🎁 Surprise'
  if (s.kind === 'ai') return '✨ AI'
  if (s.kind === 'photo') return '📷 Photo'
  if (s.kind === 'draw') return '✏️ Drawn'
  return '🎨 Gallery'
}

export function DoodleSection({ slots, onSlotChange }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  if (slots.length === 0) return null

  return (
    <CardBlock eyebrow="Cup labels" title="Optional · surprise me 🎁">
      <Text style={styles.hint}>
        Leave a cup as is for a random design 🎁, or tap to choose your own.
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {slots.map((slot, i) => {
          const isCustom = slot.selection != null
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
  hint: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontFamily: FONT.sans,
    fontSize: 12,
    lineHeight: 16,
    color: T.ink2,
  },
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
