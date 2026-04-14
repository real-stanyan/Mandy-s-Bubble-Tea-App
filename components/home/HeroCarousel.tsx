import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { useItemSheetStore } from '@/store/itemSheet'
import { useMenu } from '@/hooks/use-menu'

const SLIDES = [
  { image: require('@/assets/images/carousel/image-298.webp'), name: 'Brown Sugar Milk Tea' },
  { image: require('@/assets/images/carousel/image-299.webp'), name: 'Mango Slushy' },
  { image: require('@/assets/images/carousel/image-297.webp'), name: 'Oreo Brulee Milk Tea' },
  { image: require('@/assets/images/carousel/image-301.webp'), name: 'Lychee Black Tea' },
  { image: require('@/assets/images/carousel/image-302.webp'), name: 'Red Dragon Fruit Slushy' },
  { image: require('@/assets/images/carousel/image-303.webp'), name: 'Taro Milk Tea' },
]

const AUTOPLAY_MS = 5000
const SIDE_PADDING = 16

interface Props {
  height?: number
}

function normalize(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function HeroCarousel({ height }: Props) {
  const { width } = useWindowDimensions()
  const imageWidth = width - SIDE_PADDING * 2
  const slideHeight = height ?? imageWidth
  const listRef = useRef<FlatList>(null)
  const [index, setIndex] = useState(0)
  const { items } = useMenu()

  const nameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      const n = item.itemData?.name
      if (n) map.set(normalize(n), item.id)
    }
    return map
  }, [items])

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((prev) => {
        const next = (prev + 1) % SLIDES.length
        listRef.current?.scrollToIndex({ index: next, animated: true })
        return next
      })
    }, AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [])

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width)
    setIndex(i)
  }

  const handlePress = (name: string) => {
    const id = nameToId.get(normalize(name))
    if (id) useItemSheetStore.getState().open(id)
  }

  return (
    <View style={{ width, height: slideHeight }}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View
            style={{
              width,
              height: slideHeight,
              paddingHorizontal: SIDE_PADDING,
            }}
          >
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handlePress(item.name)}
            >
              <Image
                source={item.image}
                style={{
                  width: imageWidth,
                  height: slideHeight,
                  borderRadius: 16,
                }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          </View>
        )}
      />
      <View style={styles.dots} pointerEvents="none">
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  dots: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#fff',
  },
})
