import { create } from 'zustand'
import type { ApiProposal } from '@/lib/chat/api'

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** One entry per drink on assistant turns that proposed an order. */
  proposals?: ApiProposal[]
  /** Set on assistant turns that should render the go-to-checkout card. */
  checkoutCard?: boolean
  /** Menu suggestions offered when the model degraded. */
  suggestions?: { itemId: string; itemName: string; categorySlug: string }[]
  /** Locked once the customer pressed Add — single source of truth for the
   *  card's disabled state, so a stale render can never re-enable it. */
  added?: boolean
}

interface ChatState {
  messages: ChatMessage[]
  isOpen: boolean
  isThinking: boolean
  /** In-memory, not persisted: the teaser greets once per app launch —
   *  same cadence as the web's per-browser-session flag. */
  teaserSeen: boolean
  open: () => void
  close: () => void
  push: (message: ChatMessage) => void
  setThinking: (value: boolean) => void
  markAdded: (messageId: string) => void
  markTeaserSeen: () => void
  clear: () => void
}

let counter = 0
export function newMessageId(): string {
  counter += 1
  return `m${counter}-${Math.random().toString(36).slice(2, 8)}`
}

/** Deliberately NOT persisted (web keeps sessionStorage; the RN analogue of
 *  "this browsing session" is "this app process"). The cart is what
 *  persists — this is just the conversation that filled it. */
export const useChat = create<ChatState>()((set) => ({
  messages: [],
  isOpen: false,
  isThinking: false,
  teaserSeen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  push: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setThinking: (value) => set({ isThinking: value }),
  markAdded: (messageId) =>
    set((s) => ({
      messages: s.messages.map((m) => (m.id === messageId ? { ...m, added: true } : m)),
    })),
  markTeaserSeen: () => set({ teaserSeen: true }),
  clear: () => set({ messages: [] }),
}))
