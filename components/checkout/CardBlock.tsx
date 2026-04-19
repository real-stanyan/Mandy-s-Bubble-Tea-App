import { View, Text, Pressable, StyleSheet } from 'react-native'
import { T, FONT, RADIUS } from '@/constants/theme'

export interface CardBlockProps {
  eyebrow?: string
  title: string
  right?: React.ReactNode
  onEdit?: () => void
  children?: React.ReactNode
}

export function CardBlock({ eyebrow, title, right, onEdit, children }: CardBlockProps) {
  return (
    <View style={styles.card}>
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
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: T.card,
    borderRadius: RADIUS.card,
    borderWidth: 1,
    borderColor: T.line,
    overflow: 'hidden',
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
