import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getActivePublicHoliday } from '@/lib/holiday'
import { PH_SURCHARGE } from '@/lib/constants'

// Shown at the top of Home and Menu on QLD public holidays (and Christmas
// Eve from 18:00 Brisbane time) so customers know the online surcharge
// applies before they order. 60s re-check mirrors the web banner so a
// user who sits on the screen across a boundary sees it appear.
export function PublicHolidayBanner() {
  const [ph, setPh] = useState(() => getActivePublicHoliday())

  useEffect(() => {
    const id = setInterval(() => setPh(getActivePublicHoliday()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (!ph) return null

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Today is {ph.name} — a {PH_SURCHARGE.percentage}% public holiday surcharge applies.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#C43A10',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
})
