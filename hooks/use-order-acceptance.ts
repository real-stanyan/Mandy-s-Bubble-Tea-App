import { useEffect, useState } from 'react'
import { canAcceptOrders, type OrderAcceptance } from '@/components/home/helpers'

// Recomputes once a minute so UI flips to "closed" when the 22:25 cutoff passes
// even if the user has the screen open across the boundary.
export function useOrderAcceptance(): OrderAcceptance {
  const [status, setStatus] = useState<OrderAcceptance>(() => canAcceptOrders())
  useEffect(() => {
    const id = setInterval(() => setStatus(canAcceptOrders()), 60_000)
    return () => clearInterval(id)
  }, [])
  return status
}
