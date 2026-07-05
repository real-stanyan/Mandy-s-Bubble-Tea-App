import { useEffect, useState } from 'react'
import { API_BASE } from '@/lib/api'
import type { AppConfig } from '@/lib/app-config'

// Fetch the remote min-version config once at app start. 3s timeout and
// FAIL-OPEN on any failure (network, non-2xx, bad JSON): returning null
// means "don't gate" — the app must never be bricked by a config fetch.
export function useAppConfig(): AppConfig | null {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3_000)

    fetch(`${API_BASE}/api/app-config`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<AppConfig>) : null))
      .then((json) => {
        if (!cancelled && json) setConfig(json)
      })
      .catch(() => {
        // fail-open — null config means no gate
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [])

  return config
}
