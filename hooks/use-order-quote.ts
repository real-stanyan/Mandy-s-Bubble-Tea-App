import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import { isQuoteStale, type OrderQuote } from '@/lib/order-quote'
import { staleCartFrom, type StaleCart } from '@/lib/stale-cart'

export type { OrderQuote, QuoteAmount } from '@/lib/order-quote'
export { quoteCents, serviceChargeCents } from '@/lib/order-quote'
export type { StaleCart } from '@/lib/stale-cart'

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
): {
  quote: OrderQuote | null
  loading: boolean
  blocked: StaleCart | null
  /**
   * The cart on screen hasn't been answered yet — the request for it is
   * debouncing or in flight, so `quote` (if any) was priced for a *previous*
   * cart. Distinct from `loading`, which stays false through the 250ms
   * debounce and so can't gate anything: tapping the reward stepper and then
   * Pay lands inside exactly that window.
   *
   * Clears as soon as the current cart's request settles, including the
   * failures this hook deliberately swallows (offline, Square down). Those
   * fall back to the bare cart subtotal and still let the order through, so
   * staying stale forever would strand the pay button.
   */
  stale: boolean
  /**
   * The quote object on hand was priced for the cart currently on screen —
   * so its *contents* (net total, discounts, charges) can be believed, not
   * just its arrival.
   *
   * Deliberately separate from `!stale`. `stale` answers "has this cart's
   * request finished", which is the right question for enabling the pay
   * button and must clear on swallowed failures. This answers "is the quote
   * we're holding the answer to this cart", which a swallowed failure does
   * NOT make true: the old quote stays up on purpose, and reading a total or
   * a "this is free" out of it would describe the wrong cart.
   */
  quoteFresh: boolean
} {
  const [quote, setQuote] = useState<OrderQuote | null>(null)
  const [blocked, setBlocked] = useState<StaleCart | null>(null)
  const [loading, setLoading] = useState(false)
  // The effect key whose request has settled — compared against the current
  // one to decide `stale`.
  const [settledKey, setSettledKey] = useState<string | null>(null)
  // The effect key the quote *on hand* was priced for. Moves only when the
  // visible quote is replaced — unlike `settledKey`, a swallowed failure
  // leaves it behind, because the stale quote is still the old cart's answer.
  const [quotedKey, setQuotedKey] = useState<string | null>(null)
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
          if (json?.ok) {
            setQuote(json)
            setBlocked(null)
            setQuotedKey(effectKey)
          }
          setLoading(false)
          setSettledKey(effectKey)
        })
        .catch((err) => {
          if (cancelled) return
          const stale = staleCartFrom(err)
          if (stale) {
            // Drop the old quote as well as flagging it. It was priced for a
            // cart that no longer exists, and leaving it up would keep a
            // believable total on screen underneath the warning that says not
            // to believe it.
            setQuote(null)
            setBlocked(stale)
            // Holding nothing is an honest answer for this cart — checkout is
            // blocked on the retired item anyway.
            setQuotedKey(effectKey)
          }
          setLoading(false)
          // A swallowed failure still answers this cart — see `stale`.
          setSettledKey(effectKey)
        })
    }, DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Both, though effectKey already contains key: React compares the array as
    // a whole, so the extra entry can never cause a second fetch.
  }, [key, effectKey])

  // An emptied cart drops both without a state write during render.
  return {
    quote: key ? quote : null,
    loading: key ? loading : false,
    blocked: key ? blocked : null,
    stale: isQuoteStale(effectKey, settledKey),
    quoteFresh: !isQuoteStale(effectKey, quotedKey),
  }
}
