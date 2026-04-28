import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { API_BASE } from '@/lib/api'
import { T, TYPE, RADIUS } from '@/constants/theme'

type Status =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'eligible' }
  | { kind: 'window_closed' }
  | { kind: 'already_reported'; at: string }

type Props = {
  orderId: string
  pickupNumber: string
  orderState: string | null
}

export function OrderComplaintSection({
  orderId,
  pickupNumber,
  orderState,
}: Props) {
  const { profile } = useAuth()
  const router = useRouter()
  const [status, setStatus] = useState<Status>({ kind: 'loading' })
  const [showToast, setShowToast] = useState(false)

  const visible = profile != null && orderState === 'COMPLETED'

  const refetch = useCallback(async () => {
    if (!visible) {
      setStatus({ kind: 'hidden' })
      return
    }
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setStatus({ kind: 'hidden' })
        return
      }
      const res = await fetch(
        `${API_BASE}/api/orders/${orderId}/complaint-status`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
      if (!res.ok) {
        // 401/404 are expected (token expired / order disappeared) — don't log noise.
        // Surface anything else so dev/staging logs catch silent regressions.
        if (res.status !== 401 && res.status !== 404) {
          console.error(`[OrderComplaintSection] complaint-status ${res.status}`)
        }
        setStatus({ kind: 'hidden' })
        return
      }
      const json = (await res.json()) as {
        reason?: string
        alreadyReportedAt?: string
      }
      if (json.reason === 'eligible') {
        setStatus({ kind: 'eligible' })
      } else if (json.reason === 'window_closed') {
        setStatus({ kind: 'window_closed' })
      } else if (json.reason === 'already_reported') {
        setStatus((prev) => {
          if (prev.kind === 'eligible') setShowToast(true)
          return {
            kind: 'already_reported',
            at: json.alreadyReportedAt ?? new Date().toISOString(),
          }
        })
      } else {
        setStatus({ kind: 'hidden' })
      }
    } catch {
      setStatus({ kind: 'hidden' })
    }
  }, [visible, orderId])

  useFocusEffect(
    useCallback(() => {
      refetch()
    }, [refetch]),
  )

  if (!visible || status.kind === 'hidden') return null

  if (status.kind === 'loading') {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>Checking…</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Need help with this order?</Text>
      <Text style={styles.sub}>Tell us what went wrong.</Text>
      <View style={styles.buttonRow}>
        {status.kind === 'eligible' && (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() =>
              router.push({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                pathname: '/order-complaint' as any,
                params: { orderId, pickupNumber },
              })
            }
          >
            <Text style={styles.buttonText}>Report a problem</Text>
          </Pressable>
        )}
        {status.kind === 'window_closed' && (
          <View style={[styles.button, styles.buttonDisabled]}>
            <Text style={styles.buttonTextDisabled}>
              Complaint window closed
            </Text>
          </View>
        )}
        {status.kind === 'already_reported' && (
          <View style={[styles.button, styles.buttonDisabled]}>
            <Text style={styles.buttonTextDisabled}>
              Reported on {formatReportedDate(status.at)}
            </Text>
          </View>
        )}
      </View>
      {showToast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>
            Thanks — we'll be in touch within 24 hours.
          </Text>
        </View>
      )}
    </View>
  )
}

function formatReportedDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    width: '100%',
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.card,
    padding: 16,
  },
  heading: { ...TYPE.bodyStrong, fontSize: 16, color: T.ink },
  sub: { ...TYPE.body, fontSize: 13, color: T.ink2, marginTop: 4 },
  muted: { ...TYPE.body, fontSize: 13, color: T.ink3 },
  buttonRow: { marginTop: 12, flexDirection: 'row' },
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: T.brand,
    borderRadius: RADIUS.tile,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: T.paper,
  },
  buttonPressed: { opacity: 0.8 },
  buttonText: { ...TYPE.bodyStrong, fontSize: 14, color: T.brand },
  buttonDisabled: { borderColor: T.line, backgroundColor: T.bg2 },
  buttonTextDisabled: { ...TYPE.body, fontSize: 14, color: T.ink3 },
  toast: {
    marginTop: 12,
    backgroundColor: '#dcfce7',
    borderRadius: RADIUS.tile,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  toastText: { ...TYPE.body, fontSize: 13, color: '#15803d' },
})
