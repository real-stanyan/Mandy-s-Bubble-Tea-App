import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useCartStore } from '@/store/cart'
import { useCartSheetStore } from '@/store/cartSheet'
import { CartItemRow } from './CartItem'
import { Icon } from '@/components/brand/Icon'
import { formatPrice } from '@/lib/utils'
import { T, FONT, RADIUS } from '@/constants/theme'

export function CartSheet() {
  const open = useCartSheetStore((s) => s.open)
  const hide = useCartSheetStore((s) => s.hide)
  const items = useCartStore((s) => s.items)
  const total = useCartStore((s) => s.total())
  const clearCart = useCartStore((s) => s.clearCart)
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const ref = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['75%'], [])

  useEffect(() => {
    if (open) ref.current?.present()
    else ref.current?.dismiss()
  }, [open])

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

  const count = items.reduce((s, i) => s + i.quantity, 0)
  const disabled = items.length === 0

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>YOUR CART</Text>
          <Text style={styles.title}>
            {count} {count === 1 ? 'item' : 'items'}
          </Text>
        </View>
        {items.length > 0 ? (
          <TouchableOpacity onPress={clearCart} hitSlop={8} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {items.map((item) => (
          <CartItemRow key={item.lineId} item={item} />
        ))}

        {items.length > 0 ? (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
        ) : null}
      </BottomSheetScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <TouchableOpacity style={styles.keepBtn} onPress={hide} activeOpacity={0.8}>
          <Text style={styles.keepText}>Keep browsing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.checkoutBtn, disabled && styles.checkoutBtnDisabled]}
          onPress={handleCheckout}
          disabled={disabled}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>Checkout</Text>
          <Icon name="arrow" size={14} color={T.cream} />
        </TouchableOpacity>
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
  sheetHandle: {
    backgroundColor: T.ink4,
    width: 40,
    height: 4,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  eyebrow: {
    fontFamily: FONT.mono,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: T.brand,
  },
  title: {
    marginTop: 4,
    fontFamily: FONT.serif,
    fontSize: 26,
    fontWeight: '500',
    letterSpacing: -0.6,
    color: T.ink,
    lineHeight: 29,
  },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearText: {
    fontFamily: FONT.sans,
    fontSize: 12,
    fontWeight: '600',
    color: T.ink3,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
  },
  totalRow: {
    marginTop: 8,
    marginHorizontal: -8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: T.line,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontFamily: FONT.mono,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: T.ink3,
  },
  totalValue: {
    fontFamily: FONT.mono,
    fontSize: 22,
    fontWeight: '700',
    color: T.ink,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: T.paper,
  },
  keepBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: T.line,
  },
  keepText: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '600',
    color: T.ink2,
  },
  checkoutBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.pill,
    backgroundColor: T.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  checkoutBtnDisabled: {
    backgroundColor: T.ink4,
  },
  checkoutText: {
    fontFamily: FONT.sans,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: T.cream,
  },
})
