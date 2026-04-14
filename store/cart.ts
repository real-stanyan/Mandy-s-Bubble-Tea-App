import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItem, CartModifier } from '@/types/square'

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity' | 'lineId'>) => void
  removeItem: (lineId: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
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

      addItem: (item) =>
        set((state) => {
          const modifiers = item.modifiers ?? []
          const lineId = buildLineId(item.variationId, modifiers)
          const existing = state.items.find((i) => i.lineId === lineId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            }
          }
          return { items: [...state.items, { ...item, modifiers, lineId, quantity: 1 }] }
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

      clearCart: () => set({ items: [] }),

      total: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
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
