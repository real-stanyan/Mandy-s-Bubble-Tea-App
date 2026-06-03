import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

export function FreshnessBar({
  hasDriver, locationUpdatedAt,
}: { hasDriver: boolean; locationUpdatedAt: string | null }) {
  const [, force] = useState(0)
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 10000)
    return () => clearInterval(id)
  }, [])

  let label: string
  if (!hasDriver || !locationUpdatedAt) {
    label = 'Waiting for driver location…'
  } else {
    const ageSec = Math.max(0, Math.round((Date.now() - new Date(locationUpdatedAt).getTime()) / 1000))
    if (ageSec < 15) label = 'Live · driver on the way'
    else if (ageSec < 60) label = `Updated ${ageSec}s ago`
    else label = `Updated ${Math.round(ageSec / 60)}m ago`
  }
  return (
    <View style={styles.bar}>
      <View style={[styles.dot, { backgroundColor: hasDriver ? '#5B7A52' : '#C9A227' }]} />
      <Text style={styles.text}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600', color: '#3F3F46' },
})
