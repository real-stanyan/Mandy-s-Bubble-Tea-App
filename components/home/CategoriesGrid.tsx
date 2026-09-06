import { useMemo } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { PressScale } from '@/components/ui/PressScale'
import { CategoryArt } from '@/components/brand/CategoryArt'
import { useMenu } from '@/hooks/use-menu'
import { useMenuJumpStore } from '@/store/menuJump'
import { CATEGORY_ART_TINT, type CategoryArtKind } from '@/lib/menu/category-art'
import { RADIUS } from '@/constants/theme'
import { SectionHead } from './SectionHead'
import { resolveCategorySlug } from './helpers'

// Browse the menu: the eight categories as a two-column grid of the living
// illustrations, each with its name and how many drinks it holds. Tapping
// one lands on that section of the Menu tab.

type HomeCategory = { slug: string; label: string; kind: CategoryArtKind }

const HOME_CATEGORIES: readonly HomeCategory[] = [
  { slug: 'top-10', label: 'Top 10', kind: 'top10' },
  { slug: 'milk-tea', label: 'Milk Tea', kind: 'milk' },
  { slug: 'fruity-green-tea', label: 'Fruity Green Tea', kind: 'green' },
  { slug: 'fruity-black-tea', label: 'Fruity Black Tea', kind: 'black' },
  { slug: 'fresh-brew', label: 'Fresh Brew', kind: 'brew' },
  { slug: 'frozen', label: 'Frozen', kind: 'frozen' },
  { slug: 'cheese-cream', label: 'Cheese Cream', kind: 'cheese' },
  { slug: 'special-mix', label: 'Special Mix', kind: 'mix' },
] as const

export function CategoriesGrid() {
  const router = useRouter()
  const { items, categories } = useMenu()
  const setPending = useMenuJumpStore((s) => s.setPending)
  // Explicit sizes: a percentage width with aspectRatio came out half-height
  // inside this wrapping row on Android, so the tile is measured from the
  // window instead (two across, 16pt margins, 10pt gutter, 1.9:1).
  const { width } = useWindowDimensions()
  const tileW = Math.floor((width - 32 - 10) / 2)
  const tileH = Math.round(tileW / 1.9)

  const jumpToMenu = (slug: string | null) => {
    setPending(slug)
    router.push('/(tabs)/menu')
  }

  const countsBySlug = useMemo(() => {
    const map = new Map<string, number>()
    for (const cat of categories) {
      const slug = resolveCategorySlug(cat.name)
      const n = items.filter((item) => (item.itemData?.categories ?? []).some((c) => c.id === cat.id)).length
      map.set(slug, (map.get(slug) ?? 0) + n)
    }
    return map
  }, [items, categories])

  return (
    <View style={{ marginBottom: 20 }}>
      <SectionHead
        eyebrow={items.length > 0 ? `${items.length} drinks` : undefined}
        label="Browse the menu"
        actionLabel="See all"
        onAction={() => jumpToMenu(null)}
      />
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {HOME_CATEGORIES.map((c) => {
          const count = countsBySlug.get(c.slug)
          const sub = c.slug === 'top-10' ? 'MOST ORDERED' : count == null ? '—' : `${count} DRINKS`
          return (
            <PressScale
              key={c.slug}
              haptic
              onPress={() => jumpToMenu(c.slug)}
              accessibilityRole="button"
              accessibilityLabel={`${c.label}, ${sub.toLowerCase()}`}
              style={{
                width: tileW,
                height: tileH,
                borderRadius: RADIUS.tile + 2,
                backgroundColor: CATEGORY_ART_TINT[c.kind],
                overflow: 'hidden',
              }}
            >
              <CategoryArt kind={c.kind} crop="tile" />
              {/* Pinned day ink: the tiles keep their pastel in evening mode. */}
              <View style={{ position: 'absolute', left: 12, bottom: 10 }}>
                <Text
                  style={{ fontFamily: 'ShantellSans_700Bold', fontSize: 14, lineHeight: 16, letterSpacing: -0.3, color: '#2A1E14', maxWidth: tileW - 60 }}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
                <Text style={{ fontFamily: 'JetBrainsMono_700Bold', fontSize: 9.5, letterSpacing: 1, color: 'rgba(42,30,20,0.55)', marginTop: 1 }}>
                  {sub}
                </Text>
              </View>
            </PressScale>
          )
        })}
      </View>
    </View>
  )
}
