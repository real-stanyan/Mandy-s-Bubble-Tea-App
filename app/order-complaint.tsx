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
import { API_BASE } from '@/lib/api'
import { compressForUpload, type Photo } from '@/lib/photo-compress'
import { T, TYPE, RADIUS } from '@/constants/theme'

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
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
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
    fontFamily: 'ShantellSans_700Bold',
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
