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

// TTL so sold-out / price edits made in Square Dashboard propagate
// without forcing the user to pull-to-refresh. Hook state stays warm
// between screens; only the age check causes a refetch. Kept short
// so dashboard edits show up within ~10s end-to-end.
const MENU_CACHE_TTL_MS = 5_000

let cache: MenuSnapshot | null = null
let cacheAt = 0
let inFlight: Promise<MenuSnapshot> | null = null
const subscribers = new Set<(s: MenuSnapshot) => void>()

function isCacheFresh() {
  return cache != null && Date.now() - cacheAt < MENU_CACHE_TTL_MS
}

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
  if (!force && isCacheFresh()) return Promise.resolve(cache!)
  if (inFlight) return inFlight
  inFlight = fetchSnapshot()
    .then((snap) => {
      cache = snap
      cacheAt = Date.now()
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
    const fresh = isCacheFresh()
    if (!fresh) {
      // Stale or missing cache — refetch silently if we already have
      // snapshot data, else flip loading on.
      if (!cache) setLoading(true)
      load(true)
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
