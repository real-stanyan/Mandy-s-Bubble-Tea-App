import { create } from 'zustand'

interface ItemSheetState {
  itemId: string | null
  categorySlug: string | null
  open: (id: string, categorySlug?: string | null) => void
  close: () => void
}

export const useItemSheetStore = create<ItemSheetState>((set) => ({
  itemId: null,
  categorySlug: null,
  open: (id, categorySlug = null) => set({ itemId: id, categorySlug }),
  close: () => set({ itemId: null, categorySlug: null }),
}))
