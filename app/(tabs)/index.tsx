import { useMemo, useState } from 'react'
import {
  View,
  FlatList,
  Text,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useMenu } from '@/hooks/use-menu'
import { CategoryTabs } from '@/components/menu/CategoryTabs'
import { ItemCard } from '@/components/menu/ItemCard'
import { BRAND } from '@/lib/constants'
import type { CatalogItem } from '@/types/square'

export default function MenuScreen() {
  const { items, categories, loading, error, refresh } = useMenu()
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)

  const activeCategoryId = selectedCategoryId ?? (categories.length > 0 ? categories[0].id : null)

  const filteredItems = useMemo(() => {
    if (!activeCategoryId) return items
    return items.filter((item) =>
      item.itemData?.categories?.some((c) => c.id === activeCategoryId)
    )
  }, [items, activeCategoryId])

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
    <View style={styles.container}>
      <CategoryTabs
        categories={categories}
        selectedId={activeCategoryId}
        onSelect={setSelectedCategoryId}
      />
      <FlatList<CatalogItem>
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ItemCard item={item} />}
        onRefresh={refresh}
        refreshing={loading}
        contentContainerStyle={filteredItems.length === 0 ? styles.center : undefined}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No items in this category</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
})
