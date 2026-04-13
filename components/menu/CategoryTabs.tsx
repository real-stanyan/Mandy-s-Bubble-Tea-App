import { useRef } from 'react'
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native'
import { BRAND } from '@/lib/constants'

interface Props {
  categories: { id: string; name: string }[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CategoryTabs({ categories, selectedId, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null)

  return (
    <View style={styles.wrapper}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        {categories.map((cat) => {
          const active = cat.id === selectedId
          return (
            <TouchableOpacity
              key={cat.id}
              onPress={() => onSelect(cat.id)}
              style={[styles.tab, active && styles.activeTab]}
            >
              <Text style={[styles.tabText, active && styles.activeTabText]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTab: {
    backgroundColor: BRAND.color,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
})
