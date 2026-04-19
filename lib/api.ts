import { supabase } from '@/lib/supabase'

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  }
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json()
}
