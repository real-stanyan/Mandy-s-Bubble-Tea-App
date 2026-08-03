import { memo, useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  type SectionListData,
  type ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import * as Haptics from 'expo-haptics'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import { getStoreStatus, resolveCategorySlug } from '@/components/home/helpers'
import { useMenuJumpStore } from '@/store/menuJump'
import { useMenu } from '@/hooks/use-menu'
import { SkeletonSection } from '@/components/menu/SkeletonCard'
import { PublicHolidayBanner } from '@/components/home/PublicHolidayBanner'
import { formatPrice } from '@/lib/utils'
import { useItemSheetStore } from '@/store/itemSheet'
import { displayNameFor, imageSourceFor, TOP10_CATEGORY_SLUG } from '@/lib/menu/top10-presets'
import {
  WEEKLY_SPECIALS_CATEGORY_ID,
  WEEKLY_SPECIALS_CATEGORY_NAME,
  orderedWeeklySpecialNames,
  originalPriceCentsFor,
} from '@/lib/menu/weekly-specials'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem, CatalogCategory } from '@/types/square'

type SectionMeta = { category: CatalogCategory; index: number }
type MenuSection = SectionListData<CatalogItem, SectionMeta>

// Estimated native heights, used to synthesize getItemLayout so SectionList
// can seek to any section directly by pixel offset instead of virtualizing
// forward and firing onScrollToIndexFailed on far jumps.
// SectionHeader: marginTop(24) + padding(14) + title(22) + marginBottom(10)
//                + banner(96) + padding(14) + marginBottom(8) ≈ 188
// Row:           paddingV(10) + image(76) + paddingV(10) = 96
const ROW_H = 96
const HEADER_H = 188
const FOOTER_H = 0

function buildGetItemLayout(sections: MenuSection[]) {
  return (_data: unknown, flatIndex: number) => {
    let offset = 0
    let counter = 0
    for (const s of sections) {
      if (counter === flatIndex) return { length: HEADER_H, offset, index: flatIndex }
      counter++
      offset += HEADER_H
      for (let i = 0; i < s.data.length; i++) {
        if (counter === flatIndex) return { length: ROW_H, offset, index: flatIndex }
        counter++
        offset += ROW_H
      }
      if (counter === flatIndex) return { length: FOOTER_H, offset, index: flatIndex }
      counter++
      offset += FOOTER_H
    }
    return { length: 0, offset, index: flatIndex }
  }
}

const CATEGORY_BANNERS: Record<string, ReturnType<typeof require>> = {
  milky: require('@/assets/images/categories/milky.webp'),
  milktea: require('@/assets/images/categories/milky.webp'),
  fruity: require('@/assets/images/categories/fruity.webp'),
  fruitygreentea: require('@/assets/images/categories/fruity.webp'),
  specialmix: require('@/assets/images/categories/special-mix.webp'),
  freshbrew: require('@/assets/images/categories/fresh-brew.webp'),
  fruityblacktea: require('@/assets/images/categories/fruity-black-tea.webp'),
  frozen: require('@/assets/images/categories/frozen.webp'),
  cheesecream: require('@/assets/images/categories/cheese-cream.webp'),
}

function categoryBanner(name: string) {
  const key = name.toLowerCase().replace(/[^a-z]/g, '')
  return CATEGORY_BANNERS[key]
}

export default function MenuScreen() {
  const insets = useSafeAreaInsets()
  const { items, categories, loading, error } = useMenu()
  const sectionListRef = useRef<SectionList<CatalogItem, SectionMeta>>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollingToRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const storeStatus = getStoreStatus()
  const statusLabel = storeStatus.open
    ? `Open · closes ${storeStatus.nextLabel.replace(/^until\s+/, '')}`
    : `Closed · opens ${storeStatus.nextLabel}`

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((it) =>
      (it.itemData?.name ?? '').toLowerCase().includes(q),
    )
  }, [items, query])

  // Weekly Specials — a virtual shelf pinned first, not a real Square
  // category, so it can't be built by the category-id filter below (no item
  // declares membership in a category that doesn't exist in Square). Matched
  // by name instead; silently empty if none of this week's names match the
  // current catalog (a rename, or the promo isn't live) — never a broken
  // empty section.
  const specialItems = useMemo(() => {
    if (items.length === 0) return []
    const byName = new Map<string, CatalogItem>()
    for (const it of items) {
      const key = (it.itemData?.name ?? '').trim().toLowerCase()
      if (key && !byName.has(key)) byName.set(key, it)
    }
    const out: CatalogItem[] = []
    for (const name of orderedWeeklySpecialNames()) {
      const hit = byName.get(name)
      if (hit) out.push(hit)
    }
    return out
  }, [items])

  const sections = useMemo<MenuSection[]>(() => {
    if (categories.length === 0 || items.length === 0) return []
    const base = categories
      .map((cat) => ({
        category: cat,
        data: items.filter((item) =>
          item.itemData?.categories?.some((c) => c.id === cat.id),
        ),
      }))
      .filter((s) => s.data.length > 0)
    const withSpecials =
      specialItems.length > 0
        ? [
            {
              category: {
                id: WEEKLY_SPECIALS_CATEGORY_ID,
                name: WEEKLY_SPECIALS_CATEGORY_NAME,
              } as CatalogCategory,
              data: specialItems,
            },
            ...base,
          ]
        : base
    return withSpecials.map((s, i) => ({ category: s.category, index: i, data: s.data }))
  }, [items, categories, specialItems])

  const firstId = sections[0]?.category.id ?? null
  const currentActive = activeId ?? firstId

  const pendingScrollRef = useRef<{
    idx: number
    animated: boolean
    attempt: number
    seq: number
  } | null>(null)
  // Monotonic token. Each tab press bumps it; in-flight retries from earlier
  // taps check the token and no-op if superseded, so a slow retry for section
  // B can't hijack a newer scroll to section C.
  const scrollSeqRef = useRef(0)

  // Defer scroll into a microtask chain with retry. On first mount the target
  // section's native cells may not be laid out yet; calling scrollToLocation
  // straight away can hand a NaN offset to the native ScrollView command,
  // which iOS 26 Fabric turns into an uncaught NSException → SIGABRT.
  const safeScrollToSection = useCallback(
    (idx: number, animated: boolean, seq: number, attempt = 0) => {
      if (seq !== scrollSeqRef.current) return
      const list = sectionListRef.current
      if (!list) return
      pendingScrollRef.current = { idx, animated, attempt, seq }
      try {
        list.scrollToLocation({
          sectionIndex: idx,
          itemIndex: 0,
          animated,
          viewPosition: 0,
        })
      } catch {
        if (attempt < 4) {
          setTimeout(() => safeScrollToSection(idx, animated, seq, attempt + 1), 120)
        } else {
          pendingScrollRef.current = null
        }
      }
    },
    [],
  )

  const handleScrollToIndexFailed = useCallback(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    if (pending.seq !== scrollSeqRef.current || pending.attempt >= 4) {
      pendingScrollRef.current = null
      return
    }
    setTimeout(
      () =>
        safeScrollToSection(
          pending.idx,
          pending.animated,
          pending.seq,
          pending.attempt + 1,
        ),
      120,
    )
  }, [safeScrollToSection])

  const handleTabPress = useCallback(
    (id: string) => {
      Keyboard.dismiss()
      const sectionIndex = sections.findIndex((s) => s.category.id === id)
      if (sectionIndex < 0) return
      const seq = ++scrollSeqRef.current
      scrollingToRef.current = id
      setActiveId(id)
      safeScrollToSection(sectionIndex, true, seq)
    },
    [sections, safeScrollToSection],
  )

  useFocusEffect(
    useCallback(() => {
      const pending = useMenuJumpStore.getState().pendingSlug
      if (!pending || sections.length === 0) return
      const idx = sections.findIndex(
        (s) => resolveCategorySlug(s.category.name) === pending,
      )
      useMenuJumpStore.getState().setPending(null)
      if (idx < 0) return
      const target = sections[idx].category.id
      const seq = ++scrollSeqRef.current
      scrollingToRef.current = target
      setActiveId(target)
      requestAnimationFrame(() => safeScrollToSection(idx, false, seq))
    }, [sections, safeScrollToSection]),
  )

  // We used to clear `scrollingToRef` on momentum/drag end, but with rapid
  // successive taps the FIRST tap's momentum-end fires mid-way through the
  // SECOND tap's scroll, which lets onViewableChanged snap `activeId` back to
  // whatever intermediate section is passing through. Instead, keep the ref
  // set to the latest target and only clear it once that target actually
  // becomes the first viewable section.
  const onViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const first = viewableItems[0]
      const section = first?.section as { category?: CatalogCategory } | undefined
      const visibleId = section?.category?.id
      if (!visibleId) return
      const target = scrollingToRef.current
      if (target) {
        if (visibleId === target) scrollingToRef.current = null
        return
      }
      setActiveId((prev) => (prev === visibleId ? prev : visibleId))
    },
  ).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current

  const renderItem = useCallback(
    ({ item, section }: { item: CatalogItem; section: MenuSection }) => (
      <ProductRow item={item} categorySlug={resolveCategorySlug(section.category.name)} />
    ),
    [],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: MenuSection }) => (
      <SectionHeader category={section.category} />
    ),
    [],
  )

  const keyExtractor = useCallback((item: CatalogItem) => item.id, [])

  const getItemLayout = useMemo(() => buildGetItemLayout(sections), [sections])

  if (loading && items.length === 0) {
    return <SkeletonSection />
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Menu unavailable. Try again later.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <PublicHolidayBanner />
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MANDY&apos;S · SOUTHPORT</Text>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Menu</Text>
          <View style={[styles.statusPill, !storeStatus.open && styles.statusPillClosed]}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: storeStatus.open ? T.green : T.ink4 },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: storeStatus.open ? T.greenDark : T.ink2 },
              ]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.searchBar}>
        <Icon name="search" color={T.ink3} size={18} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drinks"
          placeholderTextColor={T.ink3}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} style={styles.searchClearBtn}>
            <Icon name="close" color={T.ink3} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      {searching ? (
        <ScrollView
          style={styles.main}
          contentContainerStyle={styles.mainContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={Keyboard.dismiss}
        >
          {searchResults.length === 0 ? (
            <Text style={styles.empty}>No drinks match &quot;{query.trim()}&quot;</Text>
          ) : (
            <View style={styles.searchResults}>
              {searchResults.map((item) => (
                <ProductRow key={item.id} item={item} />
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.container}>
          <View style={styles.sidebarWrap}>
            <ScrollView
              style={styles.sidebar}
              contentContainerStyle={styles.sidebarContent}
              showsVerticalScrollIndicator={false}
            >
              {sections.map(({ category }) => {
                const active = category.id === currentActive
                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => handleTabPress(category.id)}
                    activeOpacity={0.7}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    {active ? <View style={styles.tabBar} /> : null}
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                      numberOfLines={2}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>

          <View style={styles.mainWrap}>
            <SectionList<CatalogItem, SectionMeta>
              ref={sectionListRef}
              style={styles.main}
              contentContainerStyle={styles.mainContent}
              sections={sections}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              renderSectionHeader={renderSectionHeader}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              keyboardDismissMode="on-drag"
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={5}
              getItemLayout={getItemLayout}
              onScrollBeginDrag={Keyboard.dismiss}
              onViewableItemsChanged={onViewableChanged}
              viewabilityConfig={viewabilityConfig}
              onScrollToIndexFailed={handleScrollToIndexFailed}
            />
          </View>
        </View>
      )}
    </View>
  )
}

const SectionHeader = memo(function SectionHeader({
  category,
}: {
  category: CatalogCategory
}) {
  const banner = categoryBanner(category.name)
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle} numberOfLines={1}>
        {category.name}
      </Text>
      {banner ? (
        <View style={styles.bannerWrap}>
          <Image
            source={banner}
            style={styles.sectionBanner}
            contentFit="cover"
            contentPosition="center"
          />
          <View style={styles.bannerOverlay} pointerEvents="none" />
        </View>
      ) : null}
    </View>
  )
})

const ProductRow = memo(function ProductRow({
  item,
  categorySlug,
}: {
  item: CatalogItem
  categorySlug?: string
}) {
  const rawName = item.itemData?.name ?? 'Unknown'
  const name = displayNameFor(categorySlug ?? undefined, rawName) || rawName
  const customImage = imageSourceFor(categorySlug ?? undefined, rawName)
  const firstVariation = item.itemData?.variations?.[0]
  const rawPrice = firstVariation?.itemVariationData?.priceMoney?.amount
  // Inside TOP 10 the locked toppings are mandatory, so show base + surcharge.
  const surcharge =
    categorySlug === TOP10_CATEGORY_SLUG ? item.itemData?.top10SurchargeCents ?? 0 : 0
  const price = rawPrice != null ? Number(rawPrice) + surcharge : undefined
  const originalPriceCents = originalPriceCentsFor(rawName)
  const isOnSpecial = originalPriceCents != null && price != null && originalPriceCents > price
  const variationName = firstVariation?.itemVariationData?.name
  const showVariationSubtitle =
    variationName && variationName.toLowerCase() !== 'regular'
  const soldOut = item.soldOut === true

  const openSheet = () => {
    if (soldOut) return
    Haptics.selectionAsync()
    useItemSheetStore.getState().open(item.id, categorySlug ?? null)
  }

  return (
    <TouchableOpacity
      style={[styles.row, soldOut && styles.rowSoldOut]}
      onPress={openSheet}
      disabled={soldOut}
      activeOpacity={0.6}
    >
      {customImage ? (
        <Image
          source={customImage}
          style={styles.rowImage}
          contentFit="cover"
          contentPosition="center"
        />
      ) : item.imageUrl ? (
        <SquareImage
          url={item.imageUrl}
          width={IMG_THUMB}
          style={styles.rowImage}
          contentPosition="center"
        />
      ) : (
        <View style={[styles.rowImage, styles.placeholder]}>
          <CupArt fill={hashColor(item.id)} size={60} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <View style={styles.rowNameRow}>
          <Text style={styles.rowName} numberOfLines={2}>
            {name}
          </Text>
          {soldOut ? (
            <View style={styles.soldOutPill}>
              <Text style={styles.soldOutPillText}>SOLD OUT</Text>
            </View>
          ) : null}
        </View>
        {showVariationSubtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {variationName}
          </Text>
        ) : null}
        {price != null ? (
          <View style={styles.rowPriceRow}>
            {isOnSpecial ? (
              <Text style={styles.rowPriceOriginal}>{formatPrice(originalPriceCents)}</Text>
            ) : null}
            <Text style={[styles.rowPrice, isOnSpecial && styles.rowPriceSpecial]}>
              {formatPrice(price)}
            </Text>
          </View>
        ) : null}
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.()
          openSheet()
        }}
        disabled={soldOut}
        hitSlop={8}
      >
        <View style={[styles.addBtn, soldOut && styles.addBtnDisabled]}>
          <Icon name="plus" color="#fff" size={18} />
        </View>
      </Pressable>
    </TouchableOpacity>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
  },
  eyebrow: {
    ...TYPE.eyebrow,
    color: T.brand,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  title: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 34,
    lineHeight: 38,
    color: T.ink,
    letterSpacing: -0.5,
    flexShrink: 0,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(46,127,82,0.12)',
    flexShrink: 1,
  },
  statusPillClosed: {
    backgroundColor: 'rgba(42,30,20,0.08)',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  statusText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.paper,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.ink,
    paddingVertical: 0,
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    marginTop: 40,
  },
  searchResults: {
    paddingTop: 8,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    textAlign: 'center',
  },
  sidebarWrap: {
    flex: 1,
    backgroundColor: T.bg,
  },
  sidebar: {
    flex: 1,
  },
  sidebarContent: {
    paddingVertical: 8,
  },
  tab: {
    minHeight: 64,
    paddingHorizontal: 6,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: T.paper,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    backgroundColor: T.brand,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    color: T.ink3,
  },
  tabTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: T.brand,
  },
  mainWrap: {
    flex: 3.2,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 48,
  },
  sectionHeader: {
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 8,
    padding: 14,
    backgroundColor: T.paper,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.card,
  },
  sectionTitle: {
    ...TYPE.screenTitleSm,
    color: T.ink,
    marginTop: 2,
    marginBottom: 10,
  },
  bannerWrap: {
    width: '100%',
    height: 96,
    borderRadius: RADIUS.tile,
    overflow: 'hidden',
    backgroundColor: T.sage,
  },
  sectionBanner: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42,30,20,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 14,
  },
  rowImage: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.tile,
    backgroundColor: T.sage,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  rowName: {
    ...TYPE.cardTitle,
    color: T.ink,
  },
  rowSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  rowPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rowPriceOriginal: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.ink4,
    textDecorationLine: 'line-through',
  },
  rowPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink2,
  },
  rowPriceSpecial: {
    color: '#dc2626',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBtnDisabled: {
    backgroundColor: T.ink4,
  },
  rowSoldOut: {
    opacity: 0.55,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  soldOutPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: T.ink2,
  },
  soldOutPillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    letterSpacing: 1.1,
    color: '#fff',
  },
  addBtnGlyph: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
