import { useMemo } from 'react'
import {
  View,
  ScrollView,
  FlatList,
  Text,
  TouchableOpacity,

  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useMenu } from '@/hooks/use-menu'
import { ItemCard } from '@/components/menu/ItemCard'
import { SkeletonSection } from '@/components/menu/SkeletonCard'
import { BRAND } from '@/lib/constants'
import type { CatalogItem, CatalogCategory } from '@/types/square'

export default function MenuScreen() {
  const { items, categories, loading, error } = useMenu()

  // Group items by category
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

  if (loading && items.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonSection key={i} />
        ))}
      </ScrollView>
    )
  }

  if (error && items.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {sections.map((section) => (
        <CategorySection
          key={section.category.id}
          category={section.category}
          items={section.items}
        />
      ))}
    </ScrollView>
  )
}

function CategorySection({
  category,
  items,
}: {
  category: CatalogCategory
  items: CatalogItem[]
}) {
  const router = useRouter()

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{category.name}</Text>
        <TouchableOpacity
          onPress={() => router.push(`/menu/category/${category.id}`)}
          activeOpacity={0.6}
        >
          <Text style={styles.seeMore}>See More</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
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
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  seeMore: {
    fontSize: 14,
    color: BRAND.color,
    fontWeight: '600',
  },
  strip: {
    paddingHorizontal: 16,
  },
})
