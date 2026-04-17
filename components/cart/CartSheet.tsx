import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { formatPrice } from '@/lib/utils'
import { CartItemRow } from './CartItem'
import { BRAND } from '@/lib/constants'

export function CartSheet() {
  const open = useCartSheetStore((s) => s.open)
  const hide = useCartSheetStore((s) => s.hide)
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()

  const ref = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['75%'], [])

  useEffect(() => {
    if (open) ref.current?.present()
    else ref.current?.dismiss()
  }, [open])

  // Auto-close when cart becomes empty
  useEffect(() => {
    if (open && items.length === 0) hide()
  }, [items.length, open, hide])

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) hide()
    },
    [hide],
  )

  const handleCheckout = useCallback(() => {
    hide()
    router.push('/checkout')
  }, [hide, router])

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

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Cart</Text>
        {items.length > 0 ? (
          <TouchableOpacity onPress={clearCart} hitSlop={8} style={styles.clearBtn}>
            <Ionicons name="trash-outline" size={16} color="#8a8076" />
            <Text style={styles.clearText}>Clear all</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((item) => (
          <CartItemRow key={item.lineId} item={item} />
        ))}
      </BottomSheetScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
          activeOpacity={0.8}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#11181C' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  clearText: { fontSize: 13, color: '#8a8076' },
  scrollContent: { paddingBottom: 16 },
  bottomBar: {
    padding: 16,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    gap: 12,
    backgroundColor: '#fff',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 16, fontWeight: '600' },
  totalValue: { fontSize: 20, fontWeight: '700', color: BRAND.color },
  checkoutButton: {
    backgroundColor: BRAND.color,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontSize: 17, fontWeight: '600' },
})
