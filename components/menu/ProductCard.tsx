import { memo, useEffect, useState } from 'react'
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PressScale } from '@/components/ui/PressScale'
import { SquareImage } from '@/components/ui/SquareImage'
import { CupArt } from '@/components/brand/CupArt'
import { Icon } from '@/components/brand/Icon'
import { hashColor } from '@/components/brand/color'
import { IMG_GRID } from '@/lib/optimized-image'
import { formatPrice } from '@/lib/utils'
import { haptic } from '@/lib/haptics'
import { displayNameFor, imageSourceFor, TOP10_CATEGORY_SLUG } from '@/lib/menu/top10-presets'
import { originalPriceCentsFor } from '@/lib/menu/weekly-specials'
import { isBestseller } from '@/components/menu/bestsellers'
import { CARD_INFO_H } from '@/lib/menu/grid'
import { T, CTA, PIN, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem } from '@/types/square'

// One drink on the menu grid: the photo on its category's pastel, the name,
// the price and a + that opens the sheet.
//
// The photos are studio shots on a near-white ground. Multiplied onto the
// pastel, that ground becomes the pastel and the cup keeps its own colour —
// the grey studio box disappears and every card in a category shares one
// warm ground (the board's "照片用 multiply 压在茶色底上"). Drinks without a
// photo get the cup glyph in a deterministic liquid colour on the same ground.

type Props = {
  item: CatalogItem
  categorySlug?: string
  /** The pastel under the photo — the category's tint. Theme-invariant, so
   *  anything drawn on it uses PIN ink. */
  tint: string
  width: number
  thumbH: number
  onOpen: (item: CatalogItem, categorySlug: string | null) => void
  style?: StyleProp<ViewStyle>
}

/** How much the photo is enlarged inside its square: the cup sits in the
 *  middle third of the studio frame, and at 1 it would be a sliver. */
const PHOTO_SCALE = 1.22

export const ProductCard = memo(function ProductCard({
  item,
  categorySlug,
  tint,
  width,
  thumbH,
  onOpen,
  style,
}: Props) {
  const rawName = item.itemData?.name ?? 'Unknown'
  const name = displayNameFor(categorySlug ?? undefined, rawName) || rawName
  const customImage = imageSourceFor(categorySlug ?? undefined, rawName)
  const firstVariation = item.itemData?.variations?.[0]
  const rawPrice = firstVariation?.itemVariationData?.priceMoney?.amount
  // Inside TOP 10 the locked toppings are mandatory, so show base + surcharge.
  const surcharge =
    categorySlug === TOP10_CATEGORY_SLUG ? (item.itemData?.top10SurchargeCents ?? 0) : 0
  const price = rawPrice != null ? Number(rawPrice) + surcharge : undefined
  const originalPriceCents = originalPriceCentsFor(rawName)
  const isOnSpecial = originalPriceCents != null && price != null && originalPriceCents > price
  const soldOut = item.soldOut === true
  const bestseller = !soldOut && !isOnSpecial && isBestseller(rawName)

  // A photo that is not back from the cache within a beat gets the sketched
  // cup in its place until it is, then the sketch fades and the photo is
  // there. The beat matters: a cached photo arrives within a frame or two,
  // and a sketch that flashed on every card while scrolling would read as
  // the menu stuttering.
  const [photoSlow, setPhotoSlow] = useState(false)
  // Gone once the fade has finished: the sketch is unmounted by hand rather
  // than with a layout exit animation, which a list cell can leave behind.
  const [sketchGone, setSketchGone] = useState(false)
  const sketchOpacity = useSharedValue(1)
  useEffect(() => {
    const t = setTimeout(() => setPhotoSlow(true), 160)
    return () => clearTimeout(t)
  }, [])
  const onPhotoLoad = () => {
    sketchOpacity.value = withTiming(0, { duration: 260 }, (finished) => {
      if (finished) runOnJS(setSketchGone)(true)
    })
  }
  const sketchStyle = useAnimatedStyle(() => ({ opacity: sketchOpacity.value }))
  const showSketch = !customImage && (!item.imageUrl || (photoSlow && !sketchGone))
  const glyphSize = Math.round(thumbH * 0.42)

  // The tap is felt on release, not on touch-down: a finger that lands on a
  // card to scroll the grid is not a press, and answering it on the way down
  // buzzed once per drag.
  const open = () => {
    if (soldOut) {
      haptic.warn()
      return
    }
    haptic.tap()
    onOpen(item, categorySlug ?? null)
  }

  return (
    <PressScale
      scaleTo={0.975}
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${name}${price != null ? `, ${formatPrice(price)}` : ''}${soldOut ? ', sold out' : ''}`}
      style={[styles.card, { width, height: thumbH + CARD_INFO_H }, soldOut && styles.cardSoldOut, style]}
    >
      {/* The two hairline borders come out of the photo square so the card
          measures exactly what lib/menu/grid promised getItemLayout. */}
      <View style={[styles.thumb, { height: thumbH - 2, backgroundColor: tint }]}>
        {customImage ? (
          <Image
            source={customImage}
            style={styles.photo}
            contentFit="cover"
            contentPosition="center"
            transition={160}
          />
        ) : item.imageUrl ? (
          <SquareImage
            url={item.imageUrl}
            width={IMG_GRID}
            style={styles.photo}
            contentFit="cover"
            contentPosition="center"
            transition={160}
            onLoad={onPhotoLoad}
          />
        ) : null}
        {showSketch ? (
          <Animated.View style={[styles.glyph, sketchStyle]} pointerEvents="none">
            <CupArt fill={hashColor(item.id)} stroke={PIN.ink} size={glyphSize} />
          </Animated.View>
        ) : null}

        {bestseller ? (
          <View style={[styles.tag, styles.tagStar]}>
            <Icon name="star" size={9} color={T.star} />
            <Text style={[styles.tagText, styles.tagStarText]}>BESTSELLER</Text>
          </View>
        ) : null}
        {!soldOut && isOnSpecial ? (
          <View style={[styles.tag, styles.tagSpecial]}>
            <Text style={[styles.tagText, styles.tagSpecialText]}>SPECIAL</Text>
          </View>
        ) : null}
        {soldOut ? (
          <View style={styles.veil} pointerEvents="none">
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutText}>SOLD OUT</Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        {/* Top 10 builds carry their topping in the name ("… (with Aloe
            Vera)"): shrink a little before cutting the tail off. */}
        <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
          {name}
        </Text>
        <View style={styles.priceRow}>
          {price != null ? (
            <View style={styles.prices}>
              {isOnSpecial ? (
                <Text style={styles.priceWas}>{formatPrice(originalPriceCents)}</Text>
              ) : null}
              <Text style={[styles.price, isOnSpecial && styles.priceSpecial]}>
                {formatPrice(price)}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <PressScale
            scaleTo={0.86}
            onPress={(e) => {
              e.stopPropagation?.()
              if (soldOut) {
                haptic.warn()
                return
              }
              haptic.add()
              onOpen(item, categorySlug ?? null)
            }}
            hitSlop={8}
            disabled={soldOut}
            accessibilityRole="button"
            accessibilityLabel={`Add ${name}`}
            style={[styles.add, soldOut && styles.addOff]}
          >
            <Icon name="plus" size={16} color={soldOut ? '#fff' : CTA.on} />
          </PressScale>
        </View>
      </View>
    </PressScale>
  )
})

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card - 2,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  cardSoldOut: {
    opacity: 0.62,
  },
  thumb: {
    width: '100%',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The whole square, enlarged; multiply drops the studio ground into the tint.
  photo: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: PHOTO_SCALE }, { translateY: 2 }],
    mixBlendMode: 'multiply',
  },
  glyph: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagStar: { backgroundColor: PIN.chip },
  tagSpecial: { backgroundColor: CTA.bg },
  tagText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 8.5,
    letterSpacing: 1.2,
  },
  tagStarText: { color: PIN.onChip },
  tagSpecialText: { color: CTA.on },
  veil: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,249,240,0.35)',
  },
  soldOutPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: PIN.ink2,
  },
  soldOutText: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: '#fff',
  },
  info: {
    height: CARD_INFO_H,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.2,
    color: T.ink,
    minHeight: 38,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  prices: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flexShrink: 1,
  },
  priceWas: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: T.ink4,
    textDecorationLine: 'line-through',
  },
  price: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 14,
    color: T.ink,
  },
  priceSpecial: {
    color: '#dc2626',
  },
  add: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: CTA.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOff: {
    backgroundColor: T.ink4,
  },
})
