# App Order Complaint Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the web Order Complaint Channel to the iOS app — `Need help with this order?` card on `app/order-detail.tsx` plus a new Expo Router modal route hosting the description + photo form, all calling the existing web backend unchanged.

**Architecture:** Single feature branch `feat/order-complaint-port` off main. Three new files (modal route, section card, photo-compress wrapper) and four modified files (`_layout.tsx` Stack.Screen registration, `order-detail.tsx` mount, `app.json` build/plugin, `package.json` deps). No backend changes. Photos client-compressed via `expo-image-manipulator` to 1920px-wide JPEG q80 before multipart upload to `/api/orders/[orderId]/complaint`.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native 0.74, TypeScript, Supabase Auth (Bearer token), `expo-image-picker`, `expo-image-manipulator`, jest 29 with `jest-expo` preset.

**Spec:** `docs/superpowers/specs/2026-04-27-app-order-complaint-port-design.md`

**Branch:** `feat/order-complaint-port` (already created at `e22b98c`, off main `c62d7b1`)

**Out-of-scope reminders (do not touch):**
- `lib/doodle/*`, `components/doodle/*`, `hooks/use-payment.ts`, `app/checkout.tsx` — owned by paused doodle Phase 2 agent on `feat/cup-label-app-doodle`.
- Web backend (`/api/orders/[orderId]/complaint{,-status}`) — unchanged.

---

## Task 1: Add deps + bump build + register image-picker plugin

**Files:**
- Modify: `package.json` (add 2 deps)
- Modify: `app.json` (bump iOS buildNumber 9→10, add `expo-image-picker` plugin block)

- [ ] **Step 1: Install the two Expo modules**

Run from app repo root:

```bash
npx expo install expo-image-picker expo-image-manipulator
```

Use `npx expo install` (not `npm install`) so versions match SDK 54.

Expected output: dependencies added to `package.json`, `package-lock.json` updated. No errors.

- [ ] **Step 2: Verify the install**

```bash
grep -E "expo-image-picker|expo-image-manipulator" package.json
```

Expected: two lines, each with a version like `"~17.x.x"` and `"~14.x.x"` (exact SDK 54 versions vary; just confirm both present).

- [ ] **Step 3: Edit `app.json` — bump build + add plugin**

Open `app.json`. Make two edits:

a) Under `expo.ios`, change `"buildNumber": "9"` to `"buildNumber": "10"`.

b) Inside the `expo.plugins` array (currently includes `"expo-router"`, `["expo-notifications", {...}]`, `["expo-splash-screen", {...}]` etc.), append a new entry:

```json
[
  "expo-image-picker",
  {
    "photosPermission": "Used to attach photos when reporting an order issue.",
    "cameraPermission": "Used to take a photo when reporting an order issue.",
    "microphonePermission": false
  }
]
```

The `microphonePermission: false` is critical — without it, expo-image-picker writes `NSMicrophoneUsageDescription` into Info.plist by default, triggering an avoidable App Review question.

- [ ] **Step 4: Verify the JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('app.json','utf8'))" && echo "OK"
```

Expected: `OK`. (If invalid, fix the trailing-comma / brace error before continuing.)

- [ ] **Step 5: Confirm Info.plist will pick up the strings**

The plugin block in `app.json` is consumed at native-build time. Since project memory says **do not run `npx expo prebuild --clean`**, and the existing `ios/` folder is checked in, the new permission keys may not be auto-merged. Run:

```bash
ls ios/mandysbubbleteaapp/Info.plist 2>&1 | head -1
```

Expected: file exists. We will check inside it after Task 7 — at that point if `NSPhotoLibraryUsageDescription` and `NSCameraUsageDescription` are missing, we run `npx expo prebuild --no-install` (NOT `--clean`) to regenerate native files without nuking the existing config. Do not run prebuild yet — wait until all code is in place so a single regen captures everything.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "$(cat <<'EOF'
chore(deps): add expo-image-picker + image-manipulator for complaint port

Bumps iOS buildNumber to 10 and registers the expo-image-picker plugin
with photo + camera permission strings. Microphone permission is
explicitly disabled so the picker plugin does not write
NSMicrophoneUsageDescription into Info.plist by default.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `lib/photo-compress.ts` (TDD)

**Files:**
- Create: `lib/photo-compress.ts`
- Create: `lib/photo-compress.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/photo-compress.test.ts`:

```ts
import * as ImageManipulator from 'expo-image-manipulator'
import { compressForUpload } from './photo-compress'

jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: { JPEG: 'jpeg' },
}))

const mockManipulateAsync = ImageManipulator.manipulateAsync as jest.Mock

describe('compressForUpload', () => {
  beforeEach(() => {
    mockManipulateAsync.mockReset()
  })

  it('resizes to 1920px width with JPEG q80 and returns Photo shape', async () => {
    mockManipulateAsync.mockResolvedValueOnce({
      uri: 'file:///tmp/out.jpg',
      width: 1920,
      height: 1080,
    })

    const result = await compressForUpload('file:///source/heic1.heic', 0)

    expect(mockManipulateAsync).toHaveBeenCalledWith(
      'file:///source/heic1.heic',
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: 'jpeg' },
    )
    expect(result).toEqual({
      uri: 'file:///tmp/out.jpg',
      mime: 'image/jpeg',
      name: 'photo-0.jpg',
    })
  })

  it('uses the index in the generated filename', async () => {
    mockManipulateAsync.mockResolvedValueOnce({
      uri: 'file:///tmp/x.jpg',
      width: 100,
      height: 100,
    })
    const result = await compressForUpload('file:///s.jpg', 2)
    expect(result.name).toBe('photo-2.jpg')
  })

  it('propagates errors from manipulateAsync to the caller', async () => {
    mockManipulateAsync.mockRejectedValueOnce(new Error('decode failed'))
    await expect(compressForUpload('file:///bad.heic', 0)).rejects.toThrow(
      'decode failed',
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- --testPathPattern=photo-compress
```

Expected: FAIL with `Cannot find module './photo-compress'` or similar (because `lib/photo-compress.ts` does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `lib/photo-compress.ts`:

```ts
import * as ImageManipulator from 'expo-image-manipulator'

export type Photo = {
  uri: string
  mime: 'image/jpeg'
  name: string
}

export async function compressForUpload(
  sourceUri: string,
  index: number,
): Promise<Photo> {
  const result = await ImageManipulator.manipulateAsync(
    sourceUri,
    [{ resize: { width: 1920 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  )
  return {
    uri: result.uri,
    mime: 'image/jpeg',
    name: `photo-${index}.jpg`,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- --testPathPattern=photo-compress
```

Expected: PASS, all three tests green.

- [ ] **Step 5: Run the full test suite to confirm nothing else broke**

```bash
npm test
```

Expected: previously-passing 8 tests still pass, plus 3 new ones — total 11 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/photo-compress.ts lib/photo-compress.test.ts
git commit -m "$(cat <<'EOF'
feat(photo-compress): client-side image-manipulator wrapper for complaint upload

Resizes any picker source down to 1920px wide and re-encodes to JPEG q80
so HEIC/large originals from iOS Photos drop to ~500KB before the
multipart upload to /api/orders/[orderId]/complaint. Also dodges the
sporadic libheif decode failure on Vercel's Node runtime.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `components/account/OrderComplaintSection.tsx`

**Files:**
- Create: `components/account/OrderComplaintSection.tsx`

This is the 4-state card mounted on `order-detail.tsx`. No unit test (no component-test infrastructure in the app — only pure-logic tests in `lib/`); typecheck + manual validation cover this.

- [ ] **Step 1: Verify the directory exists**

```bash
ls components/account/ | head -5
```

Expected: directory exists with at least one existing file (e.g. `MemberQrCard.tsx`). If missing, `mkdir -p components/account`.

- [ ] **Step 2: Create the file**

Create `components/account/OrderComplaintSection.tsx`:

```tsx
import { useCallback, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useAuth } from '@/components/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { T, TYPE, RADIUS } from '@/constants/theme'

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

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

  // Client gate: only render for logged-in users on COMPLETED orders.
  // No customerId match needed — orders store is already filtered to the
  // signed-in user via /api/orders/history.
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
          // Detect transition: if previous render was eligible and we just
          // came back from a successful submit (modal popped → order-detail
          // refocus → refetch), surface the toast banner. On the very first
          // mount (prev was 'loading'), don't show — the user is just
          // returning to a previously-reported order.
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
                pathname: '/order-complaint',
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
```

- [ ] **Step 3: Confirm `TYPE.body` and `TYPE.bodyStrong` exist (the file expects them)**

```bash
grep -n "body\b\|bodyStrong" constants/theme.ts | head -5
```

Expected: matches for both. If `TYPE.body` is missing under a different name (`bodyText`, etc.), update the styles in the new file accordingly. Do NOT add new fields to `constants/theme.ts` — only consume what already exists.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors. If errors mention missing `OrderComplaintSection` import, that's fine — Task 6 wires it in.

- [ ] **Step 5: Commit**

```bash
git add components/account/OrderComplaintSection.tsx
git commit -m "$(cat <<'EOF'
feat(account): add OrderComplaintSection card with 4-state gate

Mirrors the web section: client-side gate on COMPLETED + signed-in,
fetch /api/orders/[orderId]/complaint-status, render loading / eligible
/ window_closed / already_reported. Refetches on focus so popping the
modal route auto-flips the card to "Reported on …" plus a one-shot
toast.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `app/order-complaint.tsx` modal route

**Files:**
- Create: `app/order-complaint.tsx`

This is the largest file. It hosts the form, photo picker, compress pipeline, and submit handler. All copy is canonical from the spec.

- [ ] **Step 1: Create the file**

Create `app/order-complaint.tsx`:

```tsx
import { useCallback, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ActionSheetIOS,
  Alert,
  Linking,
  StyleSheet,
} from 'react-native'
import {
  useLocalSearchParams,
  useRouter,
  Stack,
} from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { compressForUpload, type Photo } from '@/lib/photo-compress'
import { T, TYPE, RADIUS } from '@/constants/theme'

const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://mandybubbletea.com'

const MAX_PHOTOS = 3
const MIN_DESC = 10
const MAX_DESC = 1000

type ServerErrorBody = {
  error?: string
  message?: string
  reason?: string
}

function friendlyError(
  code: string,
  serverMessage: string | undefined,
  status: number,
): string {
  if (serverMessage) return serverMessage
  switch (code) {
    case 'NOT_AUTHENTICATED':
      return 'You need to sign in to report a problem.'
    case 'NOT_OWN_ORDER':
      return 'Sign in with the account that placed this order.'
    case 'ORDER_NOT_FOUND':
      return "We couldn't find this order."
    case 'NOT_COMPLETED':
      return "This order isn't complete yet."
    case 'WINDOW_CLOSED':
      return 'The 7-day window for reporting this order has passed.'
    case 'ALREADY_REPORTED':
      return 'This order was already reported.'
    case 'INVALID_INPUT':
      return 'Please double-check the form and try again.'
    case 'INVALID_PHOTO':
      return "One of the photos couldn't be processed. Try a different file."
    case 'PROCESSING_FAILED':
      return "We couldn't process your photos. Please try again."
    case 'EMAIL_FAILED':
      return "We couldn't send your report. Please try again in a moment."
    default:
      return `Server error (${status}). Please try again.`
  }
}

export default function OrderComplaintScreen() {
  const params = useLocalSearchParams<{
    orderId: string
    pickupNumber: string
  }>()
  const orderId = params.orderId ?? ''
  const pickupNumber = params.pickupNumber ?? ''
  const router = useRouter()

  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [permissionDenied, setPermissionDenied] = useState<
    'camera' | 'library' | null
  >(null)

  const canAddMore = photos.length < MAX_PHOTOS
  const canSubmit =
    !submitting &&
    description.trim().length >= MIN_DESC &&
    description.length <= MAX_DESC

  const onPickFromLibrary = useCallback(async () => {
    setError(null)
    setPermissionDenied(null)
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      setPermissionDenied('library')
      return
    }
    const remaining = MAX_PHOTOS - photos.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 1,
    })
    if (result.canceled) return
    try {
      const startIdx = photos.length
      const compressed = await Promise.all(
        result.assets.map((asset, i) =>
          compressForUpload(asset.uri, startIdx + i),
        ),
      )
      setPhotos((prev) => [...prev, ...compressed].slice(0, MAX_PHOTOS))
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't process a photo: ${e.message}`
          : "Couldn't process a photo.",
      )
    }
  }, [photos.length])

  const onTakePhoto = useCallback(async () => {
    setError(null)
    setPermissionDenied(null)
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (perm.status !== 'granted') {
      setPermissionDenied('camera')
      return
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    })
    if (result.canceled) return
    try {
      const compressed = await compressForUpload(
        result.assets[0].uri,
        photos.length,
      )
      setPhotos((prev) => [...prev, compressed].slice(0, MAX_PHOTOS))
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't process the photo: ${e.message}`
          : "Couldn't process the photo.",
      )
    }
  }, [photos.length])

  const onAddPhoto = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) onTakePhoto()
          else if (idx === 1) onPickFromLibrary()
        },
      )
    } else {
      Alert.alert('Add photo', undefined, [
        { text: 'Take Photo', onPress: onTakePhoto },
        { text: 'Choose from Library', onPress: onPickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }, [onTakePhoto, onPickFromLibrary])

  const onRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return
    setError(null)
    setSubmitting(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError(friendlyError('NOT_AUTHENTICATED', undefined, 401))
        setSubmitting(false)
        return
      }
      const fd = new FormData()
      fd.append('description', description.trim())
      photos.forEach((p) => {
        // RN FormData accepts {uri, name, type} for file parts; TS lib types
        // don't model this so we cast through unknown.
        fd.append('photos', {
          uri: p.uri,
          name: p.name,
          type: p.mime,
        } as unknown as Blob)
      })
      // Note: do NOT set Content-Type — RN injects multipart boundary
      // automatically, and a hand-set value breaks the upload.
      const res = await fetch(
        `${API_BASE}/api/orders/${orderId}/complaint`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        },
      )
      if (!res.ok) {
        const body = (await res
          .json()
          .catch(() => ({}))) as ServerErrorBody
        const code = String(body.error ?? '')
        // 409 ALREADY_REPORTED race: another tab/device already submitted
        // (or our status route was stale). Treat as success — pop back,
        // section's focus refetch will flip the card.
        if (res.status === 409 && code === 'ALREADY_REPORTED') {
          router.back()
          return
        }
        setError(friendlyError(code, body.message, res.status))
        setSubmitting(false)
        return
      }
      router.back()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error.')
      setSubmitting(false)
    }
  }, [canSubmit, description, photos, orderId, router])

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'modal',
          headerShown: false,
          gestureEnabled: !submitting,
        }}
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              Report a problem with order {pickupNumber}
            </Text>
            <Text style={styles.subtitle}>
              Tell us what went wrong. We&apos;ll be in touch within 24 hours.
            </Text>
          </View>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            hitSlop={12}
            accessibilityLabel="Close"
            style={({ pressed }) => [
              styles.closeBtn,
              (pressed || submitting) && styles.closeBtnDimmed,
            ]}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Tell us what went wrong (e.g. wrong topping, drink looked off, missing item)…"
              placeholderTextColor={T.ink3}
              multiline
              numberOfLines={5}
              maxLength={MAX_DESC}
              style={styles.textArea}
              editable={!submitting}
            />
            <Text style={styles.counter}>
              {description.length}/{MAX_DESC}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>
              Photos ({photos.length}/{MAX_PHOTOS}, optional)
            </Text>
            {photos.length > 0 && (
              <View style={styles.photoGrid}>
                {photos.map((p, i) => (
                  <View key={`${p.uri}-${i}`} style={styles.photoTile}>
                    <Image source={{ uri: p.uri }} style={styles.photoImage} />
                    <Pressable
                      onPress={() => onRemovePhoto(i)}
                      disabled={submitting}
                      hitSlop={8}
                      accessibilityLabel={`Remove photo ${i + 1}`}
                      style={styles.photoRemove}
                    >
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            {canAddMore && (
              <Pressable
                onPress={onAddPhoto}
                disabled={submitting}
                style={({ pressed }) => [
                  styles.addPhoto,
                  pressed && styles.addPhotoPressed,
                ]}
              >
                <Text style={styles.addPhotoText}>＋  Add photo</Text>
              </Pressable>
            )}
          </View>

          {permissionDenied && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                {permissionDenied === 'camera'
                  ? 'Camera permission is needed to take a photo. '
                  : 'Photos permission is needed to attach a photo. '}
              </Text>
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={styles.bannerLink}>Open Settings</Text>
              </Pressable>
            </View>
          )}

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.back()}
            disabled={submitting}
            style={({ pressed }) => [
              styles.cancelBtn,
              (pressed || submitting) && styles.btnDimmed,
            ]}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              (pressed || !canSubmit) && styles.btnDimmed,
            ]}
          >
            {submitting && (
              <ActivityIndicator
                size="small"
                color="#fff"
                style={{ marginRight: 8 }}
              />
            )}
            <Text style={styles.submitBtnText}>Submit</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: T.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
    gap: 12,
  },
  headerText: { flex: 1 },
  title: {
    fontFamily: 'Fraunces_500Medium',
    fontSize: 22,
    letterSpacing: -0.4,
    color: T.ink,
  },
  subtitle: { ...TYPE.body, fontSize: 14, color: T.ink2, marginTop: 4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: T.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnDimmed: { opacity: 0.5 },
  closeBtnText: { fontSize: 16, color: T.ink2 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24, gap: 20 },
  field: { gap: 8 },
  label: { ...TYPE.bodyStrong, fontSize: 14, color: T.ink },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.tile,
    padding: 12,
    backgroundColor: '#fff',
    color: T.ink,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  counter: {
    ...TYPE.body,
    fontSize: 11,
    color: T.ink3,
    textAlign: 'right',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoTile: {
    width: 88,
    height: 88,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: T.bg2,
    position: 'relative',
  },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 12, lineHeight: 14 },
  addPhoto: {
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.tile,
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addPhotoPressed: { opacity: 0.8 },
  addPhotoText: { ...TYPE.body, fontSize: 14, color: T.ink2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    backgroundColor: '#fef3c7',
    borderRadius: RADIUS.tile,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bannerText: { ...TYPE.body, fontSize: 13, color: '#854d0e' },
  bannerLink: {
    ...TYPE.bodyStrong,
    fontSize: 13,
    color: '#854d0e',
    textDecorationLine: 'underline',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: RADIUS.tile,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: { ...TYPE.body, fontSize: 13, color: '#991b1b' },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.line,
    backgroundColor: T.paper,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { ...TYPE.bodyStrong, fontSize: 14, color: T.ink2 },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.brand,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
  },
  submitBtnText: { ...TYPE.bodyStrong, fontSize: 14, color: '#fff' },
  btnDimmed: { opacity: 0.5 },
})
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors. Common pitfalls:
- `MediaTypeOptions` may be deprecated in newer expo-image-picker — if TS warns, change to `mediaTypes: ['images']` (string-array form) per the SDK's current docs.
- `FormData` `append` signature: the `as unknown as Blob` cast handles RN's non-standard file part shape.

- [ ] **Step 3: Run jest to make sure no test broke**

```bash
npm test
```

Expected: 11 tests pass (no new tests for this file by design).

- [ ] **Step 4: Commit**

```bash
git add app/order-complaint.tsx
git commit -m "$(cat <<'EOF'
feat(order-complaint): add modal route with description + photo form

Hosts the description textarea (10-1000 chars), 0-3 photo grid with
ActionSheet picker (Take Photo / Choose from Library), and submit
handler that posts multipart to /api/orders/[orderId]/complaint with
Supabase Bearer auth. Mirrors web friendlyError mapping for 10 codes
plus the 409 ALREADY_REPORTED graceful close.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Register modal route in `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Read the current Stack.Screen registrations**

```bash
grep -n "Stack.Screen" app/_layout.tsx
```

Expected output: 6+ existing `Stack.Screen` calls (login, tabs, menu, checkout, order-detail, messages, promotions, order-confirmation).

- [ ] **Step 2: Insert the new screen**

Open `app/_layout.tsx`. Find the existing `Stack.Screen name="order-confirmation"` block (around line 135–150). Immediately after that block's closing `/>` (and before the next `</Stack>`/end of stack), add:

```tsx
<Stack.Screen
  name="order-complaint"
  options={{
    presentation: 'modal',
    headerShown: false,
  }}
/>
```

The `presentation: 'modal'` is also set inside the route file via `<Stack.Screen options>` so the in-screen `gestureEnabled` toggle works during submit. Both are intentional — the layout-level option is what makes Expo Router pick the modal animation; the route-level option is what flips during submit.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "$(cat <<'EOF'
feat(layout): register order-complaint as a modal route

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Mount section on `app/order-detail.tsx`

**Files:**
- Modify: `app/order-detail.tsx`

- [ ] **Step 1: Add import**

Open `app/order-detail.tsx`. Find the existing import block at the top (`useFocusEffect`, `useOrdersStore`, etc., around line 13–16). After the last import, add:

```tsx
import { OrderComplaintSection } from '@/components/account/OrderComplaintSection'
```

- [ ] **Step 2: Mount the section between Order Summary and the Back button**

Find the closing `</View>` of `summarySection` (around line 308–309) and the opening of the "Back to {backLabel}" `<TouchableOpacity>` (around line 311). Insert between them:

```tsx
{state === 'COMPLETED' && (
  <OrderComplaintSection
    orderId={orderId}
    pickupNumber={pickupNumber}
    orderState={state}
  />
)}
```

The outer `state === 'COMPLETED'` is a cheap render-phase gate so the section's own `useFocusEffect` fetch doesn't fire on OPEN/CANCELED orders. The section itself also gates on COMPLETED for safety, but the parent gate keeps the network quiet.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Run jest**

```bash
npm test
```

Expected: 11 passing.

- [ ] **Step 5: Commit**

```bash
git add app/order-detail.tsx
git commit -m "$(cat <<'EOF'
feat(order-detail): mount OrderComplaintSection below summary

Renders the 4-state complaint card on COMPLETED orders only. Section
self-gates as well; the parent gate is just for keeping idle order
screens from hitting the status route.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Verify Info.plist permission keys (regenerate if missing)

**Files:**
- Possibly regenerated: `ios/mandysbubbleteaapp/Info.plist`

This is a verification gate, not a code task — only commits if `expo prebuild` actually changes files.

- [ ] **Step 1: Check Info.plist for permission strings**

```bash
grep -E "NSCameraUsageDescription|NSPhotoLibraryUsageDescription" ios/mandysbubbleteaapp/Info.plist || echo "MISSING"
```

Two outcomes:
- Both keys present → skip to Step 4 (no changes needed).
- `MISSING` → continue to Step 2.

- [ ] **Step 2 (only if missing): Run `expo prebuild --no-install`**

This regenerates the iOS native project from `app.json` without nuking the existing config (no `--clean`) and without re-running `pod install` (`--no-install`).

```bash
npx expo prebuild --no-install --platform ios
```

Expected: a number of `ios/` files updated. Watch the diff carefully — most should be confined to `Info.plist` and possibly Podfile/project.pbxproj.

- [ ] **Step 3 (only if Step 2 ran): Re-check Info.plist**

```bash
grep -A1 "NSCameraUsageDescription\|NSPhotoLibraryUsageDescription" ios/mandysbubbleteaapp/Info.plist
```

Expected: both keys present with the strings from `app.json` (the photos / camera permission text).

- [ ] **Step 4 (only if Step 2 ran and produced changes): Diff and commit**

```bash
git status
git diff --stat ios/
```

If only `Info.plist` and minor project files changed, commit them:

```bash
git add ios/
git commit -m "$(cat <<'EOF'
chore(ios): regenerate Info.plist with image-picker permission strings

Auto-generated from app.json's expo-image-picker plugin block via
\`expo prebuild --no-install\`.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

If `expo prebuild` changed unexpected files (e.g. wholesale rewrite of `project.pbxproj`, removal of existing entitlements), STOP — do not commit. Bring it up; the project memory's "do not run prebuild --clean" applies even to `--no-install` if the regen is too aggressive. In that case, fall back to manual edit: open `ios/mandysbubbleteaapp/Info.plist` in Xcode and add the two permission entries by hand.

- [ ] **Step 5: Final clean state**

```bash
git status
```

Expected: working tree clean (or only the unrelated `screenshots/` and `docs/superpowers/plans/2026-04-27-ig-follow-discount-app-sync.md` untracked from earlier sessions).

---

## Task 8: Verification gate (no commits)

**Files:** none — this is the final gate before handing back for ship.

- [ ] **Step 1: Full typecheck**

```bash
npx tsc --noEmit
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 2: Full jest**

```bash
npm test
```

Expected: 11 passing tests (8 existing + 3 photo-compress).

- [ ] **Step 3: Branch / commit summary**

```bash
git log --oneline main..HEAD
```

Expected: 6–7 commits, one per task above:
1. `chore(deps): add expo-image-picker + image-manipulator …`
2. `feat(photo-compress): client-side image-manipulator wrapper …`
3. `feat(account): add OrderComplaintSection card …`
4. `feat(order-complaint): add modal route with description + photo form`
5. `feat(layout): register order-complaint as a modal route`
6. `feat(order-detail): mount OrderComplaintSection below summary`
7. (optional) `chore(ios): regenerate Info.plist …` — only if Task 7 produced a diff
Plus the pre-existing `docs(spec): app order complaint port design` from before plan execution.

- [ ] **Step 4: Manual smoke test on dev/sandbox build**

Run `npx expo start --dev-client` (or however dev builds usually run on this project). Then on the test device with a real Supabase session and a sandbox COMPLETED order:

1. Open the app → My Orders → tap a completed order.
2. Scroll to bottom of order-detail page → see "Need help with this order?" card with `Report a problem` button below Order Summary, above `Back to My Orders`.
3. Tap the button → modal sheet slides up.
4. Type 8 characters → Submit disabled. Type 10 → Submit enables.
5. Tap "Add photo" → ActionSheet appears with 3 options.
6. First-time "Take Photo" → camera permission prompt with copy "Used to take a photo when reporting an order issue." Approve → camera opens. Take photo → returns to form with thumbnail.
7. First-time "Choose from Library" → photos permission prompt with copy "Used to attach photos when reporting an order issue." Approve → multi-select picker.
8. Pick 2 HEIC photos from camera roll → ~1–2s compress wait → both appear in 88×88 grid.
9. Submit → spinner → modal pops back → card flips to `Reported on {today}` plus green toast banner.
10. Verify side-effects:
    - `hello@mandybubbletea.com` receives the email with 2 JPEG attachments.
    - Supabase `order_complaints` has new row.
    - Re-tap order in My Orders → still `Reported on {today}` (no toast — focus-effect transition logic is correct).

If any step diverges from expected, file as a bug against the failing task and revisit. Do NOT push the branch / open PR until all 10 manual steps pass.

- [ ] **Step 5: Hand off**

When everything is green:

1. Tell the user: implementation complete, ready for ASC archive (1.0.9 build 10).
2. Update `~/system/DEV_QUEUE.md` Mandy's Bubble Tea App section: add a bullet for the in-flight 1.0.9 build 10 mentioning the complaint port.
3. Update `~/system/DEV_HANDOFF.md` with this session's commits + outcome.
4. Do NOT push origin until the user gives the go-ahead — `feat/order-complaint-port` stays local until the doodle agent finishes and we agree on merge order.

---

## Spec coverage map

For self-review — every spec section maps to a task:

| Spec section | Task |
|---|---|
| §4 file changes (3 new + 4 modified) | Tasks 1, 2, 3, 4, 5, 6 |
| §5 OrderComplaintSection contract (4 states + useFocusEffect) | Task 3 |
| §5 photo-compress.ts contract | Task 2 |
| §5 modal route props + state | Task 4 |
| §6 copy strings (section + modal + actionsheet + perm denied + error map) | Tasks 3, 4 |
| §7 Info.plist plugin block | Task 1 |
| §7 Info.plist verification | Task 7 |
| §8 buildNumber bump | Task 1 |
| §9 unit test (photo-compress) | Task 2 |
| §9 manual verification | Task 8 |
| §10 risk #1 KeyboardAvoidingView | Task 4 (component) |
| §10 risk #4 Bearer auth | Task 4 (uses supabase.auth.getSession()) |

What's New copy update is operator-side (ASC web form), not a code change — handled in Task 8 Step 5 via the DEV_HANDOFF update.
