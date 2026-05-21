// lib/doodle/build-payment-selections.ts
//
// Pure transform: a Record of CupLabelSelection (keyed by cupKey) into
// the four sibling maps that /api/payment expects in its POST body.
// Pending uploads (aiDoodleId / userDoodleId === null) are dropped so
// the server never receives a half-baked reference. Pay gate
// (app/checkout.tsx) is responsible for blocking the user before they
// get here when any selection is still in-flight.

import type { CupLabelSelection } from '@/store/cart'

export type PaymentSelectionMaps = {
  presetStickerHashes: Record<string, string>
  uploadedDoodleIds: Record<string, string>
  aiDoodleIds: Record<string, string>
  userDoodleIds: Record<string, string>
}

export function buildPaymentSelections(
  selections: Record<string, CupLabelSelection>,
): PaymentSelectionMaps {
  const presetStickerHashes: Record<string, string> = {}
  const uploadedDoodleIds: Record<string, string> = {}
  const aiDoodleIds: Record<string, string> = {}
  const userDoodleIds: Record<string, string> = {}

  for (const [k, s] of Object.entries(selections)) {
    switch (s.kind) {
      case 'preset':
        presetStickerHashes[k] = s.hash
        break
      case 'photo':
        uploadedDoodleIds[k] = s.uploadedDoodleId
        break
      case 'ai':
        if (s.aiDoodleId) aiDoodleIds[k] = s.aiDoodleId
        break
      case 'draw':
        if (s.userDoodleId) userDoodleIds[k] = s.userDoodleId
        break
    }
  }

  return { presetStickerHashes, uploadedDoodleIds, aiDoodleIds, userDoodleIds }
}
