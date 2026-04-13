import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { CartItem } from '@/types/square'

interface CartState {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'quantity'>) => void
  removeItem: (variationId: string) => void
  updateQuantity: (variationId: string, quantity: number) => void
  clearCart: () => void
  total: () => number
  itemCount: () => number
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const existing = state.items.find((i) => i.variationId === item.variationId)
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variationId === item.variationId
                  ? { ...i, quantity: i.quantity + 1 }
                  : i
              ),
            }
          }
          return { items: [...state.items, { ...item, quantity: 1 }] }
        }),

      removeItem: (variationId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variationId !== variationId),
        })),

      updateQuantity: (variationId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.variationId !== variationId) }
          }
          return {
            items: state.items.map((i) =>
              i.variationId === variationId ? { ...i, quantity } : i
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
    }
  )
)
