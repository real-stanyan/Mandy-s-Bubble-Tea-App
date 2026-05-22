// lib/doodle/build-payment-selections.ts
//
// Pure transform: a Record of CupLabelSelection (keyed by cupKey) into
// the three field maps that /api/payment accepts in its POST body.
// Field names MUST match the web server's PaymentBody schema — see
// ~/Github/mandys_bubble_tea/src/app/api/payment/route.ts:
//
//   - presetStickerHashes: gallery picks (md5/named hash → resolves to a
//                          file under public/cup-label/gallery/)
//   - aiDoodleIds:         AI gen results AND uploaded photos — server
//                          treats them identically (pre-uploaded image
//                          referenced by uploaded-asset id)
//   - doodleIds:           drawn doodles uploaded via /api/doodle/upload
//
// Pending uploads (aiDoodleId / userDoodleId === null) are dropped so
// the server never receives a half-baked reference. Pay gate
// (app/checkout.tsx) blocks AI pending; draw uploads run pre-pay so
// userDoodleId is always resolved by the time we get here.

import type { CupLabelSelection } from '@/store/cart'

export type PaymentSelectionMaps = {
  presetStickerHashes: Record<string, string>
  aiDoodleIds: Record<string, string>
  doodleIds: Record<string, string>
}

export function buildPaymentSelections(
  selections: Record<string, CupLabelSelection>,
): PaymentSelectionMaps {
  const presetStickerHashes: Record<string, string> = {}
  const aiDoodleIds: Record<string, string> = {}
  const doodleIds: Record<string, string> = {}

  for (const [k, s] of Object.entries(selections)) {
    switch (s.kind) {
      case 'preset':
        presetStickerHashes[k] = s.hash
        break
      case 'photo':
        // Photo + AI both land in aiDoodleIds — server treats them as
        // a pre-uploaded image referenced by upload id.
        aiDoodleIds[k] = s.uploadedDoodleId
        break
      case 'ai':
        if (s.aiDoodleId) aiDoodleIds[k] = s.aiDoodleId
        break
      case 'draw':
        if (s.userDoodleId) doodleIds[k] = s.userDoodleId
        break
    }
  }

  return { presetStickerHashes, aiDoodleIds, doodleIds }
}
