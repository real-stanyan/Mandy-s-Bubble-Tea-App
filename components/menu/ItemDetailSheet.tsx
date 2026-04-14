import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, TouchableOpacity, Share, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useItemSheetStore } from '@/store/itemSheet'
import { ItemDetailContent } from './ItemDetailContent'

export function ItemDetailSheet() {
  const itemId = useItemSheetStore((s) => s.itemId)
  const close = useItemSheetStore((s) => s.close)
  const ref = useRef<BottomSheetModal>(null)
  const snapPoints = useMemo(() => ['90%'], [])

  useEffect(() => {
    if (itemId) ref.current?.present()
    else ref.current?.dismiss()
  }, [itemId])

  const onChange = useCallback(
    (index: number) => {
      if (index === -1) close()
    },
    [close],
  )

  const handleShare = useCallback(() => {
    if (!itemId) return
    const url = `https://mandybubbletea.com/menu/${itemId}`
    Share.share({ message: url, url })
  }, [itemId])

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
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleShare} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={22} color="#11181C" />
        </TouchableOpacity>
        <TouchableOpacity onPress={close} hitSlop={12} style={styles.iconBtn}>
          <Ionicons name="close" size={24} color="#11181C" />
        </TouchableOpacity>
      </View>
      {itemId ? (
        <ItemDetailContent itemId={itemId} ScrollComponent={BottomSheetScrollView} />
      ) : null}
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0',
  },
})
