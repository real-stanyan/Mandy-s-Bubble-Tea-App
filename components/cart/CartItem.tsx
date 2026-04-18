import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { Ionicons } from '@expo/vector-icons'
import { formatPrice } from '@/lib/utils'
import { useCartStore } from '@/store/cart'
import type { CartItem as CartItemType, CartModifier } from '@/types/square'

interface Props {
  item: CartItemType
}

function groupModifiers(mods: CartModifier[]): Array<{ listName: string; names: string[] }> {
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
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.image, styles.placeholder]}>
          <Text style={{ fontSize: 24 }}>🧋</Text>
        </View>
      )}
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
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => updateQuantity(item.lineId, item.quantity - 1)}
          style={styles.qtyBtn}
        >
          <Ionicons name="remove-circle-outline" size={28} color="#666" />
        </TouchableOpacity>
        <Text style={styles.qty}>{item.quantity}</Text>
        <TouchableOpacity
          onPress={() => updateQuantity(item.lineId, item.quantity + 1)}
          style={styles.qtyBtn}
        >
          <Ionicons name="add-circle-outline" size={28} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  image: { width: 60, height: 60, borderRadius: 8 },
  placeholder: {
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '500' },
  modifier: { fontSize: 12, color: '#666', lineHeight: 16 },
  modifierLabel: { color: '#999', fontWeight: '600' },
  price: { fontSize: 14, fontWeight: '500', color: '#333', marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  qtyBtn: { padding: 4 },
  qty: { fontSize: 18, fontWeight: '600', minWidth: 24, textAlign: 'center' },
})
