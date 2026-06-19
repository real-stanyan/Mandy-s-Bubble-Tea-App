// components/doodle/DoodleModal.tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Image as RNImage } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SvgXml } from 'react-native-svg'
import { Image } from 'expo-image'
import { DoodleCanvas } from './DoodleCanvas'
import { submitAiCupLabel } from '@/lib/doodle/aiGenerate'
import { useCartStore } from '@/store/cart'
import { pickAndUploadImage, pickImageBase64 } from '@/lib/doodle/uploadImage'
import type { DoodleSlot } from '@/lib/doodle/cartToSlots'
import type { SvgPath } from '@/lib/doodle/types'
import { GALLERY_HASHES, GALLERY_MANIFEST } from '@/lib/doodle/gallery-manifest.generated'
import { fetchGallery, presetImageSource } from '@/lib/doodle/gallery-remote'
import type { RemotePreset } from '@/lib/doodle/gallery-remote'
import { T, FONT, RADIUS } from '@/constants/theme'

interface Props {
  visible: boolean
  slots: DoodleSlot[]
  initialIndex: number
  onClose: () => void
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

const BRUSHES = [3, 6, 10] as const

type Tab = 'preset' | 'draw' | 'ai' | 'photo'

const TABS: Array<{ key: Tab; label: string; emoji: string }> = [
  { key: 'preset', label: 'Preset', emoji: '🎨' },
  { key: 'draw', label: 'Draw', emoji: '✏️' },
  { key: 'ai', label: 'AI', emoji: '✨' },
  { key: 'photo', label: 'Photo', emoji: '📷' },
]

/** Which mode's result the cup will actually print, derived from selection
 *  union. `null` selection (surprise) has no active mode — defaults the
 *  *view* to the gallery tab but no tab is marked active. */
function activeModeFor(slot: DoodleSlot): Tab {
  const s = slot.selection
  if (s === null) return 'preset'
  if (s.kind === 'ai') return 'ai'
  if (s.kind === 'photo') return 'photo'
  if (s.kind === 'draw') return 'draw'
  return 'preset'
}

function activeSummary(slot: DoodleSlot, active: Tab): string {
  // No pick yet → prints a random surprise tarot card.
  if (slot.selection === null) return '🔮 Random tarot card'
  if (active === 'ai') {
    const s = slot.selection
    const prompt = s.kind === 'ai' ? s.prompt : ''
    const p = prompt.slice(0, 32)
    return `✨ AI · ${p}${prompt.length > 32 ? '…' : ''}`
  }
  if (active === 'photo') return '📷 Your photo'
  if (active === 'draw') return '✏️ Your drawing'
  const s = slot.selection
  const hash = s.kind === 'preset' ? s.hash : ''
  return `🎨 ${hash.slice(0, 8)}`
}

export function DoodleModal({ visible, slots, initialIndex, onClose, onSlotChange }: Props) {
  const insets = useSafeAreaInsets()
  const [idx, setIdx] = useState(initialIndex)

  // Sync `idx` to `initialIndex` each time the modal opens. Without this
  // the state sticks to whatever cup was last viewed, so tapping Cup 1
  // after navigating Prev/Next inside the modal jumps to the stale index.
  useEffect(() => {
    if (visible) setIdx(initialIndex)
  }, [visible, initialIndex])
  const [brush, setBrush] = useState<(typeof BRUSHES)[number]>(6)
  const [scrollEnabled, setScrollEnabled] = useState(true)

  // AI + upload local UI state. Prompt draft mirrors slot.selection.prompt and
  // resets on cup-nav so each cup feels independent.
  const [promptDraft, setPromptDraft] = useState<string>('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // AI source image local URI — transient UI state (not persisted in cart selection)
  const [aiSourceLocalUri, setAiSourceLocalUri] = useState<string | null>(null)
  const [aiSourceDataUri, setAiSourceDataUri] = useState<string | null>(null)

  // Which tab the user is *viewing* — independent of `activeMode` (what
  // the cup will actually print). User action in a tab implicitly
  // promotes that tab to active; switching tabs without acting only
  // changes the view, not the active mode.
  const [viewTab, setViewTab] = useState<Tab>('preset')

  // Remote gallery: merged builtin + uploaded presets fetched at runtime.
  // Falls back to bundled GALLERY_HASHES if fetch fails (offline safe).
  const [remotePresets, setRemotePresets] = useState<RemotePreset[] | null>(null)
  useEffect(() => {
    if (!visible) return
    fetchGallery().then((presets) => {
      if (presets.length > 0) setRemotePresets(presets)
    })
  }, [visible])

  // Build the gallery list: if remote fetch succeeded use it; otherwise fall
  // back to the bundled GALLERY_HASHES shaped as RemotePreset objects.
  const galleryPresets: RemotePreset[] = remotePresets ?? GALLERY_HASHES.map((hash) => ({
    hash,
    thumbUrl: '',
    source: 'builtin' as const,
  }))

  if (slots.length === 0) return null
  const safeIdx = Math.min(Math.max(idx, 0), slots.length - 1)
  const slot = slots[safeIdx]!
  const activeMode = useMemo(() => activeModeFor(slot), [slot])
  const isSurprise = slot.selection === null

  // Extract draw paths from selection (draw tab needs them)
  const paths: SvgPath[] =
    slot.selection?.kind === 'draw' ? slot.selection.paths : []

  // Cart store actions
  const setLabel = useCartStore((s) => s.setLabel)
  const clearLabel = useCartStore((s) => s.clearLabel)
  const ensureCartSessionId = useCartStore((s) => s.ensureCartSessionId)

  // When the active slot changes, reset transient UI state and snap the
  // view tab to whatever the cup's currently using.
  useEffect(() => {
    const s = slot.selection
    setPromptDraft(s?.kind === 'ai' ? s.prompt : '')
    setAiError(null)
    setUploadError(null)
    setAiSourceLocalUri(null)
    setAiSourceDataUri(null)
    setViewTab(activeModeFor(slot))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdx])

  const setPaths = (next: SvgPath[]) => {
    setLabel(slot.cupKey, {
      kind: 'draw',
      userDoodleId: slot.selection?.kind === 'draw' ? slot.selection.userDoodleId : null,
      pathCount: next.length,
      paths: next,
    })
    setViewTab('draw')
  }

  const handleUndo = () => setPaths(paths.slice(0, -1))
  const handleClear = () => setPaths([])

  const handlePickPreset = useCallback((hash: string) => {
    setLabel(slot.cupKey, { kind: 'preset', hash })
    // Close picker on select — mirrors UX on other tabs
    onClose()
  }, [setLabel, slot.cupKey, onClose])

  // Drop this cup's pick → it falls back to a random surprise tarot card.
  const handleSurprise = useCallback(() => {
    clearLabel(slot.cupKey)
    onClose()
  }, [clearLabel, slot.cupKey, onClose])

  // Slot-keying must match the server-side enqueue:
  //   `${clientLineId}:${cupIdx}` (see web's lib/cup-label/client-line-id.ts).
  // App's cartToSlots names this `lineId` but it's the same key shape
  // (variationId + "::" + sorted modifierIds.join(",")).
  const slotKey = slot.cupKey

  const handleAiSubmit = async () => {
    const prompt = promptDraft.trim()
    if (prompt.length === 0) return
    setAiGenerating(true)
    setAiError(null)
    // Optimistically write pending AI selection
    setLabel(slot.cupKey, { kind: 'ai', aiDoodleId: null, prompt })
    try {
      const { aiDoodleId } = await submitAiCupLabel({
        slotKey,
        prompt,
        sourceImageBase64: aiSourceDataUri ?? undefined,
        cartSessionId: ensureCartSessionId(),
      })
      setLabel(slot.cupKey, { kind: 'ai', aiDoodleId, prompt })
      // Close the modal so the user can't burn another Doubao call
      // re-submitting. The card now shows the "Surprise on your cup"
      // placeholder; to AI another cup, they re-open the modal on
      // that cup's card.
      onClose()
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI submit failed')
      // Revert optimistic write on failure — back to the prior pick, or
      // the surprise default if the cup was untouched.
      if (slot.selection) setLabel(slot.cupKey, slot.selection)
      else clearLabel(slot.cupKey)
    } finally {
      setAiGenerating(false)
    }
  }

  const handlePickAiSource = async () => {
    setAiError(null)
    try {
      const picked = await pickImageBase64()
      if (!picked) return
      setAiSourceDataUri(picked.dataUri)
      setAiSourceLocalUri(picked.localUri)
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Picking reference image failed')
    }
  }

  const handleClearAiSource = () => {
    setAiSourceDataUri(null)
    setAiSourceLocalUri(null)
  }

  const handlePickPhoto = async () => {
    setUploading(true)
    setUploadError(null)
    try {
      const picked = await pickAndUploadImage()
      if (!picked) return
      setLabel(slot.cupKey, {
        kind: 'photo',
        uploadedDoodleId: picked.uploadedDoodleId,
        previewUrl: picked.previewUrl,
      })
      onClose()
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleUploadClear = () => {
    // Remove the photo → fall back to a random surprise tarot card.
    if (slot.selection?.kind === 'photo') clearLabel(slot.cupKey)
  }

  const handleDone = () => onClose()

  const goPrev = () => setIdx(Math.max(0, safeIdx - 1))
  const goNext = () => setIdx(Math.min(slots.length - 1, safeIdx + 1))

  // Derive photo display values from selection
  const photoUploadedId = slot.selection?.kind === 'photo' ? slot.selection.uploadedDoodleId : null
  const photoPreviewUrl = slot.selection?.kind === 'photo' ? slot.selection.previewUrl : null

  // Derive AI display values from selection
  const aiDoodleId = slot.selection?.kind === 'ai' ? slot.selection.aiDoodleId : null
  const aiPrompt = slot.selection?.kind === 'ai' ? slot.selection.prompt : ''

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

        <View style={styles.activeBar}>
          <Text style={styles.activeBarLabel}>This cup will print:</Text>
          <Text style={styles.activeBarValue} numberOfLines={1}>
            {activeSummary(slot, activeMode)}
          </Text>
        </View>

        <View style={styles.tabBar}>
          {TABS.map(t => {
            const viewing = viewTab === t.key
            const isActive = !isSurprise && activeMode === t.key
            return (
              <Pressable
                key={t.key}
                onPress={() => setViewTab(t.key)}
                style={[
                  styles.tab,
                  viewing && styles.tabViewing,
                  isActive && styles.tabActive,
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    viewing && styles.tabLabelViewing,
                    isActive && styles.tabLabelActive,
                  ]}
                >
                  {t.emoji} {t.label}{isActive ? ' ✓' : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
          scrollEnabled={scrollEnabled}
        >
          {viewTab === 'preset' && (
            <View>
              <Pressable
                onPress={handleSurprise}
                style={[styles.surpriseBtn, isSurprise && styles.surpriseBtnActive]}
              >
                <Text
                  style={[styles.surpriseBtnText, isSurprise && styles.surpriseBtnTextActive]}
                >
                  🔮 Surprise me — random tarot card{isSurprise ? '  ·  current' : ''}
                </Text>
              </Pressable>
              <Text style={styles.sectionHint}>
                Optional — leave it for a surprise, or tap a tile to choose your own.
              </Text>
              <View style={styles.presetGrid}>
                {galleryPresets.map((item) => {
                  const selected = slot.selection?.kind === 'preset' && slot.selection.hash === item.hash
                  return (
                    <Pressable
                      key={item.hash}
                      onPress={() => handlePickPreset(item.hash)}
                      style={[styles.presetTile, selected && styles.presetTileActive]}
                    >
                      <Image
                        source={presetImageSource(item)}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="contain"
                      />
                    </Pressable>
                  )
                })}
              </View>
            </View>
          )}

          {viewTab === 'draw' && (
            <View>
              <Text style={styles.sectionHint}>Draw freely. Switching tabs keeps your sketch.</Text>
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
            </View>
          )}

          {viewTab === 'ai' && (
            <View>
              {aiDoodleId ? (
                // Surprise-mode locked state. Customers see this after
                // submitting — no preview, no regenerate. The image
                // is revealed only when the cup label prints. Quota
                // is enforced server-side (UNIQUE(user_id, slot_key)),
                // so a "Regenerate" button here wouldn't actually
                // re-charge Doubao — but its absence also stops the
                // customer expecting iteration.
                <View style={styles.aiSubmittedCard}>
                  <Text style={styles.aiSubmittedTitle}>✨ Submitted</Text>
                  <Text style={styles.aiSubmittedPrompt} numberOfLines={3}>
                    "{aiPrompt}"
                  </Text>
                  <Text style={styles.aiSubmittedHint}>
                    Surprise on your cup — image generated in the background and revealed when the cup is printed.
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionHint}>
                    Describe what you want. Optionally pin a reference photo. One AI image per cup — image is revealed on the printed cup, no preview.
                  </Text>
                  <TextInput
                    style={styles.aiInput}
                    placeholder="e.g. a sleepy panda holding a boba cup"
                    placeholderTextColor={T.ink2}
                    value={promptDraft}
                    onChangeText={setPromptDraft}
                    editable={!aiGenerating}
                    maxLength={200}
                    multiline
                  />
                  <View style={styles.aiSourceRow}>
                    {aiSourceLocalUri ? (
                      <>
                        <RNImage
                          source={{ uri: aiSourceLocalUri }}
                          style={styles.aiSourceThumb}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.aiSourceLabel}>Reference image</Text>
                          <Text style={styles.aiSourceHint}>AI will reshape this with your prompt</Text>
                        </View>
                        <Pressable onPress={handleClearAiSource} style={styles.aiSourceRemove}>
                          <Text style={styles.aiSourceRemoveText}>✕</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        onPress={handlePickAiSource}
                        disabled={aiGenerating}
                        style={[styles.aiSourceAddBtn, aiGenerating && styles.aiGenBtnDisabled]}
                      >
                        <Text style={styles.aiSourceAddText}>+ Add reference photo (optional)</Text>
                      </Pressable>
                    )}
                  </View>
                  <View style={styles.aiActions}>
                    <Pressable
                      onPress={handleAiSubmit}
                      disabled={aiGenerating || promptDraft.trim().length === 0}
                      style={[
                        styles.aiGenBtn,
                        (aiGenerating || promptDraft.trim().length === 0) && styles.aiGenBtnDisabled,
                      ]}
                    >
                      {aiGenerating ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.aiGenBtnText}>Submit</Text>
                      )}
                    </Pressable>
                  </View>
                  {aiError && <Text style={styles.aiError}>{aiError}</Text>}
                </>
              )}
            </View>
          )}

          {viewTab === 'photo' && (
            <View>
              <Text style={styles.sectionHint}>Pick a photo. It will be auto-cropped to a square and dithered for print.</Text>
              <Pressable
                onPress={handlePickPhoto}
                disabled={uploading}
                style={[styles.aiGenBtn, uploading && styles.aiGenBtnDisabled]}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.aiGenBtnText}>
                    {photoUploadedId ? 'Pick another photo' : 'Pick from library'}
                  </Text>
                )}
              </Pressable>
              {uploadError && <Text style={styles.aiError}>{uploadError}</Text>}
              {photoPreviewUrl && (
                <View style={styles.aiPreviewWrap}>
                  <RNImage
                    source={{ uri: photoPreviewUrl }}
                    style={styles.aiPreviewImg}
                    resizeMode="contain"
                  />
                  <Pressable
                    onPress={handleUploadClear}
                    style={[styles.aiClearBtn, { marginTop: 12 }]}
                  >
                    <Text style={styles.aiClearBtnText}>Remove</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

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
  activeBar: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: T.paper,
    borderBottomWidth: 1, borderBottomColor: T.line,
  },
  activeBarLabel: {
    fontFamily: FONT.mono, fontSize: 10, letterSpacing: 1.2,
    fontWeight: '700', color: T.ink2, textTransform: 'uppercase',
  },
  activeBarValue: {
    fontFamily: FONT.sans, fontSize: 14, fontWeight: '700', color: T.brand, marginTop: 2,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12, paddingVertical: 10, gap: 6,
    borderBottomWidth: 1, borderBottomColor: T.line,
  },
  tab: {
    flex: 1, paddingVertical: 9, borderRadius: RADIUS.small,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  tabViewing: { borderColor: T.brand, backgroundColor: T.paper },
  tabActive: { backgroundColor: T.brand, borderColor: T.brand },
  tabLabel: {
    fontFamily: FONT.sans, fontSize: 12, fontWeight: '700', color: T.ink2,
  },
  tabLabelViewing: { color: T.brand },
  tabLabelActive: { color: '#fff' },
  sectionHint: {
    fontFamily: FONT.sans, fontSize: 12, color: T.ink2, marginBottom: 12,
  },
  surpriseBtn: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: RADIUS.small,
    borderWidth: 1, borderColor: T.brand, borderStyle: 'dashed',
    backgroundColor: T.card, marginBottom: 12, alignItems: 'center',
  },
  surpriseBtnActive: { backgroundColor: T.paper },
  surpriseBtnText: {
    fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: T.brand,
  },
  surpriseBtnTextActive: { color: T.brand },
  tools: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center',
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
  aiInput: {
    minHeight: 88, padding: 12, borderRadius: RADIUS.small,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    fontFamily: FONT.sans, fontSize: 15, color: T.ink,
    textAlignVertical: 'top',
  },
  aiSourceRow: {
    flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10,
  },
  aiSourceThumb: {
    width: 56, height: 56, borderRadius: RADIUS.small,
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.line,
  },
  aiSourceLabel: { fontFamily: FONT.sans, fontSize: 12, fontWeight: '700', color: T.ink },
  aiSourceHint: { fontFamily: FONT.sans, fontSize: 11, color: T.ink2, marginTop: 1 },
  aiSourceRemove: {
    width: 28, height: 28, borderRadius: 999,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  aiSourceRemoveText: { fontFamily: FONT.sans, fontSize: 12, color: T.ink },
  aiSourceAddBtn: {
    flex: 1, paddingVertical: 11, borderRadius: RADIUS.small,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  aiSourceAddText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '600', color: T.ink },
  aiActions: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  aiGenBtn: {
    flex: 1, paddingVertical: 13, borderRadius: RADIUS.pill,
    backgroundColor: T.brand, alignItems: 'center', justifyContent: 'center',
    minHeight: 44,
  },
  aiGenBtnDisabled: { opacity: 0.35 },
  aiGenBtnText: { fontFamily: FONT.sans, fontSize: 14, fontWeight: '700', color: '#fff' },
  aiClearBtn: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: RADIUS.pill,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: T.line,
  },
  aiClearBtnText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '600', color: T.ink },
  aiError: {
    fontFamily: FONT.sans, fontSize: 12, color: '#B00020', marginTop: 8,
  },
  aiPreviewWrap: { marginTop: 14, alignItems: 'center' },
  aiPreviewImg: {
    width: 240, height: 240, borderRadius: RADIUS.small,
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.line,
  },
  aiSubmittedCard: {
    padding: 20, borderRadius: RADIUS.small,
    backgroundColor: T.paper, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', gap: 12,
  },
  aiSubmittedTitle: {
    fontFamily: FONT.serif, fontSize: 24, fontWeight: '700', color: T.brand,
  },
  aiSubmittedPrompt: {
    fontFamily: FONT.sans, fontSize: 14, fontStyle: 'italic',
    color: T.ink, textAlign: 'center', maxWidth: 280,
  },
  aiSubmittedHint: {
    fontFamily: FONT.sans, fontSize: 12, color: T.ink2,
    textAlign: 'center', maxWidth: 280,
  },
  presetGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  presetTile: {
    width: '23%', aspectRatio: 1, borderRadius: RADIUS.small,
    backgroundColor: '#fff', borderWidth: 2, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', padding: 4,
  },
  presetTileActive: {
    borderColor: T.brand, borderWidth: 2.5, backgroundColor: T.paper,
  },
  nav: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, gap: 12,
  },
  navBtn: {
    flex: 1, paddingVertical: 12, borderRadius: RADIUS.pill,
    backgroundColor: T.ink, alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontFamily: FONT.sans, fontSize: 14, fontWeight: '700', color: T.cream },
})
