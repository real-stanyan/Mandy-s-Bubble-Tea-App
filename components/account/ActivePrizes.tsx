import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { fetchActivePrizes, type ActivePrize } from '@/lib/prizes'

export function ActivePrizes() {
  const [prizes, setPrizes] = useState<ActivePrize[] | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const list = await fetchActivePrizes()
        if (!cancelled) setPrizes(list)
      } catch {
        if (!cancelled) setPrizes([])
      }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (!prizes || prizes.length === 0) return null

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Your active prizes</Text>
      {prizes.map((p) => {
        const days = Math.ceil(
          (new Date(p.expires_at).getTime() - Date.now()) / 86_400_000,
        )
        const expiresIn = days <= 0 ? 'today' : `${days}d`
        const isPhysical = p.prize_type === 'physical'
        return (
          <View
            key={p.id}
            style={[
              styles.card,
              isPhysical ? styles.physicalCard : styles.digitalCard,
            ]}
          >
            <Text style={styles.label}>{p.label}</Text>
            {!isPhysical ? (
              <Text style={styles.note}>
                Auto-applies on your next order · expires in {expiresIn}
              </Text>
            ) : (
              <View style={styles.physicalContent}>
                {p.claim_code && (
                  <Text style={styles.code}>{p.claim_code}</Text>
                )}
                {p.claim_code && (
                  <QRCode
                    value={`mandybt-claim:${p.claim_code}`}
                    size={72}
                  />
                )}
                <Text style={styles.note}>
                  Show at the counter · expires in {expiresIn}
                </Text>
              </View>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginVertical: 16, paddingHorizontal: 16 },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  card: { padding: 16, borderRadius: 16, marginBottom: 10 },
  digitalCard: { backgroundColor: '#FFE9D6' },
  physicalCard: { backgroundColor: '#F5E6C8' },
  label: { fontSize: 16, fontWeight: '600', color: '#333' },
  note: { fontSize: 12, color: '#666', marginTop: 6 },
  physicalContent: { marginTop: 8, alignItems: 'flex-start', gap: 8 },
  code: {
    fontFamily: 'Menlo',
    fontSize: 24,
    letterSpacing: 3,
    color: '#333',
  },
})
