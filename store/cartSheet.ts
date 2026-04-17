import { create } from 'zustand'

interface CartSheetState {
  open: boolean
  show: () => void
  hide: () => void
  toggle: () => void
}

export const useCartSheetStore = create<CartSheetState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
}))
