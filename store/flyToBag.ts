import { create } from 'zustand'
import type { Point } from '@/lib/motion/fly-path'

// Fly-to-bag: "Add to cart" launches a dot from wherever the button is; the
// root-level FlyToBagLayer animates it to the mini cart, then reports the
// landing so the bar can bump on arrival rather than the instant the store
// changed. Window coordinates throughout — the layer covers the window.

export type Flight = { id: number; from: Point }

interface FlyToBagState {
  flights: Flight[]
  /** Bumps once per landing; MiniCartBar reacts to the change. */
  landed: number
  launch: (from: Point) => void
  finish: (id: number) => void
}

let seq = 0

export const useFlyToBagStore = create<FlyToBagState>((set) => ({
  flights: [],
  landed: 0,
  launch: (from) => set((s) => ({ flights: [...s.flights, { id: ++seq, from }] })),
  finish: (id) =>
    set((s) => ({
      flights: s.flights.filter((f) => f.id !== id),
      landed: s.landed + 1,
    })),
}))
