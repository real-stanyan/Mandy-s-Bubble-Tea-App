// components/doodle/DoodleModal.tsx
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image as RNImage,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { PressScale } from '@/components/ui/PressScale'
import { DoodleCanvas } from './DoodleCanvas'
import { StickerPreview } from './StickerPreview'
import { submitAiCupLabel } from '@/lib/doodle/aiGenerate'
import { useCartStore } from '@/store/cart'
import { useAuth } from '@/components/auth/AuthProvider'
import { pickAndUploadImage, pickImageBase64 } from '@/lib/doodle/uploadImage'
import type { DoodleSlot } from '@/lib/doodle/cartToSlots'
import type { SvgPath } from '@/lib/doodle/types'
import { GALLERY_HASHES } from '@/lib/doodle/gallery-manifest.generated'
import { fetchGallery, presetImageSource } from '@/lib/doodle/gallery-remote'
import type { RemotePreset } from '@/lib/doodle/gallery-remote'
import { T, CTA, FONT, RADIUS, SHADOW, TYPE } from '@/constants/theme'

// The label picker is a small design studio for one cup — the App port of
// the web's LabelPicker (#326): the printed sticker up top, live, and the
// four ways to fill it below. Every source (gallery, drawing, AI, photo)
// feeds the same preview, so "what will my cup look like" is answered
// before anything is committed. Visual language is the checkout's own:
// theme tokens, the card radius, the eyebrow/serif hierarchy.

/** Matches presetTile's 23% width: four across with a gap between. */
const PRESET_COLUMNS = 4
const presetKey = (item: RemotePreset) => item.hash
const AI_PROMPT_MAX = 200

interface Props {
  visible: boolean
  slots: DoodleSlot[]
  initialIndex: number
  onClose: () => void
  onSlotChange: (slotIdx: number, next: DoodleSlot) => void
}

const BRUSHES = [3, 6, 10] as const

type Tab = 'preset' | 'draw' | 'ai' | 'photo'

const TABS: { key: Tab; label: string; glyph: string }[] = [
  { key: 'preset', label: 'Gallery', glyph: '🎨' },
  { key: 'draw', label: 'Draw', glyph: '✏️' },
  { key: 'ai', label: 'AI', glyph: '✨' },
  { key: 'photo', label: 'Photo', glyph: '📷' },
]

/** Which mode's result the cup will actually print, derived from selection
 *  union. `null` selection (surprise) has no active mode — defaults the
 *  *view* to the gallery tab. */
function activeModeFor(slot: DoodleSlot): Tab {
  const s = slot.selection
  if (s === null) return 'preset'
  if (s.kind === 'ai') return 'ai'
  if (s.kind === 'photo') return 'photo'
  if (s.kind === 'draw') return 'draw'
  return 'preset'
}

export function DoodleModal({ visible, slots, initialIndex, onClose, onSlotChange }: Props) {
  const insets = useSafeAreaInsets()
  const { width: screenW } = useWindowDimensions()
  const { profile } = useAuth()
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

  // Which tab the user is *viewing* — independent of what the cup will
  // print. Acting in a tab promotes it; just looking doesn't.
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

  const galleryPresets: RemotePreset[] =
    remotePresets ??
    GALLERY_HASHES.map((hash) => ({ hash, thumbUrl: '', source: 'builtin' as const }))

  const setLabel = useCartStore((s) => s.setLabel)
  const clearLabel = useCartStore((s) => s.clearLabel)
  const ensureCartSessionId = useCartStore((s) => s.ensureCartSessionId)

  // Hooks stay unconditional: an empty cart renders nothing (below), but
  // only after every hook has run in its usual order.
  const safeIdx = slots.length === 0 ? 0 : Math.min(Math.max(idx, 0), slots.length - 1)
  const slot: DoodleSlot | null = slots[safeIdx] ?? null
  const slotCupKey = slot?.cupKey ?? ''

  // When the active slot changes, reset transient UI state and snap the
  // view tab to whatever the cup's currently using.
  useEffect(() => {
    if (!slot) return
    const s = slot.selection
    setPromptDraft(s?.kind === 'ai' ? s.prompt : '')
    setAiError(null)
    setUploadError(null)
    setAiSourceLocalUri(null)
    setAiSourceDataUri(null)
    setViewTab(activeModeFor(slot))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdx])

  const handlePickPreset = useCallback(
    (hash: string) => {
      if (!slotCupKey) return
      setLabel(slotCupKey, { kind: 'preset', hash })
      onClose()
    },
    [setLabel, slotCupKey, onClose],
  )

  // Drop this cup's pick → it falls back to a random surprise design.
  const handleSurprise = useCallback(() => {
    if (!slotCupKey) return
    clearLabel(slotCupKey)
    onClose()
  }, [clearLabel, slotCupKey, onClose])

  if (!slot) return null
  const isSurprise = slot.selection === null
  const paths: SvgPath[] = slot.selection?.kind === 'draw' ? slot.selection.paths : []

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

  // Slot-keying must match the server-side enqueue:
  //   `${clientLineId}:${cupIdx}` (see web's lib/cup-label/client-line-id.ts).
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
      // Close so the user can't burn another Doubao call re-submitting.
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
    // Remove the photo → fall back to a random surprise design.
    if (slot.selection?.kind === 'photo') clearLabel(slot.cupKey)
  }

  const goPrev = () => setIdx(Math.max(0, safeIdx - 1))
  const goNext = () => setIdx(Math.min(slots.length - 1, safeIdx + 1))

  const photoUploadedId = slot.selection?.kind === 'photo' ? slot.selection.uploadedDoodleId : null
  const photoPreviewUrl = slot.selection?.kind === 'photo' ? slot.selection.previewUrl : null
  const aiDoodleId = slot.selection?.kind === 'ai' ? slot.selection.aiDoodleId : null
  const aiPrompt = slot.selection?.kind === 'ai' ? slot.selection.prompt : ''

  const greeting = profile?.first_name ? `Hi, ${profile.first_name}` : 'Hi there'
  const cupFraction = slot.totalCups > 1 ? `${slot.cupIdx + 1}/${slot.totalCups}` : ''
  const cupChip = `${slot.drinkName}${slot.totalCups > 1 ? ` · Cup ${slot.cupIdx + 1} of ${slot.totalCups}` : ''}`
  const stickerW = Math.min(132, Math.round(screenW * 0.34))

  // Header + hero + tabs, shared by both list bodies (FlatList for the
  // gallery so 200+ tiles stay virtualised; ScrollView for the rest).
  const hero = (
    <View>
      <View style={styles.hero}>
        <View style={styles.stickerWrap}>
          <StickerPreview
            selection={slot.selection}
            greeting={greeting}
            cupFraction={cupFraction}
            drinkName={slot.drinkName}
            variationName={slot.variationName}
            width={stickerW}
            tilt
          />
        </View>
        <View style={styles.heroSide}>
          <Text style={styles.heroHint}>Your sticker, to scale. It prints exactly like this.</Text>
          <Pressable
            onPress={handleSurprise}
            accessibilityRole="button"
            accessibilityState={{ selected: isSurprise }}
            style={[styles.surprise, isSurprise && styles.surpriseActive]}
          >
            <Text style={styles.surpriseGlyph}>🐱</Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.surpriseTitle}>Surprise me</Text>
              <Text style={styles.surpriseSub}>A random lucky cat</Text>
            </View>
            {isSurprise ? (
              <View style={styles.check}>
                <Text style={styles.checkText}>✓</Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={styles.tabBar} accessibilityRole="tablist">
        {TABS.map((t) => {
          const active = viewTab === t.key
          return (
            <Pressable
              key={t.key}
              onPress={() => setViewTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.glyph} {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )

  const bodyPad = { paddingHorizontal: 16, paddingBottom: insets.bottom + 28 }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topbar}>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text style={styles.iconBtnText}>✕</Text>
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>Cup label · optional</Text>
            <Text style={styles.title} numberOfLines={1}>
              Make this cup yours
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={styles.doneBtn}
            accessibilityRole="button"
          >
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.cupRow}>
          {slots.length > 1 ? (
            <Pressable
              onPress={goPrev}
              disabled={safeIdx === 0}
              hitSlop={8}
              style={[styles.navBtn, safeIdx === 0 && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous cup"
            >
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
          ) : null}
          <View style={styles.cupChip}>
            <Text style={styles.cupChipText} numberOfLines={1}>
              {cupChip}
            </Text>
          </View>
          {slots.length > 1 ? (
            <Pressable
              onPress={goNext}
              disabled={safeIdx === slots.length - 1}
              hitSlop={8}
              style={[styles.navBtn, safeIdx === slots.length - 1 && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next cup"
            >
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          ) : null}
        </View>

        {/* The preset gallery gets its own FlatList rather than living in the
            ScrollView below. A ScrollView mounts every child at once, and this
            gallery is 200+ tiles, each decoding a PNG — on an older phone that
            is an out-of-memory stall the moment the tab opens (2026-08-13). A
            VirtualizedList cannot be nested inside a ScrollView without losing
            the virtualisation, so the two are siblings and the shared hero is
            rendered into whichever one is showing. */}
        {viewTab === 'preset' ? (
          <FlatList
            data={galleryPresets}
            keyExtractor={presetKey}
            numColumns={PRESET_COLUMNS}
            columnWrapperStyle={styles.presetRow}
            contentContainerStyle={bodyPad}
            scrollEnabled={scrollEnabled}
            initialNumToRender={PRESET_COLUMNS * 4}
            maxToRenderPerBatch={PRESET_COLUMNS * 4}
            windowSize={5}
            removeClippedSubviews
            ListHeaderComponent={
              <View>
                {hero}
                <Text style={styles.sectionHint}>Hand-drawn by us. Tap one to put it on the cup.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected =
                slot.selection?.kind === 'preset' && slot.selection.hash === item.hash
              return (
                <PressScale
                  haptic
                  scaleTo={0.93}
                  onPress={() => handlePickPreset(item.hash)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={[styles.presetTile, selected && styles.presetTileActive]}
                >
                  <Image
                    source={presetImageSource(item)}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                  />
                  {selected ? (
                    <View style={styles.tileCheck}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  ) : null}
                </PressScale>
              )
            }}
          />
        ) : (
          <ScrollView
            contentContainerStyle={bodyPad}
            scrollEnabled={scrollEnabled}
            keyboardShouldPersistTaps="handled"
          >
            {hero}

            {viewTab === 'draw' && (
              <View style={styles.pane}>
                <View style={styles.toolRow}>
                  <View style={styles.brushes}>
                    <Text style={styles.toolLabel}>BRUSH</Text>
                    {BRUSHES.map((w) => {
                      const active = w === brush
                      return (
                        <Pressable
                          key={w}
                          onPress={() => setBrush(w)}
                          accessibilityRole="button"
                          accessibilityLabel={`Brush size ${w}`}
                          accessibilityState={{ selected: active }}
                          style={[styles.brush, active && styles.brushActive]}
                        >
                          <View style={[styles.brushDot, { width: w + 3, height: w + 3 }]} />
                        </Pressable>
                      )
                    })}
                  </View>
                  <View style={styles.toolBtns}>
                    <Pressable
                      onPress={handleUndo}
                      disabled={paths.length === 0}
                      style={[styles.ghostBtn, paths.length === 0 && styles.disabled]}
                    >
                      <Text style={styles.ghostBtnText}>Undo</Text>
                    </Pressable>
                    <Pressable
                      onPress={handleClear}
                      disabled={paths.length === 0}
                      style={[styles.ghostBtn, paths.length === 0 && styles.disabled]}
                    >
                      <Text style={styles.ghostBtnText}>Clear</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.canvasFrame}>
                  <DoodleCanvas
                    paths={paths}
                    brushWidth={brush}
                    onPathsChange={setPaths}
                    onDrawStart={() => setScrollEnabled(false)}
                    onDrawEnd={() => setScrollEnabled(true)}
                  />
                </View>
                <Text style={styles.sectionHint}>
                  {paths.length === 0
                    ? 'Draw with a finger. It prints in black ink.'
                    : 'Watch it land on the sticker as you go — it saves with your order.'}
                </Text>
              </View>
            )}

            {viewTab === 'ai' && (
              <View style={styles.pane}>
                {aiDoodleId ? (
                  // Surprise-mode locked state: no preview, no regenerate.
                  // Quota is enforced server-side (UNIQUE(user_id, slot_key)),
                  // and the absence of a button stops the customer expecting
                  // iteration.
                  <View style={styles.aiSubmittedCard}>
                    <Text style={styles.aiSubmittedTitle}>✨ On its way</Text>
                    <Text style={styles.aiSubmittedPrompt} numberOfLines={3}>
                      “{aiPrompt}”
                    </Text>
                    <Text style={styles.aiSubmittedHint}>
                      Drawn in the background and revealed when your cup is printed — a
                      surprise, on purpose.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>DESCRIBE YOUR DESIGN</Text>
                    <TextInput
                      style={styles.field}
                      placeholder="e.g. a sleepy panda holding a boba cup"
                      placeholderTextColor={T.ink4}
                      value={promptDraft}
                      onChangeText={setPromptDraft}
                      editable={!aiGenerating}
                      maxLength={AI_PROMPT_MAX}
                      multiline
                    />
                    <View style={styles.fieldMeta}>
                      <Text style={styles.fieldHint}>Printed in black ink — simple shapes come out best.</Text>
                      <Text style={styles.fieldCount}>
                        {promptDraft.length}/{AI_PROMPT_MAX}
                      </Text>
                    </View>

                    <View style={styles.refRow}>
                      {aiSourceLocalUri ? (
                        <RNImage
                          source={{ uri: aiSourceLocalUri }}
                          style={styles.refThumb}
                          resizeMode="cover"
                        />
                      ) : null}
                      <Pressable
                        onPress={handlePickAiSource}
                        disabled={aiGenerating}
                        style={[styles.ghostBtn, aiGenerating && styles.disabled]}
                      >
                        <Text style={styles.ghostBtnText}>
                          📎 {aiSourceLocalUri ? 'Change reference photo' : 'Add a reference photo (optional)'}
                        </Text>
                      </Pressable>
                      {aiSourceLocalUri ? (
                        <Pressable onPress={handleClearAiSource} hitSlop={8}>
                          <Text style={styles.linkDanger}>Remove</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {aiError ? <Text style={styles.error}>{aiError}</Text> : null}

                    <View style={styles.footerRow}>
                      <Text style={styles.footerHint}>
                        One design per cup. Revealed on the printed sticker.
                      </Text>
                      <Pressable
                        onPress={handleAiSubmit}
                        disabled={aiGenerating || promptDraft.trim().length === 0}
                        style={[
                          styles.primaryBtn,
                          (aiGenerating || promptDraft.trim().length === 0) && styles.disabled,
                        ]}
                      >
                        {aiGenerating ? (
                          <ActivityIndicator color={CTA.on} size="small" />
                        ) : (
                          <Text style={styles.primaryBtnText}>✨ Generate</Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            )}

            {viewTab === 'photo' && (
              <View style={styles.pane}>
                <Text style={styles.sectionHint}>
                  Pets, friends, a holiday snap. We turn it into crisp black-and-white ink
                  for the sticker — simple, high-contrast photos print best.
                </Text>
                <Pressable
                  onPress={handlePickPhoto}
                  disabled={uploading}
                  accessibilityRole="button"
                  style={[styles.dropzone, photoPreviewUrl && styles.dropzoneFilled, uploading && styles.disabled]}
                >
                  {photoPreviewUrl ? (
                    <RNImage
                      source={{ uri: photoPreviewUrl }}
                      style={styles.dropzoneImg}
                      resizeMode="contain"
                    />
                  ) : uploading ? (
                    <>
                      <ActivityIndicator color={T.brand} />
                      <Text style={styles.dropzoneTitle}>Uploading…</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.dropzoneGlyph}>📷</Text>
                      <Text style={styles.dropzoneTitle}>Choose a photo</Text>
                      <Text style={styles.dropzoneSub}>From your photo library</Text>
                    </>
                  )}
                </Pressable>
                {uploadError ? <Text style={styles.error}>{uploadError}</Text> : null}
                {photoUploadedId ? (
                  <View style={styles.footerRow}>
                    <Pressable onPress={handleUploadClear} hitSlop={8}>
                      <Text style={styles.linkDanger}>Remove photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={handlePickPhoto}
                      disabled={uploading}
                      style={[styles.ghostBtn, uploading && styles.disabled]}
                    >
                      <Text style={styles.ghostBtnText}>Choose a different photo</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        )}
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
    paddingBottom: 10,
    gap: 12,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontFamily: FONT.sans, fontSize: 15, color: T.ink },
  doneBtn: {
    height: 36, paddingHorizontal: 16, borderRadius: 999,
    backgroundColor: CTA.bg, alignItems: 'center', justifyContent: 'center',
  },
  doneText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: CTA.on },
  eyebrow: { ...TYPE.eyebrow, color: T.ink3 },
  title: {
    fontFamily: FONT.serif, fontSize: 20, color: T.ink, marginTop: 2, letterSpacing: -0.3,
  },
  cupRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: T.line,
  },
  cupChip: {
    flexShrink: 1, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: T.cream,
  },
  cupChipText: { fontFamily: FONT.sans, fontSize: 12.5, fontWeight: '700', color: '#8D5524' },
  navBtn: {
    width: 32, height: 32, borderRadius: 999,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  navBtnText: { fontFamily: FONT.serif, fontSize: 18, color: T.ink, marginTop: -2 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingTop: 18, paddingBottom: 16,
  },
  stickerWrap: { paddingLeft: 4, paddingVertical: 6 },
  heroSide: { flex: 1, minWidth: 0, gap: 10 },
  heroHint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 16, color: T.ink3 },
  surprise: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADIUS.tile,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
  },
  surpriseActive: { borderColor: T.brand, backgroundColor: T.paper },
  surpriseGlyph: { fontSize: 18 },
  surpriseTitle: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: T.ink },
  surpriseSub: { fontFamily: FONT.sans, fontSize: 11, color: T.ink3, marginTop: 1 },
  check: {
    width: 20, height: 20, borderRadius: 999, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },
  checkText: { fontFamily: FONT.sans, fontSize: 11, fontWeight: '700', color: CTA.on },

  tabBar: {
    flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999,
    backgroundColor: T.bg2, marginBottom: 14,
  },
  tab: {
    flex: 1, height: 36, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  tabActive: { backgroundColor: T.card, ...SHADOW.card },
  tabLabel: { fontFamily: FONT.sans, fontSize: 12.5, fontWeight: '700', color: T.ink3 },
  tabLabelActive: { color: T.brand },

  sectionHint: { fontFamily: FONT.sans, fontSize: 12, lineHeight: 16, color: T.ink3, marginBottom: 10 },
  pane: { gap: 12 },

  presetRow: { gap: 10, marginBottom: 10 },
  presetTile: {
    width: '23%', aspectRatio: 1, borderRadius: RADIUS.tile,
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', padding: 5, overflow: 'hidden',
  },
  presetTileActive: { borderColor: T.brand, borderWidth: 2 },
  tileCheck: {
    position: 'absolute', top: 4, right: 4,
    width: 18, height: 18, borderRadius: 999, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },

  toolRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  brushes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toolLabel: { ...TYPE.eyebrow, color: T.ink3, marginRight: 2 },
  // Paper-white like the canvas, with the actual black ink as the dot — a
  // swatch of what the stroke will look like, in both themes.
  brush: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center',
  },
  brushActive: { borderColor: T.brand, borderWidth: 2 },
  brushDot: { backgroundColor: '#111', borderRadius: 999 },
  toolBtns: { flexDirection: 'row', gap: 8 },
  canvasFrame: {
    borderRadius: RADIUS.tile, borderWidth: 1, borderColor: T.line, overflow: 'hidden',
    backgroundColor: '#fff',
  },

  ghostBtn: {
    height: 36, paddingHorizontal: 14, borderRadius: 999,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', flexShrink: 1,
  },
  ghostBtnText: { fontFamily: FONT.sans, fontSize: 12.5, fontWeight: '700', color: T.ink2 },
  primaryBtn: {
    height: 40, paddingHorizontal: 18, borderRadius: 999,
    backgroundColor: CTA.bg, alignItems: 'center', justifyContent: 'center', minWidth: 120,
  },
  primaryBtnText: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: CTA.on },
  disabled: { opacity: 0.35 },
  linkDanger: { fontFamily: FONT.sans, fontSize: 12, color: T.ink3, textDecorationLine: 'underline' },

  fieldLabel: { ...TYPE.eyebrow, color: T.ink3 },
  field: {
    minHeight: 84, padding: 12, borderRadius: RADIUS.tile,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.line,
    fontFamily: FONT.sans, fontSize: 14, color: T.ink, textAlignVertical: 'top',
    marginTop: -4,
  },
  fieldMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: -6 },
  fieldHint: { flex: 1, fontFamily: FONT.sans, fontSize: 11, color: T.ink3 },
  fieldCount: { fontFamily: FONT.mono, fontSize: 10, color: T.ink4 },
  refRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  refThumb: {
    width: 44, height: 44, borderRadius: RADIUS.small,
    backgroundColor: '#fff', borderWidth: 1, borderColor: T.line,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  footerHint: { flex: 1, fontFamily: FONT.sans, fontSize: 11, lineHeight: 15, color: T.ink3 },
  error: {
    fontFamily: FONT.sans, fontSize: 12, color: '#B00020',
    backgroundColor: 'rgba(176,0,32,0.08)', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: RADIUS.small,
  },

  aiSubmittedCard: {
    padding: 20, borderRadius: RADIUS.tile,
    backgroundColor: T.paper, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', gap: 10,
  },
  aiSubmittedTitle: { fontFamily: FONT.serif, fontSize: 20, color: T.brand },
  aiSubmittedPrompt: {
    fontFamily: FONT.sans, fontSize: 14, fontStyle: 'italic',
    color: T.ink, textAlign: 'center', maxWidth: 280,
  },
  aiSubmittedHint: {
    fontFamily: FONT.sans, fontSize: 12, lineHeight: 16, color: T.ink3,
    textAlign: 'center', maxWidth: 280,
  },

  dropzone: {
    alignSelf: 'center', width: '100%', maxWidth: 240, aspectRatio: 1,
    borderRadius: RADIUS.tile, borderWidth: 2, borderStyle: 'dashed', borderColor: T.line,
    backgroundColor: T.paper, alignItems: 'center', justifyContent: 'center', gap: 4,
    overflow: 'hidden',
  },
  dropzoneFilled: { borderStyle: 'solid', backgroundColor: '#fff' },
  dropzoneImg: { width: '100%', height: '100%' },
  dropzoneGlyph: { fontSize: 30 },
  dropzoneTitle: { fontFamily: FONT.sans, fontSize: 13, fontWeight: '700', color: T.ink, marginTop: 4 },
  dropzoneSub: { fontFamily: FONT.sans, fontSize: 11, color: T.ink3 },
})
