import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  SectionList,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  type LayoutChangeEvent,
  type SectionListData,
  type ViewToken,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { PulseDot } from '@/components/ui/PulseDot'
import { SLIDE_MS, slotFor, slotFromLayout, type Slot } from '@/lib/motion/slide'
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
  normalizeItemName,
} from '@/lib/menu/weekly-specials'
import { SquareImage } from '@/components/ui/SquareImage'
import { IMG_THUMB } from '@/lib/optimized-image'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { isBestseller } from '@/components/menu/bestsellers'
import { PressScale } from '@/components/ui/PressScale'
import { Reveal } from '@/components/ui/Reveal'
import { T, CTA, PIN, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem, CatalogCategory } from '@/types/square'

type SectionMeta = { category: CatalogCategory; index: number }
type MenuSection = SectionListData<CatalogItem, SectionMeta>

// Estimated native heights, used to synthesize getItemLayout so SectionList
// can seek to any section directly by pixel offset instead of virtualizing
// forward and firing onScrollToIndexFailed on far jumps.
// SectionHeader: marginTop(20) + card(120) + marginBottom(8) = 148 — the
//                card is a fixed height whether or not it has a banner, so
//                every section header measures the same.
// Row:           paddingV(10) + image(76) + paddingV(10) = 96
const ROW_H = 96
const HEADER_H = 148
const HEADER_CARD_H = 120
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
  // Where each category tab sits in the rail, so the brand bar can slide to
  // the active one instead of re-mounting on it (Slide).
  const [railSlots, setRailSlots] = useState<Record<string, Slot>>({})
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
  const railSlot = slotFor(railSlots, currentActive)
  const measureTab = useCallback(
    (id: string) => (e: LayoutChangeEvent) => {
      const slot = slotFromLayout(e.nativeEvent.layout)
      setRailSlots((prev) => {
        const cur = prev[id]
        if (cur && cur.y === slot.y && cur.height === slot.height) return prev
        return { ...prev, [id]: slot }
      })
    },
    [],
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
    ({ item, section, index }: { item: CatalogItem; section: MenuSection; index: number }) => (
      <ProductRow
        item={item}
        categorySlug={resolveCategorySlug(section.category.name)}
        index={index}
      />
    ),
    [],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: MenuSection }) => (
      <Reveal>
        <SectionHeader category={section.category} count={section.data.length} />
      </Reveal>
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
            <PulseDot
              color={storeStatus.open ? T.green : T.ink4}
              size={7}
              active={storeStatus.open}
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
              <Text style={styles.resultsCount}>
                {searchResults.length} {searchResults.length === 1 ? 'drink' : 'drinks'}
              </Text>
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
                    onLayout={measureTab(category.id)}
                    activeOpacity={0.7}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Text
                      style={[styles.tabText, active && styles.tabTextActive]}
                      numberOfLines={2}
                    >
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              {/* One brand bar for the whole rail; it travels to the active tab.
                  Rendered LAST so it paints over the active tab (paper background):
                  as the first child it sat under the tabs and never showed (Stan,
                  2026-09-06). */}
              <SlidingRail slot={railSlot} />
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

const RAIL_INSET = 12
const RAIL_SLIDE = { duration: SLIDE_MS, easing: Easing.out(Easing.exp) }

// The rail's brand bar: absolutely positioned in the sidebar's content, it
// slides (and resizes — tab heights differ with two-line names) to whichever
// tab is active. First placement is instant; Reduce Motion keeps it that way.
function SlidingRail({ slot }: { slot: Slot | null }) {
  const reduced = useReducedMotion()
  const y = useSharedValue(0)
  const h = useSharedValue(0)
  const shown = useSharedValue(0)
  const placed = useRef(false)
  useEffect(() => {
    if (!slot) return
    const top = slot.y + RAIL_INSET
    const height = Math.max(0, slot.height - RAIL_INSET * 2)
    if (!placed.current || reduced) {
      y.value = top
      h.value = height
      shown.value = 1
      placed.current = true
      return
    }
    y.value = withTiming(top, RAIL_SLIDE)
    h.value = withTiming(height, RAIL_SLIDE)
  }, [slot?.y, slot?.height, reduced]) // eslint-disable-line react-hooks/exhaustive-deps
  const style = useAnimatedStyle(() => ({
    opacity: shown.value,
    height: h.value,
    transform: [{ translateY: y.value }],
  }))
  return <Animated.View pointerEvents="none" style={[styles.tabBar, style]} />
}

// One card per category, the title set INTO the banner over a scrim rather
// than above it in a second box — half the height of the old title-plus-
// banner stack, and the photo does the work of a heading. Categories with
// no photo (TOP 10, this week's specials) get a flat panel of the same
// height so the list keeps one rhythm and getItemLayout stays honest.
const SectionHeader = memo(function SectionHeader({
  category,
  count,
}: {
  category: CatalogCategory
  count: number
}) {
  const banner = categoryBanner(category.name)
  const isSpecials = category.id === WEEKLY_SPECIALS_CATEGORY_ID
  const sub = `${count} ${count === 1 ? 'drink' : 'drinks'}${isSpecials ? ' · this week only' : ''}`
  return (
    <View
      style={[
        styles.sectionHeader,
        !banner && styles.sectionHeaderPlain,
        isSpecials && styles.sectionHeaderSpecials,
      ]}
    >
      {banner ? (
        <>
          <Image
            source={banner}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="center"
          />
          <LinearGradient
            colors={['rgba(42,30,20,0)', 'rgba(42,30,20,0.16)', 'rgba(42,30,20,0.78)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : null}
      <Text
        style={[
          styles.sectionTitle,
          banner ? styles.onBanner : null,
          isSpecials && styles.onSpecials,
        ]}
        numberOfLines={1}
      >
        {category.name}
      </Text>
      <Text
        style={[
          styles.sectionSub,
          banner ? styles.onBannerSub : null,
          isSpecials && styles.onSpecialsSub,
        ]}
        numberOfLines={1}
      >
        {sub}
      </Text>
    </View>
  )
})

function Chip({ label, tone }: { label: string; tone: 'star' | 'special' }) {
  return (
    <View style={[styles.chip, tone === 'star' ? styles.chipStar : styles.chipSpecial]}>
      <Text style={[styles.chipText, tone === 'star' ? styles.chipStarText : styles.chipSpecialText]}>
        {label}
      </Text>
    </View>
  )
}

const ProductRow = memo(function ProductRow({
  item,
  categorySlug,
  index,
}: {
  item: CatalogItem
  categorySlug?: string
  /** Position in its section — the first screenful staggers in. */
  index?: number
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

  const row = (
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
          {!soldOut && isOnSpecial ? <Chip label="SPECIAL" tone="special" /> : null}
          {!soldOut && !isOnSpecial && isBestseller(rawName) ? (
            <Chip label="★ BESTSELLER" tone="star" />
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
      <PressScale
        onPress={(e) => {
          e.stopPropagation?.()
          openSheet()
        }}
        disabled={soldOut}
        hitSlop={8}
        haptic
        scaleTo={0.88}
        style={[styles.addBtn, soldOut && styles.addBtnDisabled]}
      >
        <Icon name="plus" color={soldOut ? '#fff' : CTA.on} size={18} />
      </PressScale>
    </TouchableOpacity>
  )
  // Only the first screenful animates: rows further down mount off-screen
  // while scrolling, where an entrance would just be work nobody sees.
  if (index != null && index < 6) return <Reveal index={index}>{row}</Reveal>
  return row
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
    fontFamily: 'ShantellSans_700Bold',
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
    fontFamily: 'ShantellSans_600SemiBold',
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
    fontFamily: 'ShantellSans_400Regular',
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
    fontFamily: 'ShantellSans_400Regular',
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
    fontFamily: 'ShantellSans_400Regular',
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
    top: 0,
    zIndex: 2,
    width: 4,
    backgroundColor: T.brand,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabText: {
    flex: 1,
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    color: T.ink3,
  },
  tabTextActive: {
    fontFamily: 'ShantellSans_600SemiBold',
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
    marginTop: 20,
    marginBottom: 8,
    height: HEADER_CARD_H,
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: 'flex-end',
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
  sectionTitle: {
    ...TYPE.screenTitleSm,
    color: T.ink,
  },
  sectionSub: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12,
    color: T.ink3,
    marginTop: 2,
  },
  onBanner: {
    color: '#FFF9F0',
    textShadowColor: 'rgba(42,30,20,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  onBannerSub: {
    color: 'rgba(255,249,240,0.85)',
  },
  onSpecials: { color: PIN.ink },
  onSpecialsSub: { color: PIN.ink2 },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chipStar: { backgroundColor: 'rgba(242,182,74,0.28)' },
  chipSpecial: { backgroundColor: 'rgba(220,38,38,0.10)' },
  chipText: {
    fontFamily: 'ShantellSans_600SemiBold',
    fontSize: 9,
    letterSpacing: 0.8,
  },
  chipStarText: { color: T.ink2 },
  chipSpecialText: { color: '#dc2626' },
  resultsCount: {
    ...TYPE.eyebrow,
    color: T.ink3,
    paddingHorizontal: 16,
    paddingBottom: 4,
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
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 11,
    color: T.ink3,
  },
  rowPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rowPriceOriginal: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 11,
    color: T.ink4,
    textDecorationLine: 'line-through',
  },
  // Mono, like every other price in the app (cart, receipt, order card).
  rowPrice: {
    ...TYPE.priceSm,
    color: T.ink,
  },
  rowPriceSpecial: {
    color: '#dc2626',
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: CTA.bg,
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
    fontFamily: 'ShantellSans_600SemiBold',
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
