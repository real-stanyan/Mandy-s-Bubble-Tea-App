import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CatalogItem, CatalogCategory } from '@/types/square'

interface MenuData {
  items: CatalogItem[]
  categories: CatalogCategory[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useMenu(): MenuData {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMenu = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ items: CatalogItem[]; categories?: CatalogCategory[] }>(
        '/api/catalog'
      )
      const fetchedItems = data.items ?? []
      setItems(fetchedItems)

      // API may return categories directly, or we extract them from items
      if (data.categories?.length) {
        setCategories(data.categories)
      } else {
        const catMap = new Map<string, string>()
        for (const item of fetchedItems) {
          for (const cat of item.itemData?.categories ?? []) {
            if (cat.id && cat.name && !catMap.has(cat.id)) {
              catMap.set(cat.id, cat.name)
            }
          }
        }
        setCategories(
          Array.from(catMap, ([id, name]) => ({ id, name }))
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menu')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMenu()
  }, [fetchMenu])

  return { items, categories, loading, error, refresh: fetchMenu }
}
