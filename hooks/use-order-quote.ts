import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import type { OrderQuote } from '@/lib/order-quote'

export type { OrderQuote, QuoteAmount } from '@/lib/order-quote'
export { quoteCents, serviceChargeCents } from '@/lib/order-quote'

// Asks the server what this cart costs. The answer replaces what checkout used
// to work out for itself — welcome / IG follow / tier / diamond toppings /
// flash / app-download and their exclusive better-of, plus the three
// percentage surcharges. That local copy of the rules could only lag the
// server's, and did: a customer holding the app-download 20% saw a smaller
// Welcome discount instead (#40; web-side mandys_bubble_tea docs/adr/0005).
//
// Stale-while-revalidate: a refetch leaves the previous quote on screen rather
// than blanking the summary on every reward-count tap. The charged amount never
// comes from here anyway — it comes from the created order's own total.

const DEBOUNCE_MS = 250

export function useOrderQuote(
  body: unknown | null,
  enabled: boolean,
  /**
   * Extra value that forces a refetch without being part of the request. The
   * public-holiday flag uses it: crossing midnight changes the surcharge but
   * nothing in the cart, so nothing in the body would move.
   */
  refreshKey: string | number | boolean = '',
): { quote: OrderQuote | null; loading: boolean } {
  const [quote, setQuote] = useState<OrderQuote | null>(null)
  const [loading, setLoading] = useState(false)
  // The serialized body doubles as the effect key: a re-render that produces
  // an identical cart must not refetch. `null` means "nothing to price".
  const key = enabled && body ? JSON.stringify(body) : null
  const effectKey = key === null ? null : `${key}|${refreshKey}`

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const timer = setTimeout(() => {
      setLoading(true)
      apiFetch<OrderQuote & { ok: boolean }>('/api/orders/quote', {
        method: 'POST',
        body: key,
      })
        .then((json) => {
          if (cancelled) return
          // Only a successful quote replaces the visible one — that IS the
          // stale-while-revalidate behaviour. A failure (offline, Square down)
          // leaves the previous one up; checkout falls back to the plain cart
          // subtotal when there has never been one.
          if (json?.ok) setQuote(json)
          setLoading(false)
        })
        .catch(() => {
          if (cancelled) return
          setLoading(false)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Both, though effectKey already contains key: React compares the array as
    // a whole, so the extra entry can never cause a second fetch.
  }, [key, effectKey])

  return { quote: key ? quote : null, loading: key ? loading : false }
}
