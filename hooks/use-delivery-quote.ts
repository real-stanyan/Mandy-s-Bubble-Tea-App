import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'
import {
  type QuoteState,
  type FulfillmentType,
  isDeliverablePostcode,
  isDeliveryEligible,
  quoteReasonCopy,
} from '@/lib/delivery'
import type { DeliveryAddress } from '@/store/cart'

type Args = {
  fulfillment: FulfillmentType
  address: DeliveryAddress
  drinksSubtotalCents: number
}

export function useDeliveryQuote({ fulfillment, address, drinksSubtotalCents }: Args): QuoteState {
  const [state, setState] = useState<QuoteState>({ kind: 'idle' })

  useEffect(() => {
    if (fulfillment !== 'DELIVERY') {
      setState({ kind: 'idle' })
      return
    }
    if (!address.lat || !address.lng || !address.address) {
      setState({ kind: 'idle' })
      return
    }
    if (!address.postcode) {
      setState({ kind: 'error', message: 'Enter your delivery postcode' })
      return
    }
    if (!isDeliverablePostcode(address.postcode)) {
      setState({ kind: 'error', message: "Sorry, we don't deliver to that postcode" })
      return
    }
    if (!isDeliveryEligible(drinksSubtotalCents)) {
      setState({ kind: 'error', message: 'Add more to qualify for delivery' })
      return
    }

    setState({ kind: 'loading' })
    let cancelled = false
    apiFetch<{ ok: boolean; feeCents?: number; serviceFeeCents?: number; reason?: string }>(
      '/api/delivery/quote',
      {
        method: 'POST',
        body: JSON.stringify({
          address: address.address,
          lat: address.lat,
          lng: address.lng,
          unit: address.unit,
          driverNote: address.driverNote,
          postcode: address.postcode,
          drinksSubtotalCents,
        }),
      },
    )
      .then((data) => {
        if (cancelled) return
        if (data.ok) {
          setState({ kind: 'ok', feeCents: data.feeCents!, serviceFeeCents: data.serviceFeeCents! })
        } else {
          setState({ kind: 'error', message: quoteReasonCopy(data.reason ?? '') })
        }
      })
      .catch(() => {
        if (cancelled) return
        setState({ kind: 'error', message: "Couldn't reach delivery service" })
      })
    return () => {
      cancelled = true
    }
  }, [fulfillment, address.address, address.lat, address.lng, address.postcode, address.unit, address.driverNote, drinksSubtotalCents])

  return state
}
