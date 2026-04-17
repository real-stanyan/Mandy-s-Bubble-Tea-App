import { useMemo, useRef, useState, useCallback } from 'react'
import {
  View,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
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
import { BRAND } from '@/lib/constants'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import { useItemSheetStore } from '@/store/itemSheet'
import { MiniCartBar } from '@/components/cart/MiniCartBar'
import type { CatalogItem, CatalogCategory } from '@/types/square'

const HIGHLIGHT_OFFSET = 40

export default function MenuScreen() {
  const { items, categories, loading, error } = useMenu()
  const scrollRef = useRef<ScrollView>(null)
  const sectionOffsets = useRef<Record<string, number>>({})
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

  const sections = useMemo(() => {
    if (categories.length === 0 || items.length === 0) return []
    return categories
      .map((cat) => ({
        category: cat,
        items: items.filter((item) =>
          item.itemData?.categories?.some((c) => c.id === cat.id),
        ),
      }))
      .filter((s) => s.items.length > 0)
  }, [items, categories])

  const firstId = sections[0]?.category.id ?? null
  const currentActive = activeId ?? firstId

  const handleTabPress = useCallback((id: string) => {
    Keyboard.dismiss()
    const y = sectionOffsets.current[id]
    if (y == null) return
    scrollingToRef.current = id
    setActiveId(id)
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true })
  }, [])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (scrollingToRef.current) return
      const y = e.nativeEvent.contentOffset.y + HIGHLIGHT_OFFSET
      const entries = Object.entries(sectionOffsets.current).sort(
        (a, b) => a[1] - b[1],
      )
      let current = entries[0]?.[0] ?? null
      for (const [id, offset] of entries) {
        if (y >= offset) current = id
        else break
      }
      if (current && current !== activeId) setActiveId(current)
    },
    [activeId],
  )

  const handleMomentumEnd = useCallback(() => {
    scrollingToRef.current = null
  }, [])

  if (loading && items.length === 0) {
    return <SkeletonSection />
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#8a8076" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search drinks"
          placeholderTextColor="#8a8076"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#8a8076" />
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
            <Text style={styles.empty}>No drinks match "{query.trim()}"</Text>
          ) : (
            <View style={styles.section}>
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
            <ScrollView
              ref={scrollRef}
              style={styles.main}
              contentContainerStyle={styles.mainContent}
              showsVerticalScrollIndicator={false}
              scrollEventThrottle={16}
              keyboardDismissMode="on-drag"
              onScroll={handleScroll}
              onMomentumScrollEnd={handleMomentumEnd}
              onScrollEndDrag={handleMomentumEnd}
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {sections.map((section) => (
                <CategorySection
                  key={section.category.id}
                  category={section.category}
                  items={section.items}
                  onLayoutY={(y) => {
                    sectionOffsets.current[section.category.id] = y
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </View>
      )}
      <MiniCartBar />
    </View>
  )
}

function CategorySection({
  category,
  items,
  onLayoutY,
}: {
  category: CatalogCategory
  items: CatalogItem[]
  onLayoutY: (y: number) => void
}) {
  return (
    <View onLayout={(e) => onLayoutY(e.nativeEvent.layout.y)} style={styles.section}>
      <Text style={styles.sectionTitle}>{category.name}</Text>
      {items.map((item) => (
        <ProductRow key={item.id} item={item} />
      ))}
    </View>
  )
}

function ProductRow({ item }: { item: CatalogItem }) {
  const addItem = useCartStore((s) => s.addItem)
  const name = item.itemData?.name ?? 'Unknown'
  const firstVariation = item.itemData?.variations?.[0]
  const price = firstVariation?.itemVariationData?.priceMoney?.amount

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
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.rowImage} contentFit="cover" />
      ) : (
        <View style={[styles.rowImage, styles.placeholder]}>
          <Text style={styles.placeholderText}>🧋</Text>
        </View>
      )}
      <View style={styles.rowInfo}>
        <Text style={styles.rowName} numberOfLines={2}>
          {name}
        </Text>
        {price != null ? (
          <Text style={styles.rowPrice}>{formatPrice(price)}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={(e) => {
          e.stopPropagation?.()
          handleAdd()
        }}
        activeOpacity={0.8}
        hitSlop={8}
      >
        <Animated.View style={[styles.addBtn, btnStyle]}>
          <Animated.Text style={[styles.addBtnText, plusStyle]}>+</Animated.Text>
          <Animated.View style={[styles.addBtnCheck, checkStyle]} pointerEvents="none">
            <Ionicons name="checkmark" size={18} color="#fff" />
          </Animated.View>
        </Animated.View>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#fff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2E8DF',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1a1a1a',
    paddingVertical: 0,
  },
  empty: {
    textAlign: 'center',
    color: '#8a8076',
    fontSize: 14,
    marginTop: 40,
  },
  loadingContent: {
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    textAlign: 'center',
  },
  sidebarWrap: {
    flex: 1,
    backgroundColor: '#F2E8DF',
  },
  sidebar: {
    flex: 1,
  },
  sidebarContent: {
    paddingVertical: 8,
  },
  tab: {
    minHeight: 60,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    backgroundColor: BRAND.color,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  tabText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    color: '#8a8076',
    fontWeight: '500',
  },
  tabTextActive: {
    color: BRAND.color,
    fontWeight: '700',
  },
  mainWrap: {
    flex: 3,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingBottom: 48,
  },
  section: {
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 32,
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  rowPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: BRAND.color,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BRAND.color,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  addBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -2,
  },
  addBtnCheck: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
