import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import Svg, { Path } from 'react-native-svg'
import { useItemSheetStore } from '@/store/itemSheet'
import { useChat, newMessageId, type ChatMessage } from '@/store/chat'
import { sendChat, MAX_CHARS } from '@/lib/chat/api'
import { chatUiStrings } from '@/lib/chat/ui-strings'
import { ApiError } from '@/lib/api'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS, PIN } from '@/constants/theme'
import { DrinkProposalCard } from './DrinkProposalCard'
import { CheckoutCard } from './CheckoutCard'

function SendIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M4.5 12 3 4.5c-.2-.9.7-1.6 1.5-1.2l16 7.6c.8.4.8 1.8 0 2.2l-16 7.6c-.8.4-1.7-.3-1.5-1.2L4.5 12Zm0 0h7"
        stroke="#fff"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function ChatSheet() {
  const t = chatUiStrings()
  const isOpen = useChat((s) => s.isOpen)
  const close = useChat((s) => s.close)
  const messages = useChat((s) => s.messages)
  const push = useChat((s) => s.push)
  const isThinking = useChat((s) => s.isThinking)
  const setThinking = useChat((s) => s.setThinking)
  const openItemSheet = useItemSheetStore((s) => s.open)

  const [draft, setDraft] = useState('')
  const ref = useRef<BottomSheetModal>(null)
  const scrollRef = useRef<React.ComponentRef<typeof BottomSheetScrollView>>(null)
  const snapPoints = useMemo(() => ['85%'], [])

  useEffect(() => {
    if (isOpen) ref.current?.present()
    else ref.current?.dismiss()
  }, [isOpen])

  // Latest content into view on every list change — the proposal card is
  // the conversion action and must not hide below the fold.
  useEffect(() => {
    const timer = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80)
    return () => clearTimeout(timer)
  }, [messages, isThinking])

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) close()
    },
    [close],
  )

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    [],
  )

  async function send() {
    const text = draft.trim().slice(0, MAX_CHARS)
    // Live-store read: a fast double-tap on send must not slip a second
    // POST through before React re-renders the disabled state.
    if (!text || useChat.getState().isThinking) return
    setDraft('')
    push({ id: newMessageId(), role: 'user', content: text })
    setThinking(true)

    const history = [
      ...useChat.getState().messages.filter((m) => m.role === 'user' || m.role === 'assistant'),
    ].map((m) => ({ role: m.role, content: m.content }))

    try {
      const body = await sendChat(history)
      const reply: ChatMessage = {
        id: newMessageId(),
        role: 'assistant',
        content: body.reply,
        proposals: body.proposals?.length
          ? body.proposals
          : body.proposal
            ? [body.proposal]
            : undefined,
        suggestions: body.suggestions?.length ? body.suggestions : undefined,
        // A card, not an instant redirect — same call as the web.
        checkoutCard: body.action === 'checkout' || undefined,
      }
      push(reply)
    } catch (err) {
      push({
        id: newMessageId(),
        role: 'assistant',
        content: err instanceof ApiError && err.status === 429 ? t.rateLimited : t.networkError,
      })
    } finally {
      setThinking(false)
    }
  }

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={styles.sheetBg}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <View style={styles.dragHandle} />
      <View style={styles.header}>
        <Text style={styles.title}>{t.drawerTitle}</Text>
        <Pressable
          onPress={close}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
        >
          <Icon name="close" color={T.ink} size={22} />
        </Pressable>
      </View>

      <BottomSheetScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {messages.length === 0 ? <Text style={styles.hint}>{t.emptyStateHint}</Text> : null}

        {messages.map((m) => {
          const proposals = m.proposals ?? []
          return (
            <View
              key={m.id}
              style={[styles.messageRow, m.role === 'user' ? styles.rowUser : styles.rowBot]}
            >
              <View style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
                <Text style={m.role === 'user' ? styles.bubbleUserText : styles.bubbleBotText}>
                  {m.content}
                </Text>
              </View>

              {proposals.length > 0 ? (
                <View style={styles.cardWrap}>
                  <DrinkProposalCard messageId={m.id} proposals={proposals} added={m.added} />
                </View>
              ) : null}

              {m.checkoutCard ? (
                <View style={styles.cardWrap}>
                  <CheckoutCard />
                </View>
              ) : null}

              {m.suggestions?.length ? (
                <View style={styles.suggestions}>
                  {m.suggestions.map((s) => (
                    <Pressable
                      key={s.itemId}
                      onPress={() => openItemSheet(s.itemId, s.categorySlug)}
                      style={({ pressed }) => [styles.suggestionChip, pressed && styles.pressed]}
                    >
                      <Text style={styles.suggestionText}>{s.itemName}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )
        })}

        {isThinking ? <Text style={styles.hint}>{t.thinking}</Text> : null}
      </BottomSheetScrollView>

      <View style={styles.inputRow}>
        <BottomSheetTextInput
          value={draft}
          onChangeText={setDraft}
          maxLength={MAX_CHARS}
          placeholder={t.inputPlaceholder}
          placeholderTextColor={T.ink4}
          style={styles.input}
          onSubmitEditing={() => void send()}
          returnKeyType="send"
        />
        <Pressable
          onPress={() => void send()}
          disabled={isThinking || draft.trim().length === 0}
          accessibilityLabel={t.send}
          style={({ pressed }) => [
            styles.sendBtn,
            (isThinking || draft.trim().length === 0) && styles.sendBtnDisabled,
            pressed && styles.pressed,
          ]}
        >
          <SendIcon />
        </Pressable>
      </View>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: T.paper,
    borderTopLeftRadius: RADIUS.sheetTop,
    borderTopRightRadius: RADIUS.sheetTop,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.ink4,
    marginTop: 8,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  title: { fontFamily: 'ShantellSans_700Bold', fontSize: 15, color: T.ink },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  list: { flex: 1 },
  listContent: { padding: 16, gap: 12 },
  hint: { fontFamily: 'ShantellSans_400Regular', fontSize: 13, color: T.ink3, lineHeight: 19 },
  messageRow: { width: '100%' },
  rowUser: { alignItems: 'flex-end' },
  rowBot: { alignItems: 'flex-start' },
  bubble: { maxWidth: '88%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUser: { backgroundColor: PIN.chip },
  bubbleBot: { backgroundColor: T.cream },
  bubbleUserText: { fontFamily: 'ShantellSans_400Regular', fontSize: 14, color: PIN.onChip },
  bubbleBotText: { fontFamily: 'ShantellSans_400Regular', fontSize: 14, color: '#2A1E14' },
  cardWrap: { marginTop: 8, width: '92%' },
  suggestions: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  suggestionText: { fontFamily: 'ShantellSans_400Regular', fontSize: 13, color: T.ink },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: T.line,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 15,
    color: T.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.5 },
})
