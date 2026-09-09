import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItem, CartModifier } from '@/types/square'
import type { SvgPath } from '@/lib/doodle/types'

export type DeliveryAddress = {
  address: string
  lat: number
  lng: number
  unit: string
  driverNote: string
  postcode: string
}

const EMPTY_ADDRESS: DeliveryAddress = {
  address: '',
  lat: 0,
  lng: 0,
  unit: '',
  driverNote: '',
  postcode: '',
}

export type CupLabelSelection =
  | { kind: 'preset'; hash: string }
  | { kind: 'photo'; uploadedDoodleId: string; previewUrl: string }
  | { kind: 'draw'; userDoodleId: string | null; pathCount: number; paths: SvgPath[] }
  | { kind: 'ai'; aiDoodleId: string | null; prompt: string; previewUri?: string }

/** Per-cup key. lineId is `signatureFor` output (uses `::` internally), so
 *  single-colon separator stays unambiguous and matches web server `slotKey`. */
export function cupKey(lineId: string, cupIdx: number): string {
  return `${lineId}:${cupIdx}`
}

interface CartState {
  items: CartItem[]
  labelSelections: Record<string, CupLabelSelection>
  // Opaque UUID minted lazily the first time someone needs it. Carries
  // through cart edits and survives app restarts, but is rotated on
  // clearCart() so a fresh shopping session starts with a fresh
  // identifier. Used by AI-doodle submission to scope the server-side
  // 1×-per-slot quota to *this* cart instead of forever — same drink
  // + cup_idx in a different cart gets a new AI image, not the one
  // baked in last week. See web /api/cup-label/ai-submit.
  cartSessionId: string | null
  fulfillmentType: 'PICKUP' | 'DELIVERY'
  deliveryAddress: DeliveryAddress
  addItem: (item: Omit<CartItem, 'quantity' | 'lineId'>) => void
  removeItem: (lineId: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  /** Swap one line for a re-customised version of itself (the checkout
   *  page's Edit). `quantity` is the new total for that drink. The row keeps
   *  its place; an edit that lands on a drink already in the bag folds the
   *  two together; per-cup label selections ride along to the new key so a
   *  sticker picked before the edit is not lost. Mirrors web replaceLine. */
  replaceItem: (
    lineId: string,
    item: Omit<CartItem, 'quantity' | 'lineId'>,
    quantity: number,
  ) => void
  clearCart: () => void
  /** Alias for clearCart — also wipes labelSelections. */
  clear: () => void
  total: () => number
  itemCount: () => number
  /** Returns the session id, generating one if it doesn't exist yet. */
  ensureCartSessionId: () => string
  setLabel: (cupKey: string, selection: CupLabelSelection) => void
  clearLabel: (cupKey: string) => void
  setFulfillmentType: (t: 'PICKUP' | 'DELIVERY') => void
  setDeliveryAddress: (patch: Partial<DeliveryAddress>) => void
}

function newSessionId(): string {
  // RN doesn't have crypto.randomUUID in all runtimes; fall back to a
  // composition of Math.random + Date.now that's collision-safe enough
  // for a per-cart identifier.
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  const a = Math.random().toString(16).slice(2, 10)
  const b = Math.random().toString(16).slice(2, 10)
  const t = Date.now().toString(16)
  return `${t}-${a}-${b}`
}

/** Re-key one line's cup selections onto another line: cup i of `fromId`
 *  becomes cup `offset + i` of `toId`, dropped if that lands past `maxQty`.
 *  Selections already under `toId` (a twin line's own cups) are kept. */
function moveSelectionsToLine(
  selections: Record<string, CupLabelSelection>,
  fromId: string,
  toId: string,
  offset: number,
  maxQty: number,
): Record<string, CupLabelSelection> {
  const prefix = `${fromId}:`
  const next: Record<string, CupLabelSelection> = {}
  for (const [k, v] of Object.entries(selections)) {
    if (!k.startsWith(prefix)) {
      next[k] = v
      continue
    }
    const idx = Number(k.slice(prefix.length))
    if (!Number.isFinite(idx)) continue
    const target = offset + idx
    if (target < maxQty) next[cupKey(toId, target)] = v
  }
  return next
}

export function buildLineId(variationId: string, modifiers: CartModifier[]): string {
  const modKey = [...modifiers]
    .map((m) => m.id)
    .sort()
    .join(',')
  return `${variationId}::${modKey}`
}

// Exported for unit testing — see store/cart-migration.test.ts. Returns
// the post-migration state shape that the persist middleware will hydrate
// the store with. Keeps the existing v1→v2 normalization (legacy raw
// `items` get a synthesized lineId) AND adds v2→v3 (initialize
// labelSelections to {}; v3 inputs pass labelSelections through).
export function createMigrate(state: unknown, fromVersion: number): CartState {
  const s = (state ?? {}) as Partial<CartState> & { items?: Partial<CartItem>[] }

  // v1 → v2 normalization (preserved): synthesize lineId on each item.
  const rawItems = s.items ?? []
  const items: CartItem[] = rawItems.map((i) => {
    const modifiers = (i.modifiers ?? []) as CartModifier[]
    const lineId = i.lineId ?? buildLineId(i.variationId ?? '', modifiers)
    return { ...i, modifiers, lineId } as CartItem
  })

  // v2 → v3: introduce labelSelections; preserve if v3 already.
  const labelSelections =
    fromVersion >= 3 && s.labelSelections ? s.labelSelections : {}

  return {
    items,
    labelSelections,
    cartSessionId: s.cartSessionId ?? newSessionId(),
    isOpen: false,
    hydrated: true,
  } as unknown as CartState
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      cartSessionId: null,
      labelSelections: {} as Record<string, CupLabelSelection>,
      fulfillmentType: 'PICKUP' as const,
      deliveryAddress: { ...EMPTY_ADDRESS },

      addItem: (item) =>
        set((state) => {
          const modifiers = item.modifiers ?? []
          const lineId = buildLineId(item.variationId, modifiers)
          const existing = state.items.find((i) => i.lineId === lineId)
          // Mint a session id on first add so the cart can be referenced
          // by AI-doodle quota lookups for the rest of this shopping
          // session.
          const cartSessionId = state.cartSessionId ?? newSessionId()
          if (existing) {
            return {
              cartSessionId,
              items: state.items.map((i) =>
                i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            }
          }
          return {
            cartSessionId,
            items: [...state.items, { ...item, modifiers, lineId, quantity: 1 }],
          }
        }),

      removeItem: (lineId) =>
        set((state) => {
          const nextSelections: Record<string, CupLabelSelection> = {}
          for (const [k, v] of Object.entries(state.labelSelections)) {
            if (!k.startsWith(`${lineId}:`)) nextSelections[k] = v
          }
          return {
            items: state.items.filter((i) => i.lineId !== lineId),
            labelSelections: nextSelections,
          }
        }),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const nextSelections: Record<string, CupLabelSelection> = {}
            for (const [k, v] of Object.entries(state.labelSelections)) {
              if (!k.startsWith(`${lineId}:`)) nextSelections[k] = v
            }
            return {
              items: state.items.filter((i) => i.lineId !== lineId),
              labelSelections: nextSelections,
            }
          }
          // Prune label selections for cup indices that no longer exist
          const nextSelections: Record<string, CupLabelSelection> = {}
          for (const [k, v] of Object.entries(state.labelSelections)) {
            if (k.startsWith(`${lineId}:`)) {
              const cupIdx = parseInt(k.split(':').pop()!, 10)
              if (cupIdx < quantity) nextSelections[k] = v
            } else {
              nextSelections[k] = v
            }
          }
          return {
            items: state.items.map((i) =>
              i.lineId === lineId ? { ...i, quantity } : i,
            ),
            labelSelections: nextSelections,
          }
        }),

      replaceItem: (lineId, item, quantity) =>
        set((state) => {
          const qty = Math.max(1, Math.floor(quantity))
          const modifiers = item.modifiers ?? []
          const newId = buildLineId(item.variationId, modifiers)
          const oldIdx = state.items.findIndex((i) => i.lineId === lineId)
          if (oldIdx === -1) {
            // The line went away under the form (a cleared bag). The
            // customer still wants this drink: add it, quietly.
            const twin = state.items.find((i) => i.lineId === newId)
            return {
              items: twin
                ? state.items.map((i) =>
                    i.lineId === newId ? { ...i, quantity: i.quantity + qty } : i,
                  )
                : [...state.items, { ...item, modifiers, lineId: newId, quantity: qty }],
            }
          }
          if (newId === lineId) {
            // Same drink, maybe a new quantity.
            const nextSelections: Record<string, CupLabelSelection> = {}
            for (const [k, v] of Object.entries(state.labelSelections)) {
              if (k.startsWith(`${lineId}:`)) {
                const cupIdx = parseInt(k.split(':').pop()!, 10)
                if (cupIdx < qty) nextSelections[k] = v
              } else {
                nextSelections[k] = v
              }
            }
            return {
              items: state.items.map((i) =>
                i.lineId === lineId ? { ...i, ...item, modifiers, quantity: qty } : i,
              ),
              labelSelections: nextSelections,
            }
          }
          const twin = state.items.find((i) => i.lineId === newId)
          if (!twin) {
            const items = state.items.slice()
            items[oldIdx] = { ...item, modifiers, lineId: newId, quantity: qty }
            return {
              items,
              labelSelections: moveSelectionsToLine(state.labelSelections, lineId, newId, 0, qty),
            }
          }
          // Edited into a drink that is already in the bag: fold these cups in
          // after the ones it has, and drop the row that was edited.
          const offset = twin.quantity
          return {
            items: state.items
              .filter((i) => i.lineId !== lineId)
              .map((i) => (i.lineId === newId ? { ...i, quantity: i.quantity + qty } : i)),
            labelSelections: moveSelectionsToLine(
              state.labelSelections,
              lineId,
              newId,
              offset,
              offset + qty,
            ),
          }
        }),

      clearCart: () => set({ items: [], cartSessionId: null, labelSelections: {}, fulfillmentType: 'PICKUP', deliveryAddress: { ...EMPTY_ADDRESS } }),

      clear: () => set({ items: [], cartSessionId: null, labelSelections: {}, fulfillmentType: 'PICKUP', deliveryAddress: { ...EMPTY_ADDRESS } }),

      setLabel: (key, selection) =>
        set((s) => ({ labelSelections: { ...s.labelSelections, [key]: selection } })),

      clearLabel: (key) =>
        set((s) => {
          const next = { ...s.labelSelections }
          delete next[key]
          return { labelSelections: next }
        }),

      setFulfillmentType: (t) => set({ fulfillmentType: t }),

      setDeliveryAddress: (patch) =>
        set((s) => ({ deliveryAddress: { ...s.deliveryAddress, ...patch } })),

      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      ensureCartSessionId: () => {
        const current = get().cartSessionId
        if (current) return current
        const fresh = newSessionId()
        set({ cartSessionId: fresh })
        return fresh
      },
    }),
    {
      name: 'mandys-cart',
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (state, version) => createMigrate(state, version) as CartState,
      version: 3,
      partialize: (s) => ({
        items: s.items,
        labelSelections: s.labelSelections,
        cartSessionId: s.cartSessionId,
        fulfillmentType: s.fulfillmentType,
      }),
    },
  ),
)

/** Alias exported under the plan-canonical name so new modules can import
 *  `useCart` while legacy code keeps `useCartStore`. Both reference the same
 *  store instance. */
export const useCart = useCartStore
