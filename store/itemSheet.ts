import { create } from 'zustand'

interface ItemSheetState {
  itemId: string | null
  open: (id: string) => void
  close: () => void
}

export const useItemSheetStore = create<ItemSheetState>((set) => ({
  itemId: null,
  open: (id) => set({ itemId: id }),
  close: () => set({ itemId: null }),
}))
