# App preset gallery v1 — port web's 78-PNG preset_sticker manifest

**Date**: 2026-05-21
**Branch**: `feat/cup-label-app-doodle` (HEAD `6a058ff`, 17 commits ahead of main)
**Status**: Spec — pending Stan review

## Context

The Mandy iOS app's cup-label `LabelPicker` Preset tab currently shows 8 hardcoded SVG doodles (`lib/doodle/pool.ts`: bunny, flower, star, cloud, boba_eyes, im_fine, sakura_car, buddha_chill). The web checkout (`mandybubbletea.com`) and admin gallery render a 78-PNG `preset_sticker` library backed by `public/cup-label/gallery/manifest.json`. The mismatch means a customer's preset choice on iPhone has nothing in common with what they see on web or on the printed in-store cup.

This spec ports the web 78-PNG gallery to the app and aligns the data model end-to-end so a preset chosen on iOS lands on the ZD410 cup printer through the same `preset_sticker` enqueue path as web.

## Goals

1. App Preset tab shows the same 78 PNG library as web (manifest-driven).
2. Selection model verbatim-matches web `CupLabelSelection` discriminated union → mobile and web cart/payload code share semantics.
3. Server enqueue receives `presetStickerHashes` (not legacy `doodleDefaults` POOL keys) → cup printer follows the `preset_sticker` branch.
4. Cup gets a deterministic default selection at cart-add time so the user can Pay without entering the picker (mirrors web's server-side tarot draw, but resolved client-side at deterministic-by-lineId hash).
5. Existing flows (Photo, AI, Draw) keep working with zero regression.

## Non-goals

- No remote-fetch fallback for the gallery (locked: bundled).
- No 8-SVG POOL retained as fallback (locked: full delete).
- No OTA push of new gallery additions in v1 — gallery sync ships in JS bundle via `pnpm gallery:sync` + manual `eas update` cadence.
- No POS / Square-side change.
- No web-side change. Web is source-of-truth, app pulls.

## Locked decisions

| # | Decision | Locked value |
|---|----------|--------------|
| 1 | Bundling strategy | Bundle 78 PNG into app `assets/cup-label/gallery/<hash>.png` |
| 2 | Old POOL | Delete entirely |
| 3 | Workflow | superpowers brainstorming → spec → plan → subagent-driven |
| 4 | Selection model | Discriminated union, verbatim copy of `~/Github/mandys_bubble_tea/src/store/cart.ts` `CupLabelSelection` |
| 5 | Sync mechanism | `scripts/sync-preset-gallery.ts` reads local web repo, writes assets + generated manifest module |
| 6 | Cart-add default selection | `{ kind: 'preset', hash: <deterministic by FNV-1a(lineId:cupIdx) mod 78> }` |
| 7 | Pay gate | Any non-undefined `selection` passes; AI `aiDoodleId === null` (pending) still blocks |
| 8 | Asset in git | Commit `assets/cup-label/gallery/*.png` into the app repo |
| 9 | Persisted-cart migration | AsyncStorage schema version bump → detect old `defaultKey` shape → clear `labelSelections` only (cart lines preserved) → re-derive deterministic preset hashes |
| 10 | Sync source | Read local `~/Github/mandys_bubble_tea/public/cup-label/gallery/` |

## Architecture

5 layers + 1 sync script.

```
+--------------------------------------------------+
| scripts/sync-preset-gallery.ts (run on demand)   |
|  reads: ~/Github/mandys_bubble_tea/public/...    |
|  writes: assets/cup-label/gallery/<hash>.png     |
|          lib/doodle/gallery-manifest.generated.ts |
+--------------------------------------------------+
                    |
                    v
+--------------------------------------------------+
| Data layer                                       |
|  GALLERY_MANIFEST: Record<string, number>        |
|  GALLERY_HASHES: string[]                        |
+--------------------------------------------------+
                    |
                    v
+--------------------------------------------------+
| Selection model (store/cart.ts)                  |
|  CupLabelSelection discriminated union           |
|  labelSelections: Record<cupKey, Selection>      |
|  setLabel / clearLabel                           |
|  AsyncStorage version=2 migration                |
+--------------------------------------------------+
                    |
                    v
+--------------------------------------------------+
| cartToSlots derive — UI iteration only           |
|  DoodleSlot = { lineId, cupIdx, cupKey,          |
|                 drinkName, selection }           |
+--------------------------------------------------+
                    |
                    v
+--------------------------------------------------+
| UI: DoodleModal preset tab + DoodleSection row   |
|  4-col FlatList of GALLERY_HASHES with           |
|  <Image source={GALLERY_MANIFEST[hash]} />       |
+--------------------------------------------------+
                    |
                    v
+--------------------------------------------------+
| Cart payload (hooks/use-payment.ts)              |
|  presetStickerHashes, uploadedDoodleIds,         |
|  aiDoodleIds, userDoodleIds                      |
+--------------------------------------------------+
```

## Detail by layer

### 1. Sync script (`scripts/sync-preset-gallery.ts`)

Run via `pnpm gallery:sync`. Inputs:
- `WEB_REPO_PATH` env override (default `~/Github/mandys_bubble_tea`).

Steps:
1. Read `<webRepo>/public/cup-label/gallery/manifest.json` → list of 78 hashes.
2. For each hash, copy `<webRepo>/public/cup-label/gallery/<hash>/preview.png` → `assets/cup-label/gallery/<hash>.png` (overwrites if changed; compares SHA-256 to skip noop copies).
3. Write `lib/doodle/gallery-manifest.generated.ts`:
   ```ts
   // @generated by scripts/sync-preset-gallery.ts on <ISO date>
   // DO NOT EDIT — run `pnpm gallery:sync` to regenerate
   import type { ImageSourcePropType } from 'react-native';

   export const GALLERY_MANIFEST: Record<string, ImageSourcePropType> = {
     '0a9461b3dcac852906537057ca2edfd3': require('../assets/cup-label/gallery/0a9461b3dcac852906537057ca2edfd3.png'),
     // ... 77 more
   };
   export const GALLERY_HASHES: string[] = Object.keys(GALLERY_MANIFEST);
   ```
4. Run `prettier --write` on the generated file.
5. Print summary: `<n> hashes synced, <m> changed, <k> identical`.

Exit codes: 0 success, 1 web repo missing, 2 manifest malformed, 3 asset copy failed.

### 2. Selection model (`store/cart.ts`)

Add types verbatim from web `~/Github/mandys_bubble_tea/src/store/cart.ts`:

`SvgPath` (currently exported from `lib/doodle/cartToSlots.ts`) moves to a new `lib/doodle/types.ts` so the selection union doesn't depend on a file scheduled for rewrite:

```ts
// lib/doodle/types.ts (new)
export type SvgPath = { d: string; stroke: string; width: number };
```

```ts
// store/cart.ts
import type { SvgPath } from '@/lib/doodle/types';

export type CupLabelSelection =
  | { kind: 'preset'; hash: string }
  | { kind: 'photo'; uploadedDoodleId: string; previewUrl: string }
  | { kind: 'draw'; userDoodleId: string | null; pathCount: number; paths: SvgPath[] }
  | { kind: 'ai'; aiDoodleId: string | null; prompt: string; previewUri?: string };

// Cup key: `${lineId}:${cupIdx}` (single colon — same as web slotKey)
export function cupKey(lineId: string, cupIdx: number): string {
  return `${lineId}:${cupIdx}`;
}
```

Cart state additions:
- `labelSelections: Record<string, CupLabelSelection>`
- `setLabel(cupKey: string, selection: CupLabelSelection)`
- `clearLabel(cupKey: string)`
- On `clear()`: `labelSelections = {}`.
- On line removal: prune `labelSelections` entries whose key prefix matches the removed `lineId`.

Persist version: bump zustand `persist` config `version: 2 → 3` (current cart.ts is at v2) + `migrate` callback that:
- If old state has any `DoodleSlot.defaultKey` shape anywhere (probe one indicator field), drop `labelSelections`; recompute deterministic preset hashes on next `cartToSlots` call.
- Preserve `lines` and `cartSessionId`.

### 3. Default selection (cart-add)

`cartToSlots` (renamed responsibility — now derives view rows from cart state, doesn't create model):

```ts
import { pickDeterministicHash } from '@/lib/doodle/preset-default';
import { useCart } from '@/store/cart';

export function cartToSlots(items: CartItem[], selections: Record<string, CupLabelSelection>): DoodleSlot[] {
  const out: DoodleSlot[] = [];
  for (const item of items) {
    for (let cupIdx = 0; cupIdx < item.quantity; cupIdx++) {
      const k = cupKey(item.lineId, cupIdx);
      const selection = selections[k] ?? { kind: 'preset' as const, hash: pickDeterministicHash(item.lineId, cupIdx) };
      out.push({ lineId: item.lineId, cupIdx, cupKey: k, drinkName: item.name, selection });
    }
  }
  return out;
}
```

`pickDeterministicHash(lineId, cupIdx)`:
- FNV-1a 32-bit hash of `${lineId}:${cupIdx}` (32-bit unsigned int).
- `GALLERY_HASHES[hashed % GALLERY_HASHES.length]`.
- Test: same input → same output across processes / reloads.

⚠️ Stan-confirmed semantic: app picks default deterministically client-side rather than mirroring web's per-checkout shuffle-deck server algorithm. Server enqueue receives the app-chosen hash and skips `drawTarot` for that cup.

### 4. Cart payload (`hooks/use-payment.ts`)

New `PaymentParams` shape:

```ts
interface PaymentParams {
  sourceId?: string;
  orderId: string;
  verificationToken?: string;
  presetStickerHashes?: Record<string, string>;  // NEW — replaces doodleDefaults
  uploadedDoodleIds?: Record<string, string>;    // renamed from doodleIds
  aiDoodleIds?: Record<string, string>;
  userDoodleIds?: Record<string, string>;        // NEW — for draw kind
}
```

New helper `lib/doodle/build-payment-selections.ts`:

```ts
export function buildPaymentSelections(
  selections: Record<string, CupLabelSelection>,
): Pick<PaymentParams, 'presetStickerHashes' | 'uploadedDoodleIds' | 'aiDoodleIds' | 'userDoodleIds'> {
  const presetStickerHashes: Record<string, string> = {};
  const uploadedDoodleIds: Record<string, string> = {};
  const aiDoodleIds: Record<string, string> = {};
  const userDoodleIds: Record<string, string> = {};
  for (const [k, s] of Object.entries(selections)) {
    switch (s.kind) {
      case 'preset': presetStickerHashes[k] = s.hash; break;
      case 'photo': uploadedDoodleIds[k] = s.uploadedDoodleId; break;
      case 'ai': if (s.aiDoodleId) aiDoodleIds[k] = s.aiDoodleId; break;
      case 'draw': if (s.userDoodleId) userDoodleIds[k] = s.userDoodleId; break;
    }
  }
  return { presetStickerHashes, uploadedDoodleIds, aiDoodleIds, userDoodleIds };
}
```

`app/checkout.tsx` builds payload via `buildPaymentSelections(useCart.getState().labelSelections)` and passes to `usePayment.pay()`.

Backwards compat: server `/api/payment` route on web already accepts `presetStickerHashes` per `~/Github/mandys_bubble_tea/src/app/api/payment/route.ts` (web ships this). No web-side change needed.

### 5. Pay gate

`app/checkout.tsx` gate (key-aware, not count-aware — count parity is necessary but not sufficient):
```ts
const slots = cartToSlots(items, labelSelections);
const allLabeled = slots.every(slot => {
  const s = labelSelections[slot.cupKey];
  if (!s) return false;                                    // unlabeled cup
  if (s.kind === 'ai' && s.aiDoodleId === null) return false; // AI submit pending
  if (s.kind === 'draw' && s.userDoodleId === null) return false; // draw upload pending
  return true;
});
```
- Empty cart-add deterministic default fills all cups → on first paint `allLabeled` is true with all-preset.
- AI submit fire-and-forget keeps `aiDoodleId: null` until server replies → gate blocks Pay during that window (matches web v2).

### 6. UI changes

#### `components/doodle/DoodleModal.tsx`
- Remove `import { POOL } from '@/lib/doodle/pool'` + `import { SvgXml } from 'react-native-svg'` (still needed for draw preview elsewhere — check).
- Preset tab body: `FlatList` (or 4-col `View flex-wrap` if <100 items; 78 is fine without virtualization but use FlatList for memory hygiene):
  ```tsx
  <FlatList
    data={GALLERY_HASHES}
    numColumns={4}
    keyExtractor={h => h}
    renderItem={({ item: hash }) => {
      const selected = slot.selection?.kind === 'preset' && slot.selection.hash === hash;
      return (
        <Pressable onPress={() => handlePickPreset(hash)} style={[styles.presetTile, selected && styles.presetTileActive]}>
          <Image source={GALLERY_MANIFEST[hash]} style={{ width: '100%', height: '100%' }} contentFit="contain" />
        </Pressable>
      );
    }}
  />
  ```
- `handlePickPreset(hash: string)` → `setLabel(cupKey, { kind: 'preset', hash })`; auto-close modal (UX consistent with photo/ai close-on-select).

#### `components/doodle/DoodleSection.tsx`
Per cup row, derive thumbnail by `selection.kind`:
- `preset` → `<Image source={GALLERY_MANIFEST[selection.hash]} />`
- `photo` → `<Image source={{ uri: selection.previewUrl }} />`
- `ai` with `previewUri` → `<Image source={{ uri: selection.previewUri }} />`
- `ai` pending (no previewUri) → grey spinner placeholder
- `draw` → `<SvgPaths paths={selection.paths} />` mini-canvas render

### 7. Deletion list

Files removed:
- `lib/doodle/pool.ts`
- `lib/doodle/pool.test.ts`

Code removed:
- `cartToSlots.ts`: 8 flat fields (`defaultKey`, `userPaths`, `aiDoodleId`, `aiPreviewUrl`, `aiPrompt`, `aiSourceDataUri`, `aiSourceLocalUri`, `uploadedDoodleId`, `uploadedPreviewUrl`)
- `hooks/use-payment.ts`: `doodleDefaults` field; rename `doodleIds → uploadedDoodleIds`
- All `pickDefaultForCup` imports app-wide
- All `POOL` imports app-wide

### 8. Tests

New / updated test files:

1. **`lib/doodle/gallery-manifest.generated.test.ts`** — assert manifest exposes ≥ 78 hashes and each `require` returns non-null (smoke for build-time inclusion).
2. **`lib/doodle/preset-default.test.ts`** — FNV-1a deterministic, distribution check (sample 10 lineIds × 3 cupIdx, no all-same-hash, every hash in `GALLERY_HASHES`).
3. **`lib/doodle/build-payment-selections.test.ts`** — 5 cases:
   - all preset → only `presetStickerHashes` populated
   - mixed kinds → 4 maps each populated correctly
   - AI pending (`aiDoodleId === null`) → not in `aiDoodleIds`
   - draw without `userDoodleId` → not in `userDoodleIds`
   - empty selections → all 4 maps empty
4. **`store/cart-selection.test.ts`** — setLabel / clearLabel / clear() wipes / removeLine prunes prefix.
5. **`store/cart-migration.test.ts`** — old-shape state with `defaultKey` triggers migration v1→v2; lines kept, labelSelections cleared.
6. **`scripts/sync-preset-gallery.test.ts`** — mock fs + path; verifies copy plan + generated module format.
7. **`components/doodle/DoodleModal.test.tsx`** (light) — preset tab renders 78 tiles + tap dispatches setLabel.

Existing tests retired:
- `lib/doodle/pool.test.ts` — deleted with `pool.ts`.
- `lib/doodle/cartToSlots.test.ts` — rewrite asserting new `selection` shape + deterministic default.

### 9. Migration plan (already-installed app)

- Bump zustand persist version: `version: 2` → `version: 3`.
- `migrate(persisted: unknown, version): CartState`:
  - If `version < 3`: drop any persisted `labelSelections` (old shape was per-`DoodleSlot` flat fields not the union); keep `lines`, `cartSessionId`, drawer state. `cartToSlots` re-fills with deterministic preset hashes on next render.
  - Old `aiDoodleId/uploadedDoodleId` etc. in transit: since these were per-slot (transient), no separate cleanup needed — they live in `DoodleSlot`, not `CartLine`.

### 10. Build / CI integration

- `pnpm gallery:sync` runs manually before commits that intend to refresh gallery. Not wired to `prebuild` or `start` — keeps Metro launch fast.
- `assets/cup-label/gallery/*.png` committed to git.
- Recommend a CI guard (lint script `lib/doodle/gallery-manifest.generated.ts` exists + matches assets/) in follow-up; not in v1 scope.

## Risks

1. **Asset bundle size**: 78 × ~10-50KB PNG = ~1-4MB. Doesn't materially affect IPA size but worth measuring. Mitigation: if >5MB, downscale preview.png with sharp in the sync script.
2. **`require()` resolution at build time**: Metro statically analyzes `require(literal)` only. The generated file must use literal string paths. Sync script enforces this format.
3. **Web manifest schema drift**: If web changes `manifest.json` shape (currently `{ hashes: string[] }`), sync script breaks. Mitigation: zod-validate manifest at sync time; sync exits 2 on shape mismatch.
4. **Hash collision in deterministic picker**: FNV-1a 32-bit % 78 has uneven distribution. Acceptable — perfect uniformity not required; pseudo-random distribution is enough for default sticker variety.
5. **Web 8-SVG POOL still has consumers on server enqueue path** (`pickPool()` fallback). Server-side change not in scope. App sends `presetStickerHashes` directly → bypasses POOL fallback. The 8-SVG fallback stays as last-resort if both `presetStickerHashes` and `drawTarot` fail.

## Out of scope follow-ups

- OTA-push gallery additions (currently manual `pnpm gallery:sync && eas update`).
- Gallery preview thumbnail downscaling beyond what web ships.
- Remote-fetch fallback for offline-bootstrap-then-cache pattern.
- Migrating Android app (only iOS is in scope per this branch's release plan).
- Per-cup gallery analytics ("which preset chosen how often").
- POOL 8-SVG retirement from web server side.

## Open questions

None — all 10 lock points resolved during brainstorming.

## Acceptance criteria

1. `pnpm gallery:sync` runs clean and produces 78 PNG + generated manifest module.
2. App Preset tab shows 78 thumbnails in 4-col grid, tap → cup row updates with chosen hash.
3. Cart-add deterministically fills `selection: { kind: 'preset', hash: ... }` for every new cup.
4. Checkout POSTs `presetStickerHashes` to `/api/payment`; no `doodleDefaults` in payload.
5. Test cup-label real-line: ZD410 prints the chosen preset PNG via `preset_sticker` enqueue path.
6. Existing Photo, AI, Draw flows work unchanged in app — visible regression none.
7. Old persisted cart state from current build migrates without crash on app upgrade.

## Files touched (estimate)

| File | Action |
|------|--------|
| `scripts/sync-preset-gallery.ts` | new |
| `scripts/sync-preset-gallery.test.ts` | new |
| `assets/cup-label/gallery/*.png` | new × 78 |
| `lib/doodle/gallery-manifest.generated.ts` | generated, new |
| `lib/doodle/preset-default.ts` | new |
| `lib/doodle/preset-default.test.ts` | new |
| `lib/doodle/build-payment-selections.ts` | new |
| `lib/doodle/build-payment-selections.test.ts` | new |
| `lib/doodle/pool.ts` | delete |
| `lib/doodle/pool.test.ts` | delete |
| `lib/doodle/cartToSlots.ts` | rewrite |
| `lib/doodle/cartToSlots.test.ts` | rewrite |
| `store/cart.ts` | extend + version bump + migrate |
| `store/cart-selection.test.ts` | new |
| `store/cart-migration.test.ts` | new |
| `components/doodle/DoodleModal.tsx` | preset tab rewrite |
| `components/doodle/DoodleModal.test.tsx` | new |
| `components/doodle/DoodleSection.tsx` | row thumbnail rewrite |
| `hooks/use-payment.ts` | payload shape |
| `app/checkout.tsx` | pay gate + payload build |
| `lib/doodle/types.ts` | new — SvgPath moved here |
| `lib/doodle/uploadDoodle.ts` | update SvgPath import path |
| `package.json` | `gallery:sync` script |

~21 files / ~80 PNG assets / ~1.5K-2K LOC net.
