import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CatalogItem } from '@/types/square'

// Module-level single-flight cache. Order screens mount from multiple
// entry points (Account tab, My Orders tab, order-detail), and each fresh
// mount should reuse the first fetch instead of re-downloading the full
// catalog (~1MB).
let catalogImageMap: Record<string, string> | null = null
let inFlight: Promise<Record<string, string>> | null = null

function fetchMap(): Promise<Record<string, string>> {
  if (catalogImageMap) return Promise.resolve(catalogImageMap)
  if (inFlight) return inFlight
  inFlight = apiFetch<{ items: CatalogItem[] }>('/api/catalog')
    .then((data) => {
      const map: Record<string, string> = {}
      for (const item of data.items ?? []) {
        const name = item.itemData?.name
        if (name && item.imageUrl) map[name] = item.imageUrl
      }
      catalogImageMap = map
      return map
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useCatalogImageMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>(
    () => catalogImageMap ?? {},
  )

  useEffect(() => {
    if (catalogImageMap) return
    let cancelled = false
    fetchMap()
      .then((m) => {
        if (!cancelled) setMap(m)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return map
}
