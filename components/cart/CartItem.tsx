import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useCartStore } from '@/store/cart'
import { Icon } from '@/components/brand/Icon'
import { CupArt } from '@/components/brand/CupArt'
import { T, FONT } from '@/constants/theme'
import { formatPrice } from '@/lib/utils'
import type { CartItem as CartItemType, CartModifier } from '@/types/square'

interface Props {
  item: CartItemType
}

function groupModifiers(mods: CartModifier[]): { listName: string; names: string[] }[] {
  const byList = new Map<string, string[]>()
  for (const m of mods) {
    const key = m.listName || 'OTHER'
    const arr = byList.get(key) ?? []
    arr.push(m.name)
    byList.set(key, arr)
  }
  return Array.from(byList.entries()).map(([listName, names]) => ({ listName, names }))
}

function titleCase(s: string): string {
  if (!s) return ''
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function CartItemRow({ item }: Props) {
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const modifierGroups = groupModifiers(item.modifiers ?? [])

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <CupArt size={28} fill={T.brand} stroke={T.ink} />
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.modifier} numberOfLines={1}>
          <Text style={styles.modifierLabel}>Size:</Text> Large 700ml
        </Text>
        {modifierGroups.map((g) => (
          <Text key={g.listName} style={styles.modifier} numberOfLines={2}>
            <Text style={styles.modifierLabel}>{titleCase(g.listName)}:</Text>{' '}
            {g.names.join(', ')}
          </Text>
        ))}
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
      </View>

      <View style={styles.stepper}>
        <TouchableOpacity
          style={styles.stepBtnMinus}
          onPress={() => updateQuantity(item.lineId, item.quantity - 1)}
          activeOpacity={0.7}
        >
          <Text style={styles.minusText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          style={styles.stepBtnPlus}
          onPress={() => updateQuantity(item.lineId, item.quantity + 1)}
          activeOpacity={0.7}
        >
          <Icon name="plus" size={14} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F1EBE4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: FONT.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: T.ink,
    lineHeight: 16,
  },
  modifier: {
    marginTop: 2,
    fontFamily: FONT.sans,
    fontSize: 11,
    color: T.ink3,
    lineHeight: 15,
  },
  modifierLabel: { color: T.ink3, fontWeight: '600' },
  price: {
    marginTop: 2,
    fontFamily: FONT.mono,
    fontSize: 12,
    fontWeight: '600',
    color: T.brand,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(42,30,20,0.05)',
    borderRadius: 999,
    padding: 3,
  },
  stepBtnMinus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPlus: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minusText: {
    fontSize: 16,
    fontWeight: '700',
    color: T.ink2,
    lineHeight: 18,
    includeFontPadding: false,
  },
  qty: {
    minWidth: 14,
    textAlign: 'center',
    fontFamily: FONT.mono,
    fontSize: 13,
    fontWeight: '700',
    color: T.ink,
  },
})
