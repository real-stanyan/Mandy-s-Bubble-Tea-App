import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { ItemDetailContent } from '@/components/menu/ItemDetailContent'

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const navigation = useNavigation()

  return (
    <ItemDetailContent
      itemId={id}
      onLoaded={(item) => {
        navigation.setOptions({ title: item.itemData?.name ?? '' })
      }}
      // Same back-or-fall-back the header button uses (app/_layout.tsx): this
      // screen is also the first route of a cold launch off a shared link, so
      // "the previous page" has to mean the menu when there is no history.
      onAdded={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/menu'))}
    />
  )
}
