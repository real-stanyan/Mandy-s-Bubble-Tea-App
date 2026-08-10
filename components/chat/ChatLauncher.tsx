import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { usePathname } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import { T, IS_EVENING } from '@/constants/theme'
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

  // Clears the tab bar (which already accounts for insets.bottom).
  const bottom = 88 + insets.bottom

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
