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
      const data = await apiFetch<{ items: CatalogItem[]; categories: CatalogCategory[] }>(
        '/api/catalog'
      )
      setItems(data.items)
      setCategories(data.categories)
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
