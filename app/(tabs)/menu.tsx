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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated'
import { useMenu } from '@/hooks/use-menu'
import { SkeletonSection } from '@/components/menu/SkeletonCard'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { useItemSheetStore } from '@/store/itemSheet'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { hashColor } from '@/components/brand/color'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'
import type { CatalogItem, CatalogCategory } from '@/types/square'

type SectionMeta = { category: CatalogCategory; index: number }
type MenuSection = SectionListData<CatalogItem, SectionMeta>

const CATEGORY_BANNERS: Record<string, ReturnType<typeof require>> = {
  milky: require('@/assets/images/categories/milky.webp'),
  fruity: require('@/assets/images/categories/fruity.webp'),
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
  const { items, categories, loading, error } = useMenu()
  const sectionListRef = useRef<SectionList<CatalogItem, SectionMeta>>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const scrollingToRef = useRef<string | null>(null)
  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return items.filter((it) =>
      (it.itemData?.name ?? '').toLowerCase().includes(q),
    )
  }, [items, query])

  const sections = useMemo<MenuSection[]>(() => {
    if (categories.length === 0 || items.length === 0) return []
    return categories
      .map((cat) => ({
        category: cat,
        data: items.filter((item) =>
          item.itemData?.categories?.some((c) => c.id === cat.id),
        ),
      }))
      .filter((s) => s.data.length > 0)
      .map((s, i) => ({ category: s.category, index: i, data: s.data }))
  }, [items, categories])

  const firstId = sections[0]?.category.id ?? null
  const currentActive = activeId ?? firstId

  const handleTabPress = useCallback(
    (id: string) => {
      Keyboard.dismiss()
      const sectionIndex = sections.findIndex((s) => s.category.id === id)
      if (sectionIndex < 0) return
      scrollingToRef.current = id
      setActiveId(id)
      sectionListRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex: 0,
        animated: true,
        viewPosition: 0,
      })
    },
    [sections],
  )

  const handleMomentumEnd = useCallback(() => {
    scrollingToRef.current = null
  }, [])

  const onViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (scrollingToRef.current) return
      const first = viewableItems[0]
      const section = first?.section as { category?: CatalogCategory } | undefined
      const id = section?.category?.id
      if (id) setActiveId((prev) => (prev === id ? prev : id))
    },
  ).current

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 20 }).current

  const renderItem = useCallback(
    ({ item }: { item: CatalogItem }) => <ProductRow item={item} />,
    [],
  )

  const renderSectionHeader = useCallback(
    ({ section }: { section: MenuSection }) => (
      <SectionHeader category={section.category} index={section.index} />
    ),
    [],
  )

  const keyExtractor = useCallback((item: CatalogItem) => item.id, [])

  if (loading && items.length === 0) {
    return <SkeletonSection />
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Menu unavailable. Try again later.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.root}>
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
              removeClippedSubviews
              onMomentumScrollEnd={handleMomentumEnd}
              onScrollEndDrag={handleMomentumEnd}
              onScrollBeginDrag={Keyboard.dismiss}
              onViewableItemsChanged={onViewableChanged}
              viewabilityConfig={viewabilityConfig}
            />
          </View>
        </View>
      )}
    </View>
  )
}

const SectionHeader = memo(function SectionHeader({
  category,
  index,
}: {
  category: CatalogCategory
  index: number
}) {
  const banner = categoryBanner(category.name)
  const indexLabel = String(index + 1).padStart(2, '0')
  return (
    <View style={styles.sectionHeader}>
      <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>{`CATEGORY ${indexLabel}`}</Text>
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

const ProductRow = memo(function ProductRow({ item }: { item: CatalogItem }) {
  const addItem = useCartStore((s) => s.addItem)
  const name = item.itemData?.name ?? 'Unknown'
  const firstVariation = item.itemData?.variations?.[0]
  const price = firstVariation?.itemVariationData?.priceMoney?.amount
  const variationName = firstVariation?.itemVariationData?.name
  const showVariationSubtitle =
    variationName && variationName.toLowerCase() !== 'regular'

  const btnScale = useSharedValue(1)
  const checkOpacity = useSharedValue(0)

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }))
  const plusStyle = useAnimatedStyle(() => ({
    opacity: 1 - checkOpacity.value,
  }))
  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkOpacity.value,
    transform: [{ scale: 0.6 + checkOpacity.value * 0.4 }],
  }))

  const handleAdd = () => {
    if (!firstVariation) return
    Haptics.selectionAsync()
    cancelAnimation(btnScale)
    cancelAnimation(checkOpacity)
    btnScale.value = 1
    checkOpacity.value = 0
    btnScale.value = withSequence(
      withTiming(0.9, { duration: 80, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
    )
    checkOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withTiming(0, { duration: 260 }),
    )
    addItem({
      id: item.id,
      variationId: firstVariation.id,
      name,
      price: Number(price ?? 0),
      imageUrl: item.imageUrl,
      variationName: firstVariation.itemVariationData?.name,
      modifiers: [],
    })
  }

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={() => useItemSheetStore.getState().open(item.id)}
      activeOpacity={0.6}
    >
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.rowImage}
          contentFit="cover"
          contentPosition="center"
        />
      ) : (
        <View style={[styles.rowImage, styles.placeholder]}>
          <CupArt fill={hashColor(item.id)} size={60} />
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>
          {name}
        </Text>
        {showVariationSubtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {variationName}
          </Text>
        ) : null}
        {price != null ? (
          <Text style={styles.rowPrice}>{formatPrice(price)}</Text>
        ) : null}
      </View>
      <Pressable
        onPress={(e) => {
          e.stopPropagation?.()
          handleAdd()
        }}
        hitSlop={8}
      >
        <Animated.View style={[styles.addBtn, btnStyle]}>
          <Animated.View style={[styles.addBtnGlyph, plusStyle]}>
            <Icon name="plus" color="#fff" size={18} />
          </Animated.View>
          <Animated.View style={[styles.addBtnGlyph, checkStyle]} pointerEvents="none">
            <Icon name="check" color="#fff" size={18} />
          </Animated.View>
        </Animated.View>
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
  rowPrice: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink2,
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
