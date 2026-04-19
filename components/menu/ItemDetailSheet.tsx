import { useCallback, useEffect, useMemo, useRef } from 'react'
import { View, Pressable, Share, StyleSheet } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useItemSheetStore } from '@/store/itemSheet'
import { Icon } from '@/components/brand/Icon'
import { T, RADIUS } from '@/constants/theme'
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
      enableDynamicSizing={false}
      enablePanDownToClose
      onChange={onChange}
      backdropComponent={renderBackdrop}
      handleComponent={null}
      backgroundStyle={styles.sheetBg}
    >
      <View style={styles.dragHandle} />
      <View style={styles.header}>
        <Pressable
          onPress={handleShare}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Icon name="share" color={T.ink} size={20} />
        </Pressable>
        <Pressable
          onPress={close}
          hitSlop={8}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.iconBtnPressed]}
        >
          <Icon name="close" color={T.ink} size={22} />
        </Pressable>
      </View>
      {itemId ? (
        <ItemDetailContent itemId={itemId} ScrollComponent={BottomSheetScrollView} />
      ) : null}
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheetBg: {
    backgroundColor: T.paper,
    borderTopLeftRadius: RADIUS.sheetTop,
    borderTopRightRadius: RADIUS.sheetTop,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.ink4,
    marginTop: 8,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  iconBtnPressed: {
    opacity: 0.6,
  },
})
