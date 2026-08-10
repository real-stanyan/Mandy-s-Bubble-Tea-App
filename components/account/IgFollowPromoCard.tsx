import { memo, useEffect, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Linking from 'expo-linking'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FontAwesome } from '@expo/vector-icons'
import { useAuth } from '@/components/auth/AuthProvider'
import { apiFetch } from '@/lib/api'
import { T, TYPE, RADIUS, SHADOW } from '@/constants/theme'

const IG_URL = 'https://instagram.com/mandysbubbletea'
const VISITED_KEY = 'mbt.igFollowVisited'

export const IgFollowPromoCard = memo(function IgFollowPromoCard() {
  const { igFollowDiscount, claimIgFollowDiscount } = useAuth()
  const router = useRouter()
  const [visited, setVisited] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const inFlightRef = useRef(false)
  const [redeemedAt, setRedeemedAt] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    AsyncStorage.getItem(VISITED_KEY)
      .then((val) => {
        if (val === '1') setVisited(true)
      })
      .catch(() => {
        // Hydration failure leaves visited=false; user re-clicks Step 1.
      })
  }, [])

  // Fetch authoritative redeemedAt from the server. Refetch when
  // igFollowDiscount.available flips (e.g. just consumed at checkout) so
  // the card transitions to Redeemed without a manual reload.
  useEffect(() => {
    let alive = true
    apiFetch<{ ok: boolean; redeemedAt: string | null }>(
      '/api/promotions/ig-follow/status',
    )
      .then((data) => {
        if (alive) setRedeemedAt(data?.redeemedAt ?? null)
      })
      .catch(() => {
        if (alive) setRedeemedAt(null)
      })
    return () => {
      alive = false
    }
  }, [igFollowDiscount.available])

  const handleStep1 = async () => {
    try {
      await Linking.openURL(IG_URL)
    } catch (err) {
      setErrMsg("Couldn't open Instagram. Please follow @mandysbubbletea manually, then tap claim.")
      console.error(err)
    }
    try {
      await AsyncStorage.setItem(VISITED_KEY, '1')
    } catch {
      // Storage failure shouldn't block the in-memory flag.
    }
    setVisited(true)
  }

  const handleClaim = async () => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)
    setErrMsg(null)
    try {
      await claimIgFollowDiscount()
    } catch (err) {
      setErrMsg("Couldn't claim right now. Please try again.")
      console.error(err)
    } finally {
      inFlightRef.current = false
      setBusy(false)
    }
  }

  // ----- Redeemed state -----
  if (redeemedAt && !igFollowDiscount.available) {
    return (
      <View style={styles.wrap}>
        <View style={[styles.card, styles.cardMuted]}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.dot, styles.dotMuted]} />
            <Text style={[TYPE.eyebrow, styles.eyebrowMuted]}>
              IG FOLLOW PROMO · USED
            </Text>
          </View>
          <Text style={[styles.bigNum, styles.bigNumMuted, styles.strikethrough]}>
            10% off
          </Text>
          {/* Pinned: cardMuted's #FAFAFA stays light in evening mode, where
              T.ink3 flips light — same poster-face idiom as CategoriesStrip. */}
          <Text style={[TYPE.body, { color: 'rgba(42,30,20,0.55)', marginTop: 8 }]}>
            Thanks for following @mandysbubbletea!
          </Text>
        </View>
      </View>
    )
  }

  // ----- Active state -----
  if (igFollowDiscount.available) {
    return (
      <View style={styles.wrap}>
        <Pressable
          onPress={() => router.push('/(tabs)/menu')}
          style={({ pressed }) => [
            { borderRadius: RADIUS.card, ...SHADOW.miniCart, shadowColor: T.brandDark },
            pressed && { opacity: 0.95, transform: [{ scale: 0.985 }] },
          ]}
        >
          <LinearGradient
            colors={['#C43A10', '#6B3E15']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{ borderRadius: RADIUS.card, padding: 22, overflow: 'hidden' }}
          >
            <View style={styles.activeTopRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.eyebrowRow}>
                  <View style={[styles.dot, { backgroundColor: T.peach }]} />
                  <Text style={[TYPE.eyebrow, { color: 'rgba(255,255,255,0.7)' }]}>
                    IG FOLLOW REWARD
                  </Text>
                </View>
                <View style={styles.numRow}>
                  <Text style={[styles.bigNum, { color: '#fff' }]}>10%</Text>
                  <Text
                    style={{
                      fontFamily: 'ShantellSans_700Bold',
                      fontSize: 18,
                      color: 'rgba(255,255,255,0.45)',
                      marginLeft: 6,
                    }}
                  >
                    off your next drink
                  </Text>
                </View>
              </View>
              <View style={styles.activePill}>
                <FontAwesome name="check" size={10} color={T.peach} />
                <Text style={styles.activePillText}>Active</Text>
              </View>
            </View>

            <View style={styles.activeBottomRow}>
              <Text style={[TYPE.body, { color: 'rgba(255,255,255,0.85)', flex: 1, paddingRight: 12 }]}>
                Auto-applied to your cheapest drink at checkout.
              </Text>
              <View style={styles.orderNowPill}>
                <Text style={styles.orderNowText}>Order now →</Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>
      </View>
    )
  }

  // Don't render anything until we have a definitive redeemedAt answer.
  // Prevents brief Locked flash before transitioning to Redeemed on real
  // users who already consumed their ticket.
  if (redeemedAt === undefined) return null

  // ----- Locked state -----
  const step2Disabled = !visited || busy
  const step2Label = busy ? 'Claiming…' : 'I followed — claim my 10% off'

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.lockedTopRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.eyebrowRow}>
              <View style={[styles.dot, { backgroundColor: T.brand }]} />
              <Text style={[TYPE.eyebrow, { color: T.ink3 }]}>
                FOLLOW US ON INSTAGRAM
              </Text>
            </View>
            <View style={styles.numRow}>
              <Text style={[styles.bigNum, { color: T.ink }]}>10%</Text>
              <Text
                style={{
                  fontFamily: 'ShantellSans_700Bold',
                  fontSize: 18,
                  color: T.ink4,
                  marginLeft: 6,
                }}
              >
                off your next drink
              </Text>
            </View>
          </View>

          <View style={styles.igIconBox}>
            <LinearGradient
              colors={['#f09433', '#e6683c', '#dc2743', '#cc2366', '#bc1888']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.igIconGradient}
            >
              <FontAwesome name="instagram" size={20} color="#fff" />
            </LinearGradient>
          </View>
        </View>

        <Text style={[TYPE.body, { color: T.ink2, marginTop: 12 }]}>
          Follow @mandysbubbletea, then come back and claim your one-time 10% off code.
        </Text>

        <View style={styles.btnStack}>
          <TouchableOpacity
            style={styles.followBtn}
            onPress={handleStep1}
            activeOpacity={0.88}
          >
            <FontAwesome name="instagram" size={16} color="#fff" />
            <Text style={styles.followBtnText}>Follow on Instagram</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.claimBtn, step2Disabled && styles.claimBtnDisabled]}
            onPress={handleClaim}
            disabled={step2Disabled}
            activeOpacity={0.88}
          >
            <Text style={[styles.claimBtnText, step2Disabled && styles.claimBtnTextDisabled]}>
              {step2Label}
            </Text>
          </TouchableOpacity>
        </View>

        {errMsg ? (
          <Text style={styles.errMsg}>{errMsg}</Text>
        ) : null}
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    padding: 22,
    ...SHADOW.card,
  },
  cardMuted: {
    backgroundColor: '#FAFAFA',
    borderColor: 'rgba(0,0,0,0.05)',
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  dotMuted: {
    backgroundColor: '#A1A1AA',
  },
  eyebrowMuted: {
    color: '#A1A1AA',
  },
  bigNum: {
    fontFamily: 'ShantellSans_700Bold',
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -0.8,
  },
  bigNumMuted: {
    color: '#A1A1AA',
    marginTop: 8,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  numRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  lockedTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  igIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    overflow: 'hidden',
    flexShrink: 0,
  },
  igIconGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnStack: {
    flexDirection: 'column',
    gap: 8,
    marginTop: 16,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: T.brand,
    borderRadius: RADIUS.pill,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  followBtnText: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 14,
    color: '#fff',
  },
  claimBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: T.line,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  claimBtnDisabled: {
    opacity: 0.45,
  },
  claimBtnText: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 14,
    color: T.ink,
  },
  claimBtnTextDisabled: {
    color: T.ink3,
  },
  errMsg: {
    fontFamily: 'ShantellSans_400Regular',
    fontSize: 13,
    color: '#DC2626',
    marginTop: 8,
  },
  activeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  activePillText: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 11,
    color: '#fff',
  },
  activeBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  orderNowPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    backgroundColor: T.peach,
  },
  orderNowText: {
    fontFamily: 'ShantellSans_500Medium',
    fontSize: 12.5,
    color: T.brandDark,
  },
})
