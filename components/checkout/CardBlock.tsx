import { View, Text, Pressable, StyleSheet } from 'react-native'
import { T, FONT, IS_EVENING, RADIUS } from '@/constants/theme'
import { Halo } from '@/components/ui/Halo'
import { Reveal } from '@/components/ui/Reveal'

export interface CardBlockProps {
  eyebrow?: string
  title: string
  right?: React.ReactNode
  onEdit?: () => void
  /** Lit: a warm surface and the dock's light behind the card, for a card
   *  that is an offer rather than a form (Rick, 2026-09-12: the free-drink
   *  card orange, and glowing). The light breathes on the ambient clock and
   *  sleeps while another screen covers this one (components/ui/Halo). */
  lit?: boolean
  children?: React.ReactNode
}

export function CardBlock({ eyebrow, title, right, onEdit, lit = false, children }: CardBlockProps) {
  return (
    // The card clips to its own corners, so its light cannot live on it: the
    // halo goes in the wrapper, behind, at the card's own radius.
    <Reveal style={styles.wrap}>
      {lit ? <Halo kind="cta" radius={RADIUS.card} /> : null}
      <View style={[styles.card, lit && styles.cardLit]}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            {eyebrow ? <Text style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text> : null}
            <Text style={styles.title}>{title}</Text>
          </View>
          {right ?? null}
          {onEdit ? (
            <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={8}>
              <Text style={styles.editText}>Edit</Text>
            </Pressable>
          ) : null}
        </View>
        {children}
      </View>
    </Reveal>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
  },
  // Lit: peach by day on the cream page, a warm dark amber at night, so the
  // ink, the eyebrow and the promo lines keep their contrast on it either
  // way. The light behind it is the dock's.
  cardLit: {
    backgroundColor: IS_EVENING ? '#40301A' : '#FFD8B8',
    borderColor: IS_EVENING ? 'rgba(242,182,74,0.45)' : 'rgba(255,140,70,0.55)',
  },
  header: {
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '700',
    color: T.brand,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    fontFamily: FONT.serif,
    fontSize: 17,
    fontWeight: '500',
    color: T.ink,
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  editBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(141,85,36,0.08)',
  },
  editText: {
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '700',
    color: T.brand,
  },
})
