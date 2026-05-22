import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItem, CartModifier } from '@/types/square'
import type { SvgPath } from '@/lib/doodle/types'

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
  addItem: (item: Omit<CartItem, 'quantity' | 'lineId'>) => void
  removeItem: (lineId: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  clearCart: () => void
  /** Alias for clearCart — also wipes labelSelections. */
  clear: () => void
  total: () => number
  itemCount: () => number
  /** Returns the session id, generating one if it doesn't exist yet. */
  ensureCartSessionId: () => string
  setLabel: (cupKey: string, selection: CupLabelSelection) => void
  clearLabel: (cupKey: string) => void
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

      clearCart: () => set({ items: [], cartSessionId: null, labelSelections: {} }),

      clear: () => set({ items: [], cartSessionId: null, labelSelections: {} }),

      setLabel: (key, selection) =>
        set((s) => ({ labelSelections: { ...s.labelSelections, [key]: selection } })),

      clearLabel: (key) =>
        set((s) => {
          const next = { ...s.labelSelections }
          delete next[key]
          return { labelSelections: next }
        }),

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
    },
  ),
)

/** Alias exported under the plan-canonical name so new modules can import
 *  `useCart` while legacy code keeps `useCartStore`. Both reference the same
 *  store instance. */
export const useCart = useCartStore
