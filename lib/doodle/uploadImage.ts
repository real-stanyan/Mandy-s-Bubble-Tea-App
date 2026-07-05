// lib/doodle/uploadImage.ts
//
// Pick an image from the device photo library, base64-encode it, POST to
// /api/cup-label/upload-image. Server runs the same 300dpi 1-bit thermal
// pipeline as AI-generated doodles and returns an id that the app stores
// on the slot like aiDoodleId — at checkout both paths converge into the
// `aiDoodleIds` map sent to /api/payment.

import * as ImagePicker from 'expo-image-picker'
import { apiFetch } from '@/lib/api'

export interface UploadImageResult {
  uploadedDoodleId: string
  previewUrl: string
}

/**
 * Pick an image from the photo library and return it as a data URI
 * without uploading anywhere. Used as the "reference image" for AI
 * image-to-image generation — the data URI is sent inside the
 * /api/cup-label/ai-generate request body, which uploads it as a
 * temp source server-side and forwards the signed URL to Doubao.
 */
export async function pickImageBase64(): Promise<{
  dataUri: string
  localUri: string
} | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) throw new Error('Photo library permission denied')

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.85,
    base64: true,
    allowsEditing: true,
    aspect: [1, 1],
  })
  if (picked.canceled || picked.assets.length === 0) return null
  const asset = picked.assets[0]
  if (!asset.base64) throw new Error('Image picker returned no base64 data')
  const mime = asset.mimeType ?? 'image/jpeg'
  return {
    dataUri: `data:${mime};base64,${asset.base64}`,
    localUri: asset.uri,
  }
}

/** Returns null if the user dismissed the picker. Throws on actual error. */
export async function pickAndUploadImage(): Promise<UploadImageResult | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Photo library permission denied')
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.85,
    base64: true,
    allowsEditing: true,
    aspect: [1, 1],
  })
  if (picked.canceled || picked.assets.length === 0) return null

  const asset = picked.assets[0]
  if (!asset.base64) throw new Error('Image picker returned no base64 data')
  const mime = asset.mimeType ?? 'image/jpeg'
  const dataUri = `data:${mime};base64,${asset.base64}`

  const res = await apiFetch<{
    ok: boolean
    uploadedDoodleId?: string
    previewUrl?: string
    error?: string
  }>('/api/cup-label/upload-image', {
    method: 'POST',
    body: JSON.stringify({ imageBase64: dataUri }),
  })

  if (!res.ok || !res.uploadedDoodleId || !res.previewUrl) {
    throw new Error(res.error ?? 'Image upload failed')
  }
  return { uploadedDoodleId: res.uploadedDoodleId, previewUrl: res.previewUrl }
}
