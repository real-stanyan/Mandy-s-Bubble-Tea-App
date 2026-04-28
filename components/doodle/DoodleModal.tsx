// components/doodle/DoodleModal.tsx
import { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import { DoodleCanvas } from './DoodleCanvas'
import type { DoodleSlot, SvgPath } from '@/lib/doodle/cartToSlots'
import { POOL } from '@/lib/doodle/pool'
import { T, FONT, RADIUS } from '@/constants/theme'

interface Props {
  visible: boolean
  slots: DoodleSlot[]
  initialIndex: number
  onClose: () => void
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

const BRUSHES = [3, 6, 10] as const

export function DoodleModal({ visible, slots, initialIndex, onClose, onSlotChange }: Props) {
  const insets = useSafeAreaInsets()
  const [idx, setIdx] = useState(initialIndex)
  const [brush, setBrush] = useState<(typeof BRUSHES)[number]>(6)
  const [scrollEnabled, setScrollEnabled] = useState(true)

  if (slots.length === 0) return null
  const safeIdx = Math.min(Math.max(idx, 0), slots.length - 1)
  const slot = slots[safeIdx]
  const paths = slot.userPaths ?? []

  const setPaths = (next: SvgPath[]) => {
    onSlotChange(safeIdx, { ...slot, userPaths: next })
  }

  const handleUndo = () => setPaths(paths.slice(0, -1))
  const handleClear = () => setPaths([])
  const handlePickPreset = (key: string) =>
    onSlotChange(safeIdx, { ...slot, userPaths: null, defaultKey: key })
  const handleDone = () => onClose()
  const isDrawing = paths.length > 0

  const goPrev = () => setIdx(Math.max(0, safeIdx - 1))
  const goNext = () => setIdx(Math.min(slots.length - 1, safeIdx + 1))

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topbar}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Cup {safeIdx + 1} / {slots.length}</Text>
            <Text style={styles.title} numberOfLines={1}>{slot.drinkName}</Text>
          </View>
          <Pressable onPress={handleDone} hitSlop={10} style={[styles.iconBtn, styles.doneBtn]}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          scrollEnabled={scrollEnabled}
        >
          <DoodleCanvas
            paths={paths}
            brushWidth={brush}
            onPathsChange={setPaths}
            onDrawStart={() => setScrollEnabled(false)}
            onDrawEnd={() => setScrollEnabled(true)}
          />

          <View style={styles.tools}>
            {BRUSHES.map(w => {
              const active = w === brush
              return (
                <Pressable
                  key={w}
                  onPress={() => setBrush(w)}
                  style={[styles.brush, active && styles.brushActive]}
                >
                  <View style={[styles.brushDot, { width: w * 1.6, height: w * 1.6 }]} />
                </Pressable>
              )
            })}
            <View style={styles.toolDivider} />
            <Pressable onPress={handleUndo} style={styles.toolBtn}>
              <Text style={styles.toolBtnText}>Undo</Text>
            </Pressable>
            <Pressable onPress={handleClear} style={styles.toolBtn}>
              <Text style={styles.toolBtnText}>Clear</Text>
            </Pressable>
          </View>

          <Text style={styles.presetHeader}>
            Or pick a preset {isDrawing ? '(replaces your drawing)' : ''}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetRow}
          >
            {POOL.map(item => {
              const active = !isDrawing && slot.defaultKey === item.key
              return (
                <Pressable
                  key={item.key}
                  onPress={() => handlePickPreset(item.key)}
                  style={[styles.presetTile, active && styles.presetTileActive]}
                >
                  <SvgXml xml={item.svg} width="100%" height="100%" />
                </Pressable>
              )
            })}
          </ScrollView>

          <View style={styles.nav}>
            <Pressable
              onPress={goPrev}
              disabled={safeIdx === 0}
              style={[styles.navBtn, safeIdx === 0 && styles.navBtnDisabled]}
            >
              <Text style={styles.navBtnText}>← Prev</Text>
            </Pressable>
            <Pressable
              onPress={goNext}
              disabled={safeIdx === slots.length - 1}
              style={[styles.navBtn, safeIdx === slots.length - 1 && styles.navBtnDisabled]}
            >
              <Text style={styles.navBtnText}>Next →</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.line,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontFamily: FONT.sans, fontSize: 16, color: T.ink },
  doneBtn: { width: 'auto', paddingHorizontal: 14, backgroundColor: T.brand, borderColor: T.brand },
  doneText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: '#fff' },
  eyebrow: {
    fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.4,
    fontWeight: '700', color: T.brand, textTransform: 'uppercase',
  },
  title: {
    fontFamily: FONT.serif, fontSize: 18, fontWeight: '500', color: T.ink, marginTop: 2,
  },
  tools: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, alignItems: 'center',
  },
  brush: {
    width: 44, height: 44, borderRadius: RADIUS.small,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  brushActive: { borderColor: T.brand, backgroundColor: T.paper },
  brushDot: { backgroundColor: '#000', borderRadius: 999 },
  toolDivider: { width: 1, height: 24, backgroundColor: T.line, marginHorizontal: 4 },
  toolBtn: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.small,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  toolBtnText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '600', color: T.ink },
  presetHeader: {
    fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.4,
    fontWeight: '700', color: T.brand, textTransform: 'uppercase',
    marginTop: 18,
  },
  presetRow: {
    flexDirection: 'row', gap: 8, marginTop: 8, paddingRight: 16,
  },
  presetTile: {
    width: 72, height: 72, borderRadius: RADIUS.small,
    backgroundColor: '#fff', borderWidth: 2, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  presetTileActive: {
    borderColor: T.brand, borderWidth: 2.5, backgroundColor: T.paper,
  },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, gap: 12,
  },
  navBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill,
    backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontFamily: FONT.sans, fontSize: 14, fontWeight: '700', color: T.cream },
})
