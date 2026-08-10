import { View, Text, Pressable, StyleSheet } from 'react-native'
import * as Haptics from 'expo-haptics'
import { T, RADIUS } from '@/constants/theme'
import { SquareImage } from '@/components/ui/SquareImage'
import { useCartStore } from '@/store/cart'
import { useChat } from '@/store/chat'
import { chatUiStrings } from '@/lib/chat/ui-strings'
import { formatPrice } from '@/lib/utils'
import type { ApiProposal } from '@/lib/chat/api'

// Mirrors the web's chat proposal card: one card per assistant turn,
// however many drinks it proposed; a single confirm adds every line —
// letting the customer silently take half an order is how "I ordered two
// drinks but paid for one" support threads start.

function ProposalRow({ proposal }: { proposal: ApiProposal }) {
  const modifierSummary = proposal.modifiers.map((m) => m.name).join(', ')
  return (
    <View style={styles.row}>
      {proposal.imageUrl ? (
        <SquareImage url={proposal.imageUrl} width={112} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Text style={styles.thumbEmoji}>🧋</Text>
        </View>
      )}
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {proposal.itemName}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {proposal.variationName}
        </Text>
        {modifierSummary ? (
          <Text style={styles.sub} numberOfLines={2}>
            {modifierSummary}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.price}>{formatPrice(Number(proposal.totalCents))}</Text>
        {proposal.quantity > 1 ? <Text style={styles.sub}>×{proposal.quantity}</Text> : null}
      </View>
    </View>
  )
}

export function DrinkProposalCard({
  messageId,
  proposals,
  added,
}: {
  messageId: string
  proposals: ApiProposal[]
  added?: boolean
}) {
  const t = chatUiStrings()
  const addItem = useCartStore((s) => s.addItem)
  const markAdded = useChat((s) => s.markAdded)

  const cupCount = proposals.reduce((n, p) => n + p.quantity, 0)
  const orderTotal = proposals.reduce((sum, p) => sum + Number(p.totalCents), 0)

  function handleAdd() {
    // Live-store guard, same as the web card: a double-tap can beat the
    // re-render that disables the button.
    const already = useChat.getState().messages.find((m) => m.id === messageId)?.added
    if (already) return
    markAdded(messageId)
    for (const p of proposals) {
      // The app's addItem has no quantity param — it merges by lineId and
      // increments, so N calls yield quantity N on one line.
      for (let i = 0; i < p.quantity; i++) {
        addItem({
          id: p.itemId,
          variationId: p.variationId,
          name: p.itemName,
          price: Number(p.unitPriceCents),
          imageUrl: p.imageUrl ?? undefined,
          variationName: p.variationName,
          modifiers: p.modifiers.map((m) => ({
            id: m.id,
            name: m.name,
            // The wire shape carries no list name; display-only field.
            listName: '',
            priceCents: Number(m.priceCents),
          })),
        })
      }
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  if (proposals.length === 0) return null

  return (
    <View style={styles.card}>
      <View style={styles.rows}>
        {proposals.map((p, i) => (
          <ProposalRow key={`${p.itemId}-${p.variationId}-${i}`} proposal={p} />
        ))}
      </View>

      {proposals.length > 1 ? (
        <View style={styles.totalRow}>
          <Text style={styles.sub}>{t.cupsTotal(cupCount)}</Text>
          <Text style={styles.price}>{formatPrice(orderTotal)}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={handleAdd}
        disabled={added}
        style={({ pressed }) => [
          styles.addBtn,
          added && styles.addBtnDisabled,
          pressed && !added && styles.addBtnPressed,
        ]}
      >
        <Text style={styles.addBtnText}>
          {added ? t.addedToCart : proposals.length > 1 ? t.addAllToCart(cupCount) : t.addToCart}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    padding: 12,
  },
  rows: { gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  thumbFallback: {
    backgroundColor: T.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 20 },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: T.ink },
  sub: { fontFamily: 'ShantellSans_400Regular', fontSize: 12, color: T.ink3 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  price: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: T.brand },
  totalRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.line,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addBtn: {
    marginTop: 12,
    borderRadius: 999,
    backgroundColor: T.brand,
    paddingVertical: 10,
    alignItems: 'center',
  },
  addBtnPressed: { backgroundColor: T.brandDark },
  addBtnDisabled: { opacity: 0.5 },
  addBtnText: { fontFamily: 'ShantellSans_700Bold', fontSize: 14, color: '#fff' },
})
