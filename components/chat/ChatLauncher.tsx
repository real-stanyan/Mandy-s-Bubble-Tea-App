import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import { T, IS_EVENING } from '@/constants/theme'
import { useCartStore } from '@/store/cart'
import { useChat } from '@/store/chat'
import { chatUiStrings } from '@/lib/chat/ui-strings'

/** Evening brand is a light gold — white-on-gold is exactly the unreadable
 *  blob Stan screenshotted, so the pill's content flips to day-ink on it.
 *  IS_EVENING is startup-fixed, same contract as T itself. */
const ON_BRAND = IS_EVENING ? '#2A1E14' : '#FFFFFF'

/** Speech bubble with three boba pearls — same glyph as the web launcher. */
function BobaChatIcon({ size = 24 }: { size?: number }) {
  return (
    <Svg viewBox="0 0 24 24" width={size} height={size} fill="none">
      <Path
        d="M12 3.2c-5 0-9 3.4-9 7.6 0 2.1 1 4 2.6 5.4-.2 1.1-.7 2.2-1.6 3 1.5.1 3-.4 4.2-1.2 1.2.4 2.4.6 3.8.6 5 0 9-3.4 9-7.6s-4-7.8-9-7.8Z"
        stroke={ON_BRAND}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <Circle cx={8.4} cy={11} r={1.3} fill={ON_BRAND} />
      <Circle cx={12} cy={11} r={1.3} fill={ON_BRAND} />
      <Circle cx={15.6} cy={11} r={1.3} fill={ON_BRAND} />
    </Svg>
  )
}

/** Screens where a floating chat button would sit on top of a funnel or a
 *  form — mirrors the web's ChatGate. */
const HIDDEN_PREFIXES = ['/checkout', '/order-confirmation']

export function ChatLauncher() {
  const t = chatUiStrings()
  const insets = useSafeAreaInsets()
  const pathname = usePathname() ?? ''
  const isOpen = useChat((s) => s.isOpen)
  const open = useChat((s) => s.open)
  const teaserSeen = useChat((s) => s.teaserSeen)
  const markTeaserSeen = useChat((s) => s.markTeaserSeen)
  // Above the early return — hooks must run on every render path.
  const hasCartBar = useCartStore((s) => s.items.length > 0)
  const [showTeaser, setShowTeaser] = useState(false)

  useEffect(() => {
    if (teaserSeen) return
    // A beat after launch, not instantly — a popup racing first paint
    // reads as an ad and gets reflex-closed.
    const timer = setTimeout(() => {
      const s = useChat.getState()
      if (!s.isOpen && !s.teaserSeen) setShowTeaser(true)
    }, 2200)
    return () => clearTimeout(timer)
  }, [teaserSeen])

  const hidden = HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  if (hidden || isOpen) return null

  const dismissTeaser = () => {
    markTeaserSeen()
    setShowTeaser(false)
  }
  const openChat = () => {
    dismissTeaser()
    open()
  }
  const openVoice = () => {
    dismissTeaser()
    useChat.getState().requestInputFocus()
    open()
  }

  // Clears the tab bar (which already accounts for insets.bottom). With
  // items in the cart, MiniCartBar floats at tabBarHeight+8 (~48px tall) —
  // the launcher hops over it instead of sitting on View Cart (Stan's
  // screenshot, 2026-08-10).
  const bottom = 88 + insets.bottom + (hasCartBar ? 56 : 0)

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {showTeaser ? (
        <View style={[styles.teaser, { bottom: bottom + 68 }]}>
          <Pressable onPress={openChat} style={styles.teaserBody}>
            <Text style={styles.teaserText}>{t.teaser}</Text>
          </Pressable>
          <Pressable onPress={dismissTeaser} hitSlop={8} style={styles.teaserClose}>
            <Text style={styles.teaserCloseText}>✕</Text>
          </Pressable>
          <View style={styles.teaserTail} />
        </View>
      ) : null}

      {/* Stand-alone voice entry — bottom centre, left of Hi Mandy (Stan's
          placement). Today it opens the chat with the keyboard up, whose
          mic key is system dictation; the P3 binary swaps this to native
          speech recognition without moving the button. */}
      <Pressable
        onPress={openVoice}
        accessibilityLabel={t.voiceOrderAria}
        style={({ pressed }) => [styles.voiceFab, { bottom }, pressed && styles.fabPressed]}
      >
        <Svg viewBox="0 0 24 24" width={22} height={22} fill="none">
          <Path
            d="M12 3.5a3 3 0 0 0-3 3V12a3 3 0 0 0 6 0V6.5a3 3 0 0 0-3-3Z"
            stroke={ON_BRAND}
            strokeWidth={1.8}
          />
          <Path
            d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
            stroke={ON_BRAND}
            strokeWidth={1.8}
            strokeLinecap="round"
          />
        </Svg>
        <Text style={styles.fabLabel}>{t.voiceOrder}</Text>
      </Pressable>

      {/* A named pill, not an anonymous circle with an "AI" tag — "Hi
          Mandy!" tells the customer there's someone to talk to (Stan,
          2026-08-10: no AI branding, and the badge was light-on-light in
          evening theme anyway). */}
      <Pressable
        onPress={openChat}
        accessibilityLabel={t.launcherAria}
        style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.fabPressed]}
      >
        <BobaChatIcon />
        <Text style={styles.fabLabel}>{t.launcherLabel}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.brand,
    shadowColor: T.brandDark,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: { transform: [{ scale: 0.95 }] },
  voiceFab: {
    position: 'absolute',
    alignSelf: 'center',
    // Nudged left of true centre — at centre its right edge slid under
    // the Hi Mandy! pill on a 375pt screen (same collision web hit).
    transform: [{ translateX: -36 }],
    height: 52,
    borderRadius: 26,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: T.brand,
    shadowColor: T.brandDark,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabLabel: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 14,
    color: ON_BRAND,
  },
  teaser: {
    position: 'absolute',
    right: 16,
    width: 250,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: T.line,
    backgroundColor: T.card,
    padding: 12,
    paddingRight: 30,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  teaserBody: {},
  teaserText: {
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 13,
    lineHeight: 18,
    color: T.ink,
  },
  teaserClose: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teaserCloseText: { fontSize: 12, color: T.ink3 },
  teaserTail: {
    position: 'absolute',
    bottom: -7,
    right: 26,
    width: 14,
    height: 14,
    backgroundColor: T.card,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.line,
    transform: [{ rotate: '45deg' }],
  },
})
