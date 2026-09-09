import { GrainGround } from '@/components/ui/GrainOverlay'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import {
  View,
  SectionList,
  Text,
  StyleSheet,
  Keyboard,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type SectionListData,
  type TextInput,
} from 'react-native'
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs'
import { useFocusEffect } from 'expo-router'
import { getStoreStatus, resolveCategorySlug } from '@/components/home/helpers'
import { useMenuJumpStore } from '@/store/menuJump'
import { useMenu } from '@/hooks/use-menu'
import { SkeletonSection } from '@/components/menu/SkeletonCard'
import { PublicHolidayBanner } from '@/components/home/PublicHolidayBanner'
import { CategoryArt } from '@/components/brand/CategoryArt'
import { CATEGORY_ART_TINT, categoryArtKind } from '@/lib/menu/category-art'
import { useItemSheetStore } from '@/store/itemSheet'
import {
  WEEKLY_SPECIALS_CATEGORY_ID,
  WEEKLY_SPECIALS_CATEGORY_NAME,
  orderedWeeklySpecialNames,
  normalizeItemName,
} from '@/lib/menu/weekly-specials'
import { MenuHeader, headerHeights } from '@/components/menu/MenuHeader'
import { ProductCard } from '@/components/menu/ProductCard'
import {
  GRID_GAP,
  GRID_PAD,
  SECTION_CARD_H,
  SECTION_H,
  buildGridLayout,
  gridMetrics,
  pairs,
} from '@/lib/menu/grid'
import { haptic } from '@/lib/haptics'
import { driveChromeShrink } from '@/lib/motion/chrome'
import { Reveal } from '@/components/ui/Reveal'
import { T, PIN, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem, CatalogCategory } from '@/types/square'

// The menu: a floating head (title, search, category rail — MenuHeader) over
// one SectionList of drinks, two cards to a row (ProductCard), each category
// opening with its illustrated card. The head folds as the list scrolls and
// the rail follows the category under the finger; the geometry that lets the
// list seek straight to a category lives in lib/menu/grid.

type SectionMeta = { category: CatalogCategory; index: number; search?: boolean }
type MenuSection = SectionListData<CatalogItem[], SectionMeta>

const SEARCH_SECTION_ID = '__search__'

// SectionList has no numColumns; rows of two cards are the list's items. The
// animated wrapper is what lets Reanimated read the scroll offset for the head.
const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList,
) as unknown as typeof SectionList<CatalogItem[], SectionMeta>

export default function MenuScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const metrics = useMemo(() => gridMetrics(width), [width])
  const { expanded: headerExpanded, collapsed: headerCollapsed } = headerHeights(insets.top)
  // The tab bar floats over the list, so the list keeps its clearance as
  // bottom padding. The mini cart bar floats over the last row either way.
  const underBar = useBottomTabBarHeight()
  // Where the first cell sits in scroll coordinates: the padding that keeps
  // the grid out from under the floating head, plus the holiday banner when
  // there is one (measured — it is rarely there and never the same height).
  const contentTop = headerExpanded + 4
  const [bannerH, setBannerH] = useState(0)
  const listContent = useMemo(
    () => [styles.listContent, { paddingTop: contentTop, paddingBottom: 120 + underBar }],
    [contentTop, underBar],
  )
  const { items, categories, loading, error } = useMenu()
  const sectionListRef = useRef<SectionList<CatalogItem[], SectionMeta>>(null)
  const inputRef = useRef<TextInput>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollingToRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const storeStatus = getStoreStatus()
  const statusLabel = storeStatus.open
    ? `Open · closes ${storeStatus.nextLabel.replace(/^until\s+/, '')}`
    : `Closed · opens ${storeStatus.nextLabel}`

  const scrollY = useSharedValue(0)
  // Reading down shrinks the floating tab pill; scrolling up brings it back.
  const chromeLastY = useSharedValue(0)
  const chromeTarget = useSharedValue(0)

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((it) => (it.itemData?.name ?? '').toLowerCase().includes(q))
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
      const key = normalizeItemName(it.itemData?.name ?? '')
      if (key && !byName.has(key)) byName.set(key, it)
    }
    const out: CatalogItem[] = []
    for (const name of orderedWeeklySpecialNames()) {
      const hit = byName.get(name)
      if (hit) out.push(hit)
    }
    return out
  }, [items])

  const menuSections = useMemo<MenuSection[]>(() => {
    if (categories.length === 0 || items.length === 0) return []
    const base = categories
      .map((cat) => ({
        category: cat,
        data: items.filter((item) => item.itemData?.categories?.some((c) => c.id === cat.id)),
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
    return withSpecials.map((s, i) => ({ category: s.category, index: i, data: pairs(s.data) }))
  }, [items, categories, specialItems])

  // Search results ride the same list as one flat section, so the head and
  // its scroll offset carry over instead of the whole screen swapping out.
  const sections = useMemo<MenuSection[]>(() => {
    if (!searching) return menuSections
    return [
      {
        category: { id: SEARCH_SECTION_ID, name: 'Results' } as CatalogCategory,
        index: 0,
        search: true,
        data: pairs(searchResults),
      },
    ]
  }, [searching, menuSections, searchResults])

  const railCategories = useMemo(
    () => menuSections.map((s) => ({ id: s.category.id, name: s.category.name })),
    [menuSections],
  )
  const firstId = menuSections[0]?.category.id ?? null
  const currentActive = activeId ?? firstId

  // Which category is under the head, worked out from the scroll offset and
  // the same geometry the list seeks by — not from the list's own viewability,
  // which cannot see the floating head and kept naming the row hidden under
  // it. Runs on the UI thread with the scroll; only a change crosses to JS.
  const sectionOffsets = useMemo(() => {
    const out: number[] = []
    let off = contentTop + bannerH
    for (const sec of menuSections) {
      out.push(off)
      off += SECTION_H + sec.data.length * metrics.rowH
    }
    return out
  }, [menuSections, metrics.rowH, contentTop, bannerH])
  const sectionUnderHead = useSharedValue(0)
  const onSectionUnderHead = useCallback(
    (idx: number) => {
      const id = menuSections[idx]?.category.id
      if (!id) return
      // A tap's scroll passes through every category on the way; the rail
      // waits for the one that was tapped. A change that comes from the finger
      // ticks once — the rail has moved to a new category.
      const target = scrollingToRef.current
      if (target) {
        if (id === target) scrollingToRef.current = null
        return
      }
      setActiveId((prev) => {
        if (prev === id) return prev
        if (prev != null) haptic.tick()
        return id
      })
    },
    [menuSections],
  )
  const trackSections = !searching
  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (e) => {
        const y = e.contentOffset.y
        scrollY.value = y
        driveChromeShrink(y, chromeLastY, chromeTarget)
        if (!trackSections) return
        // The first content pixel below the docked head, plus a hair so a
        // category parked exactly there counts as arrived.
        const probe = y + headerCollapsed + 2
        let idx = 0
        for (let i = 0; i < sectionOffsets.length; i++) {
          if (sectionOffsets[i] <= probe) idx = i
          else break
        }
        if (idx !== sectionUnderHead.value) {
          sectionUnderHead.value = idx
          runOnJS(onSectionUnderHead)(idx)
        }
      },
    },
    [sectionOffsets, headerCollapsed, trackSections, onSectionUnderHead],
  )

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
  // viewOffset parks the category card right under the docked head; the first
  // category parks under the open head instead, so tapping it from the top
  // moves nothing.
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
          viewOffset: idx === 0 ? contentTop : headerCollapsed,
        })
      } catch {
        if (attempt < 4) {
          setTimeout(() => safeScrollToSection(idx, animated, seq, attempt + 1), 120)
        } else {
          pendingScrollRef.current = null
        }
      }
    },
    [contentTop, headerCollapsed],
  )

  const handleScrollToIndexFailed = useCallback(() => {
    const pending = pendingScrollRef.current
    if (!pending) return
    if (pending.seq !== scrollSeqRef.current || pending.attempt >= 4) {
      pendingScrollRef.current = null
      return
    }
    setTimeout(
      () => safeScrollToSection(pending.idx, pending.animated, pending.seq, pending.attempt + 1),
      120,
    )
  }, [safeScrollToSection])

  const handleTabPress = useCallback(
    (id: string) => {
      Keyboard.dismiss()
      const sectionIndex = menuSections.findIndex((s) => s.category.id === id)
      if (sectionIndex < 0) return
      const seq = ++scrollSeqRef.current
      scrollingToRef.current = id
      setActiveId(id)
      safeScrollToSection(sectionIndex, true, seq)
    },
    [menuSections, safeScrollToSection],
  )

  useFocusEffect(
    useCallback(() => {
      const pending = useMenuJumpStore.getState().pendingSlug
      if (!pending || menuSections.length === 0) return
      const idx = menuSections.findIndex((s) => resolveCategorySlug(s.category.name) === pending)
      useMenuJumpStore.getState().setPending(null)
      if (idx < 0) return
      const target = menuSections[idx].category.id
      const seq = ++scrollSeqRef.current
      scrollingToRef.current = target
      setActiveId(target)
      requestAnimationFrame(() => safeScrollToSection(idx, false, seq))
    }, [menuSections, safeScrollToSection]),
  )

  const openItem = useCallback((item: CatalogItem, categorySlug: string | null) => {
    useItemSheetStore.getState().open(item.id, categorySlug)
  }, [])

  const renderItem = useCallback(
    ({ item: row, section, index }: { item: CatalogItem[]; section: MenuSection; index: number }) => {
      const slug = section.search ? undefined : resolveCategorySlug(section.category.name)
      const sectionTint = section.search ? null : tintFor(section.category.name)
      const cards = (
        <View style={styles.gridRow}>
          {row.map((item) => (
            <ProductCard
              key={item.id}
              item={item}
              categorySlug={slug}
              tint={sectionTint ?? tintFor(item.itemData?.categories?.[0]?.name)}
              width={metrics.cardW}
              thumbH={metrics.thumbH}
              onOpen={openItem}
            />
          ))}
        </View>
      )
      // Only the first screenful animates: rows further down mount off-screen
      // while scrolling, where an entrance would just be work nobody sees.
      if (index < 3) return <Reveal index={index}>{cards}</Reveal>
      return cards
    },
    [metrics.cardW, metrics.thumbH, openItem],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: MenuSection }) => {
      if (section.search) {
        const n = searchResults.length
        return (
          <Text style={styles.resultsCount}>
            {n} {n === 1 ? 'drink' : 'drinks'}
          </Text>
        )
      }
      const count = section.data.reduce((s, row) => s + row.length, 0)
      return (
        <Reveal>
          <SectionHeader category={section.category} count={count} />
        </Reveal>
      )
    },
    [searchResults.length],
  )

  const keyExtractor = useCallback((row: CatalogItem[]) => row[0]?.id ?? 'row', [])

  // Fixed heights only hold for the menu proper; search rows are measured.
  const gridLayout = useMemo(
    () =>
      buildGridLayout(
        menuSections.map((s) => s.data.length),
        metrics.rowH,
        contentTop + bannerH,
      ),
    [menuSections, metrics.rowH, contentTop, bannerH],
  )

  // One element, not one per render: a fresh element here re-renders every
  // mounted cell of the list each time the screen renders.
  const listHeader = useMemo(
    () => (
      <View onLayout={(e) => setBannerH(Math.round(e.nativeEvent.layout.height))}>
        <PublicHolidayBanner />
      </View>
    ),
    [],
  )

  const onSearchTap = useCallback(() => {
    haptic.pick()
    sectionListRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true })
    setTimeout(() => inputRef.current?.focus(), 380)
  }, [])

  if (loading && items.length === 0) {
    return <SkeletonSection />
  }

  if (error && items.length === 0) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <GrainGround />
        <View style={styles.center}>
          <Text style={styles.errorText}>Menu unavailable. Try again later.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <GrainGround />
      <AnimatedSectionList
        ref={sectionListRef}
        style={styles.list}
        contentContainerStyle={listContent}
        scrollIndicatorInsets={{ top: headerExpanded }}
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          searching ? (
            <Text style={styles.empty}>No drinks match &quot;{query.trim()}&quot;</Text>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll as unknown as (e: NativeSyntheticEvent<NativeScrollEvent>) => void}
        scrollEventThrottle={16}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={5}
        getItemLayout={searching ? undefined : gridLayout}
        onScrollBeginDrag={Keyboard.dismiss}
        onScrollToIndexFailed={handleScrollToIndexFailed}
      />
      <MenuHeader
        scrollY={scrollY}
        insetTop={insets.top}
        open={storeStatus.open}
        statusLabel={statusLabel}
        query={query}
        onQueryChange={setQuery}
        drinkCount={items.length}
        inputRef={inputRef}
        onSearchTap={onSearchTap}
        categories={railCategories}
        activeId={currentActive}
        onTabPress={handleTabPress}
      />
    </View>
  )
}

/** The pastel a drink's photo sits on: its category's, or the page's second
 *  tone for anything Square adds that has no illustration yet. */
function tintFor(categoryName: string | null | undefined): string {
  const art = categoryArtKind(categoryName)
  return art ? CATEGORY_ART_TINT[art] : T.bg2
}

// One card per category: the name with the count under it at the top of the
// card, the living illustration whole in the band beneath — the two never
// meet (the name used to sit over the drawing and ran into the cup on long
// names, and beside the count WEEKLY SPECIALS lost its tail; Stan,
// 2026-09-06). This week's specials have their own drawing (the price tag).
const SectionHeader = memo(function SectionHeader({
  category,
  count,
}: {
  category: CatalogCategory
  count: number
}) {
  const isSpecials = category.id === WEEKLY_SPECIALS_CATEGORY_ID
  // The living illustration for the category (components/brand/CategoryArt).
  const art = categoryArtKind(category.name)
  const sub = `${count} ${count === 1 ? 'drink' : 'drinks'}${isSpecials ? ' · this week only' : ''}`
  return (
    <View
      style={[
        styles.sectionHeader,
        !art && styles.sectionHeaderPlain,
        isSpecials && styles.sectionHeaderSpecials,
        art && { backgroundColor: CATEGORY_ART_TINT[art] },
      ]}
    >
      <View style={styles.sectionTitleBlock}>
        <Text
          style={[styles.sectionTitle, art ? styles.onArt : null, isSpecials && styles.onSpecials]}
          numberOfLines={1}
        >
          {category.name}
        </Text>
        <Text
          style={[styles.sectionSub, art ? styles.onArtSub : null, isSpecials && styles.onSpecialsSub]}
          numberOfLines={1}
        >
          {sub}
        </Text>
      </View>
      {art ? (
        <View style={styles.sectionArt} pointerEvents="none">
          <CategoryArt kind={art} />
        </View>
      ) : null}
    </View>
  )
})

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 120,
  },
  gridRow: {
    flexDirection: 'row',
    paddingHorizontal: GRID_PAD,
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    textAlign: 'center',
  },
  empty: {
    textAlign: 'center',
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.ink3,
    marginTop: 40,
    paddingHorizontal: 24,
  },
  resultsCount: {
    ...TYPE.eyebrow,
    color: T.ink3,
    paddingHorizontal: GRID_PAD,
    paddingTop: 12,
    paddingBottom: 10,
  },
  sectionHeader: {
    marginHorizontal: GRID_PAD,
    marginTop: 20,
    marginBottom: 8,
    height: SECTION_CARD_H,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: T.sage,
    borderRadius: RADIUS.card,
    overflow: 'hidden',
    ...SHADOW.card,
  },
  sectionHeaderPlain: {
    backgroundColor: T.bg2,
    borderWidth: 1,
    borderColor: T.line,
  },
  // Theme-invariant light surface → PIN ink (see constants/theme.ts).
  sectionHeaderSpecials: {
    backgroundColor: '#FFE7CF',
    borderWidth: 0,
  },
  // Name, then the count under it, at the top of the card.
  sectionTitleBlock: {
    gap: 2,
  },
  // The band under the title block; the drawing sits centred in it, whole.
  sectionArt: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    bottom: 0,
  },
  sectionTitle: {
    ...TYPE.screenTitleSm,
    color: T.ink,
  },
  sectionSub: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    color: T.ink3,
  },
  // The illustrations sit on their pastel in both themes → pinned day ink.
  onArt: { color: PIN.ink },
  onArtSub: { color: PIN.ink2 },
  onSpecials: { color: PIN.ink },
  onSpecialsSub: { color: PIN.ink2 },
})
