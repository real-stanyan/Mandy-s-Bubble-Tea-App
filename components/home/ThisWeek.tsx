import { useMemo } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useMenu } from '@/hooks/use-menu'
import { useItemSheetStore } from '@/store/itemSheet'
import { useMenuJumpStore } from '@/store/menuJump'
import { PressScale } from '@/components/ui/PressScale'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { CupArt } from '@/components/brand/CupArt'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import {
  WEEKLY_SPECIALS_CATEGORY_ID,
  normalizeItemName,
  orderedWeeklySpecialNames,
  originalPriceCentsFor,
} from '@/lib/menu/weekly-specials'
import type { CatalogItem } from '@/types/square'
import { SectionHead } from './SectionHead'

// This week's specials on Home, with photos and the price they were: the
// same virtual shelf the Menu pins first, in the same order. Only drinks
// whose Square price is actually below the remembered original show a
// saving — if Stan hasn't dropped the price yet, or has restored it, the
// rail simply skips the strikethrough.

const CARD_W = 140

type Special = { item: CatalogItem; priceCents: number; wasCents: number | null }

function priceOf(item: CatalogItem): number | null {
  const raw = item.itemData?.variations?.[0]?.itemVariationData?.priceMoney?.amount
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function ThisWeek() {
  const router = useRouter()
  const { items } = useMenu()
  const setPending = useMenuJumpStore((s) => s.setPending)

  const specials = useMemo<Special[]>(() => {
    const byName = new Map<string, CatalogItem>()
    for (const item of items) {
      const name = item.itemData?.name
      if (name) byName.set(normalizeItemName(name), item)
    }
    const out: Special[] = []
    for (const key of orderedWeeklySpecialNames()) {
      const item = byName.get(key)
      if (!item || item.soldOut) continue
      const priceCents = priceOf(item)
      if (priceCents == null) continue
      const original = originalPriceCentsFor(item.itemData?.name ?? '')
      out.push({ item, priceCents, wasCents: original != null && original > priceCents ? original : null })
    }
    return out
  }, [items])

  if (specials.length === 0) return null

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead
        eyebrow="Weekly specials"
        label="This week"
        actionLabel="All specials"
        onAction={() => {
          setPending(WEEKLY_SPECIALS_CATEGORY_ID)
          router.push('/(tabs)/menu')
        }}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_W + 10}
        contentContainerStyle={{ paddingLeft: 20, paddingRight: 14, gap: 10 }}
      >
        {specials.map((s) => (
          <SpecialCard key={s.item.id} special={s} />
        ))}
      </ScrollView>
    </View>
  )
}

function SpecialCard({ special }: { special: Special }) {
  const { item, priceCents, wasCents } = special
  const name = item.itemData?.name ?? ''
  const saving = wasCents != null ? wasCents - priceCents : 0
  return (
    <PressScale
      haptic
      onPress={() => useItemSheetStore.getState().open(item.id, WEEKLY_SPECIALS_CATEGORY_ID)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, A$${(priceCents / 100).toFixed(2)}${wasCents ? `, was A$${(wasCents / 100).toFixed(2)}` : ''}`}
      style={{
        width: CARD_W,
        padding: 10,
        paddingBottom: 12,
        backgroundColor: T.card,
        borderRadius: RADIUS.card - 4,
        borderWidth: 1,
        borderColor: T.line,
        ...SHADOW.card,
      }}
    >
      <View
        style={{
          height: 104,
          borderRadius: RADIUS.tile - 2,
          overflow: 'hidden',
          backgroundColor: T.bg2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {item.imageUrl ? (
          <SquareImage url={item.imageUrl} width={IMG_THUMB} style={{ width: CARD_W - 20, height: 104 }} />
        ) : (
          <CupArt fill={T.brand} stroke={T.ink} size={56} />
        )}
      </View>
      {saving > 0 ? (
        <View
          style={{
            position: 'absolute',
            left: 18,
            top: 18,
            paddingHorizontal: 6,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: T.brand,
          }}
        >
          <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 9.5, letterSpacing: 0.6, color: '#fff' }}>
            {`−A$${(saving / 100).toFixed(2)}`}
          </Text>
        </View>
      ) : null}
      <Text
        style={{ fontFamily: 'ShantellSans_700Bold', fontSize: 13.5, lineHeight: 16, letterSpacing: -0.2, color: T.ink, marginTop: 8, minHeight: 32 }}
        numberOfLines={2}
      >
        {name}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
        <Text style={[TYPE.priceSm, { fontSize: 12.5, color: T.ink2 }]}>{`A$${(priceCents / 100).toFixed(2)}`}</Text>
        {wasCents != null ? (
          <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 11, color: T.ink4, textDecorationLine: 'line-through' }}>
            {(wasCents / 100).toFixed(2)}
          </Text>
        ) : null}
      </View>
    </PressScale>
  )
}
