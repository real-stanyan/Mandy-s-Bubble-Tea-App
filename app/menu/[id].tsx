import { useLocalSearchParams, useNavigation } from 'expo-router'
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
    />
  )
}
