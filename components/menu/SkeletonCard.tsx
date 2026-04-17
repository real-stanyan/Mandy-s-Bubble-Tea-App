import { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'

function usePulse() {
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
  return opacity
}

/** Skeleton for a single product row (image + name + price + add button) */
function SkeletonRow() {
  const opacity = usePulse()
  return (
    <View style={styles.row}>
      <Animated.View style={[styles.rowImage, { opacity }]} />
      <View style={styles.rowInfo}>
        <Animated.View style={[styles.rowName, { opacity }]} />
        <Animated.View style={[styles.rowPrice, { opacity }]} />
      </View>
      <Animated.View style={[styles.addBtn, { opacity }]} />
    </View>
  )
}

/** Skeleton for a category section (title + rows) */
function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.sectionBlock}>
      <Animated.View style={styles.sectionTitle} />
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  )
}

/** Skeleton for a sidebar tab */
function SkeletonTab({ width }: { width: number }) {
  const opacity = usePulse()
  return (
    <View style={styles.tab}>
      <Animated.View style={[styles.tabLine, { width, opacity }]} />
    </View>
  )
}

/** Full-page skeleton matching the new menu layout: sidebar + list */
export function SkeletonSection() {
  return (
    <View style={styles.root}>
      {/* Search bar skeleton */}
      <View style={styles.searchBar}>
        <Animated.View style={styles.searchPlaceholder} />
      </View>

      <View style={styles.body}>
        {/* Left sidebar */}
        <View style={styles.sidebar}>
          <SkeletonTab width={48} />
          <SkeletonTab width={40} />
          <SkeletonTab width={56} />
          <SkeletonTab width={36} />
          <SkeletonTab width={52} />
          <SkeletonTab width={44} />
          <SkeletonTab width={48} />
        </View>

        {/* Right content area */}
        <View style={styles.content}>
          <SkeletonRows count={4} />
          <SkeletonRows count={3} />
          <SkeletonRows count={3} />
        </View>
      </View>
    </View>
  )
}

// Keep the old export name for backwards compat, but it's unused now
export { SkeletonRow as SkeletonCard }

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  searchBar: {
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2E8DF',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  searchPlaceholder: {
    width: 100,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#e0d5ca',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    flex: 1,
    backgroundColor: '#F2E8DF',
    paddingVertical: 8,
  },
  tab: {
    minHeight: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabLine: {
    height: 14,
    borderRadius: 4,
    backgroundColor: '#e0d5ca',
  },
  content: {
    flex: 3,
    paddingBottom: 48,
  },
  sectionBlock: {
    paddingTop: 16,
  },
  sectionTitle: {
    width: 120,
    height: 20,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
    marginLeft: 16,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowImage: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
  },
  rowInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  rowName: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  rowPrice: {
    width: 50,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
  },
})
