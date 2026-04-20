import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { CatalogItem, CatalogCategory } from '@/types/square'

interface MenuSnapshot {
  items: CatalogItem[]
  categories: CatalogCategory[]
}

interface MenuData extends MenuSnapshot {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

let cache: MenuSnapshot | null = null
let inFlight: Promise<MenuSnapshot> | null = null
const subscribers = new Set<(s: MenuSnapshot) => void>()

function deriveCategories(
  items: CatalogItem[],
  provided?: CatalogCategory[],
): CatalogCategory[] {
  if (provided?.length) return provided
  const catMap = new Map<string, string>()
  for (const item of items) {
    for (const cat of item.itemData?.categories ?? []) {
      if (cat.id && cat.name && !catMap.has(cat.id)) catMap.set(cat.id, cat.name)
    }
  }
  return Array.from(catMap, ([id, name]) => ({ id, name }))
}

async function fetchSnapshot(): Promise<MenuSnapshot> {
  const data = await apiFetch<{ items: CatalogItem[]; categories?: CatalogCategory[] }>(
    '/api/catalog',
  )
  const items = data.items ?? []
  return { items, categories: deriveCategories(items, data.categories) }
}

function load(force = false): Promise<MenuSnapshot> {
  if (!force && cache) return Promise.resolve(cache)
  if (inFlight) return inFlight
  inFlight = fetchSnapshot()
    .then((snap) => {
      cache = snap
      subscribers.forEach((fn) => fn(snap))
      return snap
    })
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

export function useMenu(): MenuData {
  const [snap, setSnap] = useState<MenuSnapshot>(
    () => cache ?? { items: [], categories: [] },
  )
  const [loading, setLoading] = useState(() => !cache)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    const sub = (s: MenuSnapshot) => {
      if (mounted.current) setSnap(s)
    }
    subscribers.add(sub)
    if (!cache) {
      setLoading(true)
      load()
        .then(() => mounted.current && setLoading(false))
        .catch((e: unknown) => {
          if (!mounted.current) return
          setError(e instanceof Error ? e.message : 'Failed to load menu')
          setLoading(false)
        })
    }
    return () => {
      mounted.current = false
      subscribers.delete(sub)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await load(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load menu')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  return { items: snap.items, categories: snap.categories, loading, error, refresh }
}
