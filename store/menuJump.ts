import { create } from 'zustand'

interface MenuJumpState {
  pendingSlug: string | null
  setPending: (slug: string | null) => void
}

export const useMenuJumpStore = create<MenuJumpState>((set) => ({
  pendingSlug: null,
  setPending: (slug) => set({ pendingSlug: slug }),
}))
