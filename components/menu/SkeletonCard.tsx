import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'

const CARD_WIDTH = 140

export function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    )
    animation.start()
    return () => animation.stop()
  }, [opacity])

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.image, { opacity }]} />
      <Animated.View style={[styles.nameLine, { opacity }]} />
      <Animated.View style={[styles.priceLine, { opacity }]} />
      <Animated.View style={[styles.button, { opacity }]} />
    </View>
  )
}

export function SkeletonSection() {
  return (
    <View style={styles.section}>
      <Animated.View style={styles.titleLine} />
      <View style={styles.strip}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  titleLine: {
    width: 120,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginLeft: 16,
    marginBottom: 10,
  },
  strip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_WIDTH,
    marginRight: 12,
    gap: 6,
  },
  image: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 10,
    backgroundColor: '#e0e0e0',
  },
  nameLine: {
    width: 100,
    height: 13,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
  },
  priceLine: {
    width: 50,
    height: 13,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  button: {
    width: CARD_WIDTH,
    height: 30,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    marginTop: 4,
  },
})
