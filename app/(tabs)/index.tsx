import { useMemo } from 'react'
import {
  View,
  ScrollView,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useMenu } from '@/hooks/use-menu'
import { ItemCard } from '@/components/menu/ItemCard'
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={BRAND.color} />
      </View>
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
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{category.name}</Text>
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  strip: {
    paddingHorizontal: 16,
  },
})
