import { useEffect, useState } from 'react'
import { getStoreStatus, type StoreStatus } from '@/components/home/helpers'

// Recomputes once a minute so the store badge flips to "Closed" when 22:30
// passes even if the user keeps the checkout screen open across the boundary.
// Mirrors use-order-acceptance.ts.
export function useStoreStatus(): StoreStatus {
  const [status, setStatus] = useState<StoreStatus>(() => getStoreStatus())
  useEffect(() => {
    const id = setInterval(() => setStatus(getStoreStatus()), 60_000)
    return () => clearInterval(id)
  }, [])
  return status
}
