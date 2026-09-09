import { useState } from 'react'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { ItemDetailContent } from '@/components/menu/ItemDetailContent'
import { useCartStore } from '@/store/cart'
import { TOP10_CATEGORY_SLUG, isTop10DisplayName } from '@/lib/menu/top10-presets'

export default function ItemDetailScreen() {
  // ?edit=<lineId>: pushed by the checkout page to re-customise one of its
  // lines. The form opens pre-filled and "Update cart" swaps the line.
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>()
  const navigation = useNavigation()
  // The bag keeps the drink, not the category it was picked from — and the
  // category matters: a TOP 10 line carries locked toppings and a display
  // name. Read once: the line changes only when this screen saves it, and
  // that must not re-fetch the drink underneath the exit beat.
  const [categorySlug] = useState(() => {
    if (!edit) return undefined
    const line = useCartStore.getState().items.find((i) => i.lineId === edit)
    return line && isTop10DisplayName(line.name) ? TOP10_CATEGORY_SLUG : undefined
  })

  return (
    <ItemDetailContent
      itemId={id}
      categorySlug={categorySlug}
      editLineId={edit || undefined}
      onLoaded={(item) => {
        navigation.setOptions({ title: item.itemData?.name ?? '' })
      }}
      // Same back-or-fall-back the header button uses (app/_layout.tsx): this
      // screen is also the first route of a cold launch off a shared link, so
      // "the previous page" has to mean the menu when there is no history.
      // From an edit, back is the checkout page the line came from.
      onAdded={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/menu'))}
    />
  )
}
