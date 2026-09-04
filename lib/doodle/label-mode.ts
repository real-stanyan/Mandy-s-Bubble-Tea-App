// Cup-label paper mode — app half of the web repo's
// src/lib/cup-label/label-mode.ts (see web PR #307 / issue #306).
//
// 2026-08-26: the 50×80mm photo-label roll ran out; the shop is
// temporarily on 40×30mm stock that only fits text (ticket number +
// order details). While that's loaded the photo/draw/AI picker is
// hidden and the checkout shows a "back in about two weeks" notice.
// The server also 503s the upload endpoints, so even stale builds
// can't submit art that would never print.
//
// When the big roll is back: flip currentPaperMode() to "photo-50x80"
// here AND in the web repo, then ship an OTA update.

export type CupLabelPaperMode = 'text-40x30' | 'photo-50x80'

function currentPaperMode(): CupLabelPaperMode {
  return 'photo-50x80'
}

export const PHOTO_LABELS_OFFLINE = currentPaperMode() !== 'photo-50x80'

export const PHOTO_LABELS_OFFLINE_NOTICE =
  'Photo & custom cup labels are taking a short break — back in about two weeks. ' +
  'Your cups will get a clear label with your order number and drink details instead.'
