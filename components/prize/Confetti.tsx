import { useEffect } from 'react'
import { Dimensions, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

const COLORS = ['#C43A10', '#F5E6C8', '#F4B41A', '#E07A5F', '#8FBF9F']
const COUNT = 40
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window')

interface Particle {
  startX: number
  delay: number
  duration: number
  rotateEnd: number
  color: string
  size: number
}

const PARTICLES: Particle[] = Array.from({ length: COUNT }).map((_, i) => ({
  startX: Math.random() * SCREEN_W,
  delay: Math.random() * 600,
  duration: 1800 + Math.random() * 1200,
  rotateEnd: 360 + Math.random() * 720,
  color: COLORS[i % COLORS.length]!,
  size: 6 + Math.random() * 8,
}))

function Piece({ p }: { p: Particle }) {
  const fall = useSharedValue(0)
  const rot = useSharedValue(0)

  useEffect(() => {
    fall.value = withDelay(
      p.delay,
      withTiming(1, { duration: p.duration, easing: Easing.out(Easing.cubic) }),
    )
    rot.value = withRepeat(
      withTiming(p.rotateEnd, { duration: p.duration, easing: Easing.linear }),
      -1,
      false,
    )
  }, [fall, rot, p.delay, p.duration, p.rotateEnd])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: fall.value * SCREEN_H * 1.1 },
      { translateX: Math.sin(fall.value * Math.PI * 2) * 20 },
      { rotate: `${rot.value}deg` },
    ],
    opacity: fall.value < 0.9 ? 1 : 1 - (fall.value - 0.9) * 10,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -20,
          left: p.startX,
          width: p.size,
          height: p.size * 1.4,
          backgroundColor: p.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  )
}

export function Confetti() {
  return (
    <View pointerEvents="none" style={absoluteFill}>
      {PARTICLES.map((p, i) => (
        <Piece key={i} p={p} />
      ))}
    </View>
  )
}

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 100,
}
