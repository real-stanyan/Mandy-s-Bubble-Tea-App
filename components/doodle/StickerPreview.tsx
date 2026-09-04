// components/doodle/StickerPreview.tsx
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { SvgXml } from 'react-native-svg'
import { PresetImage } from './PresetImage'
import type { CupLabelSelection } from '@/store/cart'
import type { SvgPath } from '@/lib/doodle/types'
import { API_BASE } from '@/lib/api'
import { FONT } from '@/constants/theme'

// A to-scale mock of the 50×80mm sticker the shop's Zebra prints (web's
// StickerPreview, same geometry): black top band with the greeting and
// sticker number, a full-width square of artwork, the drink name below.
// Showing the object itself — not a bare thumbnail — is what turns "choose
// a label" into designing a cup.
//
// Paper is always white, even in Evening Mode: the sticker is a physical
// thing, so its colours are literals rather than theme tokens.

const PAPER = '#FFFFFF'
const INK = '#111111'
const SIDE_RATIO = 945 / 590 // height / width
const TOP_BAND_RATIO = 0.095 // 90 of 945 dots
const USER_PATH_CANVAS = 400

/** Representative cat for the no-pick default — the printer picks one at
 *  random, so this is a hint at what prints, not a promise. */
export const LUCKY_CAT_SAMPLE = `${API_BASE}/cup-label/lucky-cat/a59c1cc2694cc43822317a53cce9463b/binarized.png`

function pathsToInlineSvg(paths: SvgPath[]): string {
  // Mirrors the server's pathsJsonToSvg shape so the preview here lines
  // up with what gets binarised for print.
  const els = paths
    .map(
      (p) =>
        `<path d="${p.d}" stroke="${p.stroke}" stroke-width="${p.width}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${USER_PATH_CANVAS} ${USER_PATH_CANVAS}" width="100%" height="100%">${els}</svg>`
}

/** One line for the cup card under the sticker. */
export function selectionSummary(selection: CupLabelSelection | null): string {
  if (selection === null) return '🐱 Surprise lucky cat'
  if (selection.kind === 'preset') return '🎨 Gallery design'
  if (selection.kind === 'photo') return '📷 Your photo'
  if (selection.kind === 'draw') return `✏️ Your drawing${selection.userDoodleId ? '' : ''}`
  const p = selection.prompt.slice(0, 28)
  return `✨ AI · ${p}${selection.prompt.length > 28 ? '…' : ''}${selection.aiDoodleId ? '' : ' (sending…)'}`
}

/** The artwork square for a selection. Fills its parent, which sets the
 *  size; the parent should be square. */
export function StickerArt({ selection }: { selection: CupLabelSelection | null }) {
  if (selection === null) {
    return (
      <Image
        source={{ uri: LUCKY_CAT_SAMPLE }}
        style={styles.fill}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={120}
      />
    )
  }
  if (selection.kind === 'preset') {
    return <PresetImage hash={selection.hash} style={styles.fill} />
  }
  if (selection.kind === 'photo') {
    return (
      <Image
        source={{ uri: selection.previewUrl }}
        style={styles.fill}
        contentFit="contain"
        cachePolicy="memory-disk"
      />
    )
  }
  if (selection.kind === 'ai') {
    if (selection.previewUri) {
      return <Image source={{ uri: selection.previewUri }} style={styles.fill} contentFit="contain" />
    }
    // Generated in the background; revealed on the printed cup. The
    // pending glyph says "something is coming" without inventing an image.
    return (
      <View style={styles.pending}>
        {selection.aiDoodleId ? (
          <Text style={styles.pendingGlyph}>✨</Text>
        ) : (
          <ActivityIndicator color={INK} />
        )}
        <Text style={styles.pendingCaption}>
          {selection.aiDoodleId ? 'SURPRISE ON YOUR CUP' : 'SENDING…'}
        </Text>
      </View>
    )
  }
  if (selection.paths.length === 0) {
    return (
      <View style={styles.pending}>
        <Text style={styles.pendingGlyph}>✏️</Text>
        <Text style={styles.pendingCaption}>YOUR DRAWING</Text>
      </View>
    )
  }
  return <SvgXml xml={pathsToInlineSvg(selection.paths)} width="100%" height="100%" />
}

type Props = {
  selection: CupLabelSelection | null
  /** "Hi, Stan" — the top-band greeting the printer uses. */
  greeting: string
  /** "1/2" for multi-cup orders, otherwise empty. */
  cupFraction: string
  drinkName: string
  variationName: string
  /** Rendered width in px; everything else scales from it. */
  width: number
  /** Slight tilt reads as a sticker rather than a card. */
  tilt?: boolean
}

export function StickerPreview({
  selection,
  greeting,
  cupFraction,
  drinkName,
  variationName,
  width,
  tilt = false,
}: Props) {
  const height = width * SIDE_RATIO
  const topBand = height * TOP_BAND_RATIO
  const bottomBand = height - topBand - width
  // Type scales with the sticker: 172px wide ≈ the web's 16px base.
  const em = width / 172 * 16
  return (
    <View
      style={[
        styles.sticker,
        { width, height, borderRadius: width * 0.09 },
        tilt && { transform: [{ rotate: '-1.5deg' }] },
      ]}
      accessibilityLabel="Preview of the printed cup label"
    >
      <View style={[styles.topBand, { height: topBand, paddingHorizontal: width * 0.06 }]}>
        <Text style={[styles.topText, { fontSize: em * 0.72 }]} numberOfLines={1}>
          {greeting}
        </Text>
        <Text style={[styles.topText, { fontSize: em * 0.72 }]} numberOfLines={1}>
          OL··· {cupFraction}
        </Text>
      </View>
      <View style={{ width, height: width, padding: width * 0.04 }}>
        <View style={styles.fill}>
          <StickerArt selection={selection} />
        </View>
      </View>
      <View
        style={[
          styles.bottomBand,
          { height: bottomBand, paddingHorizontal: width * 0.07, paddingBottom: width * 0.04 },
        ]}
      >
        <Text style={[styles.drink, { fontSize: em * 0.78 }]} numberOfLines={1}>
          {drinkName}
        </Text>
        {variationName ? (
          <Text style={[styles.variation, { fontSize: em * 0.62 }]} numberOfLines={1}>
            {variationName}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  sticker: {
    backgroundColor: PAPER,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#2A1E14',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 6,
  },
  topBand: {
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  topText: {
    fontFamily: FONT.serif,
    color: PAPER,
    flexShrink: 1,
  },
  bottomBand: {
    justifyContent: 'center',
  },
  drink: {
    fontFamily: FONT.serif,
    color: INK,
  },
  variation: {
    fontFamily: FONT.sans,
    color: INK,
    opacity: 0.7,
    marginTop: 1,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  pending: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pendingGlyph: {
    fontSize: 28,
  },
  pendingCaption: {
    fontFamily: FONT.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: INK,
    opacity: 0.6,
  },
})
