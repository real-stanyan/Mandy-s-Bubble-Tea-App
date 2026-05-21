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
  /** Remove a line by lineId and prune its label selections. */
  removeLine: (lineId: string) => void
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
        set((state) => ({
          items: state.items.filter((i) => i.lineId !== lineId),
        })),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.lineId !== lineId) }
          }
          return {
            items: state.items.map((i) =>
              i.lineId === lineId ? { ...i, quantity } : i,
            ),
          }
        }),

      clearCart: () => set({ items: [], cartSessionId: null, labelSelections: {} }),

      clear: () => set({ items: [], cartSessionId: null, labelSelections: {} }),

      removeLine: (lineId) =>
        set((s) => {
          const nextSelections: Record<string, CupLabelSelection> = {}
          for (const [k, v] of Object.entries(s.labelSelections)) {
            if (!k.startsWith(`${lineId}:`)) nextSelections[k] = v
          }
          return {
            items: s.items.filter((i) => i.lineId !== lineId),
            labelSelections: nextSelections,
          }
        }),

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
      // Migrate pre-modifier cart entries so existing sessions don't crash.
      migrate: (state: unknown) => {
        const s = state as { items?: Partial<CartItem>[] } | undefined
        if (!s?.items) return s as CartState
        return {
          ...s,
          items: s.items.map((i) => {
            const modifiers = (i.modifiers ?? []) as CartModifier[]
            const lineId =
              i.lineId ?? buildLineId(i.variationId ?? '', modifiers)
            return { ...i, modifiers, lineId } as CartItem
          }),
        } as CartState
      },
      version: 2,
    },
  ),
)

/** Alias exported under the plan-canonical name so new modules can import
 *  `useCart` while legacy code keeps `useCartStore`. Both reference the same
 *  store instance. */
export const useCart = useCartStore
