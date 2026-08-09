# App preset gallery v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port web's 78-PNG `preset_sticker` gallery into the Mandy iOS app so Preset tab choice end-to-end matches web (selection model, cart payload, server enqueue route).

**Architecture:** Bundled assets via codegen `gallery-manifest.generated.ts` (78 `require(...)` statics) populated by `scripts/sync-preset-gallery.ts` reading the local web repo. Cart adopts web's `CupLabelSelection` discriminated union; cart-add auto-fills `{ kind: 'preset', hash: <FNV1a(lineId:cupIdx) mod 78> }` as deterministic default. Pay-time builder splits `labelSelections` into `presetStickerHashes / uploadedDoodleIds / aiDoodleIds / userDoodleIds` posted to `/api/payment`. Old 8-SVG `POOL` deleted.

**Tech Stack:** TypeScript strict / React Native (Expo SDK 54) / zustand persist + AsyncStorage / Jest 29 jest-expo / expo-image / Metro require for static assets.

**Spec:** `docs/superpowers/specs/2026-05-21-app-preset-gallery.md`

**Branch:** `feat/cup-label-app-doodle` (HEAD `6a058ff`, 17 commits ahead of main). Continue on this branch — do NOT create a sub-branch.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `lib/doodle/types.ts` (new) | Shared types — `SvgPath` re-export home (was in `cartToSlots.ts`) |
| `lib/doodle/preset-default.ts` (new) | FNV-1a deterministic `pickDeterministicHash(lineId, cupIdx)` |
| `lib/doodle/preset-default.test.ts` (new) | Tests for determinism, distribution, gallery membership |
| `lib/doodle/build-payment-selections.ts` (new) | Pure fn: `labelSelections` → 4 payment maps |
| `lib/doodle/build-payment-selections.test.ts` (new) | 5 case scenarios |
| `lib/doodle/gallery-manifest.generated.ts` (generated) | `{ hash: require(...) }` 78-entry map + `GALLERY_HASHES` |
| `lib/doodle/gallery-manifest.generated.test.ts` (new) | Smoke — 78 entries + non-null requires |
| `scripts/sync-preset-gallery.ts` (new) | Sync 78 PNG + regenerate manifest module |
| `scripts/sync-preset-gallery.test.ts` (new) | Unit: copy-plan + emitted module format |
| `assets/cup-label/gallery/*.png` (78 new files, generated) | Bundled preview images |
| `store/cart.ts` (modify) | Add `CupLabelSelection` union + `labelSelections` + actions + persist v3 migrate |
| `store/cart-selection.test.ts` (new) | setLabel / clearLabel / clear / removeLine pruning |
| `store/cart-migration.test.ts` (new) | v2 → v3 migrate drops labelSelections, keeps lines |
| `lib/doodle/cartToSlots.ts` (rewrite) | `DoodleSlot` now `{ ..., selection }`; reads `labelSelections` + defaults |
| `lib/doodle/cartToSlots.test.ts` (rewrite) | New tests for selection-driven slots |
| `components/doodle/DoodleModal.tsx` (modify) | Preset tab uses FlatList of 78 PNG; remove POOL/SvgXml-for-preset |
| `components/doodle/DoodleSection.tsx` (modify) | Row thumbnail by `selection.kind` |
| `hooks/use-payment.ts` (modify) | New `PaymentParams` field set |
| `app/checkout.tsx` (modify) | Pay gate (key-aware) + `buildPaymentSelections` call |
| `lib/doodle/uploadDoodle.ts` (modify) | Import `SvgPath` from `lib/doodle/types` |
| `lib/doodle/pool.ts` (delete) | 8-SVG POOL retired |
| `lib/doodle/pool.test.ts` (delete) | Retired with pool.ts |
| `package.json` (modify) | Add `"gallery:sync"` script |

**Files-touched: ~22 source + 78 PNG assets. Net additions ~1.2K LOC, deletions ~0.3K LOC.**

---

## Task 1: Move `SvgPath` to dedicated types module

**Files:**
- Create: `lib/doodle/types.ts`
- Modify: `lib/doodle/cartToSlots.ts` (will be fully rewritten in Task 9; this task just re-imports SvgPath)
- Modify: `lib/doodle/uploadDoodle.ts:2`

Rationale: `CupLabelSelection` (Task 3) references `SvgPath`. We move it now so the type stays stable while `cartToSlots.ts` is mid-rewrite.

- [ ] **Step 1: Create `lib/doodle/types.ts`**

```ts
// lib/doodle/types.ts
// Shared doodle types. Imported by cart/selection/payload modules so we
// can rewrite cartToSlots without breaking these types' consumers.

export type SvgPath = { d: string; stroke: string; width: number }
```

- [ ] **Step 2: Update `lib/doodle/uploadDoodle.ts:2`**

Change line 2 from:
```ts
import type { SvgPath } from './cartToSlots'
```
to:
```ts
import type { SvgPath } from './types'
```

- [ ] **Step 3: Re-export `SvgPath` from `cartToSlots.ts` for transient back-compat**

Edit `lib/doodle/cartToSlots.ts` line 4 from:
```ts
export type SvgPath = { d: string; stroke: string; width: number }
```
to:
```ts
export type { SvgPath } from './types'
```

(This keeps any existing consumers we may have missed compiling. Task 9 will delete this re-export when `cartToSlots.ts` is fully rewritten.)

- [ ] **Step 4: Run typecheck**

```bash
cd ~/Github/mandys_bubble_tea_app && npx tsc --noEmit
```
Expected: existing baseline errors only (none introduced).

- [ ] **Step 5: Commit**

```bash
git add lib/doodle/types.ts lib/doodle/cartToSlots.ts lib/doodle/uploadDoodle.ts
git commit -m "refactor(doodle): move SvgPath to lib/doodle/types.ts"
```

---

## Task 2: `pickDeterministicHash` — FNV-1a default-selection picker

**Files:**
- Create: `lib/doodle/preset-default.ts`
- Test: `lib/doodle/preset-default.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/doodle/preset-default.test.ts
import { pickDeterministicHash, fnv1a32 } from './preset-default'

const GALLERY_HASHES = [
  '0a9461b3dcac852906537057ca2edfd3',
  '0c6e25241c77325c567263ce68292cd9',
  '0cbec725b49891337dbb897c29a06fdf',
  '174f4fe0beb8335332d7824449bb9bab',
]

describe('fnv1a32', () => {
  it('returns 0x811c9dc5 for empty string', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5)
  })
  it('is deterministic for the same input', () => {
    expect(fnv1a32('a:b')).toBe(fnv1a32('a:b'))
  })
  it('differs on different inputs', () => {
    expect(fnv1a32('a:0')).not.toBe(fnv1a32('a:1'))
  })
})

describe('pickDeterministicHash', () => {
  it('returns a hash from the provided pool', () => {
    const hash = pickDeterministicHash('LINE_A', 0, GALLERY_HASHES)
    expect(GALLERY_HASHES).toContain(hash)
  })
  it('is deterministic across calls', () => {
    const a = pickDeterministicHash('LINE_X', 2, GALLERY_HASHES)
    const b = pickDeterministicHash('LINE_X', 2, GALLERY_HASHES)
    expect(a).toBe(b)
  })
  it('different cupIdx produces (usually) different hashes', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) seen.add(pickDeterministicHash('SAME_LINE', i, GALLERY_HASHES))
    expect(seen.size).toBeGreaterThan(1)
  })
  it('throws when pool empty', () => {
    expect(() => pickDeterministicHash('x', 0, [])).toThrow(/empty/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/doodle/preset-default.test.ts
```
Expected: FAIL — `Cannot find module './preset-default'`.

- [ ] **Step 3: Implement `preset-default.ts`**

```ts
// lib/doodle/preset-default.ts
//
// Deterministically pick a default preset hash for a cup based on its
// `${lineId}:${cupIdx}` identity. Same cup row → same hash across app
// reloads, so users see a stable default sticker before they open the
// label picker. Mirrors server-side `pickDefaultForCup` semantics from
// the web codebase but bound to the 78-PNG gallery pool, not the legacy
// 8-SVG POOL.

const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

export function fnv1a32(input: string): number {
  let h = FNV_OFFSET
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, FNV_PRIME) >>> 0
  }
  return h >>> 0
}

export function pickDeterministicHash(
  lineId: string,
  cupIdx: number,
  pool: readonly string[],
): string {
  if (pool.length === 0) {
    throw new Error('pickDeterministicHash: pool is empty')
  }
  const idx = fnv1a32(`${lineId}:${cupIdx}`) % pool.length
  return pool[idx]!
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/doodle/preset-default.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/doodle/preset-default.ts lib/doodle/preset-default.test.ts
git commit -m "feat(doodle): pickDeterministicHash for cup default preset"
```

---

## Task 3: `CupLabelSelection` union + cart actions in `store/cart.ts`

**Files:**
- Modify: `store/cart.ts`
- Test: `store/cart-selection.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// store/cart-selection.test.ts
import { renderHook, act } from '@testing-library/react-native'
import { useCart, cupKey } from './cart'

const baseLine = {
  id: 'ITEM1',
  variationId: 'VAR1',
  name: 'Pearl Milk Tea',
  price: 800,
  modifiers: [] as never[],
}

beforeEach(() => {
  useCart.setState({ lines: [], labelSelections: {}, isOpen: false, hydrated: true })
})

describe('useCart label selections', () => {
  it('setLabel writes a selection at cupKey', () => {
    const { result } = renderHook(() => useCart())
    act(() => result.current.setLabel('LINE_A:0', { kind: 'preset', hash: 'abc' }))
    expect(useCart.getState().labelSelections['LINE_A:0']).toEqual({ kind: 'preset', hash: 'abc' })
  })

  it('clearLabel removes a selection', () => {
    useCart.setState({ labelSelections: { 'X:0': { kind: 'preset', hash: 'h1' } } })
    const { result } = renderHook(() => useCart())
    act(() => result.current.clearLabel('X:0'))
    expect(useCart.getState().labelSelections['X:0']).toBeUndefined()
  })

  it('clear() wipes labelSelections', () => {
    useCart.setState({ labelSelections: { 'X:0': { kind: 'preset', hash: 'h1' } } })
    const { result } = renderHook(() => useCart())
    act(() => result.current.clear())
    expect(useCart.getState().labelSelections).toEqual({})
  })

  it('removeLine prunes labelSelections matching the lineId prefix', () => {
    useCart.setState({
      lines: [{ ...baseLine, lineId: 'LINE_A', quantity: 2 }],
      labelSelections: {
        'LINE_A:0': { kind: 'preset', hash: 'h1' },
        'LINE_A:1': { kind: 'preset', hash: 'h2' },
        'LINE_B:0': { kind: 'preset', hash: 'h3' },
      },
    })
    const { result } = renderHook(() => useCart())
    act(() => result.current.removeLine('LINE_A'))
    const s = useCart.getState().labelSelections
    expect(s['LINE_A:0']).toBeUndefined()
    expect(s['LINE_A:1']).toBeUndefined()
    expect(s['LINE_B:0']).toEqual({ kind: 'preset', hash: 'h3' })
  })
})

describe('cupKey', () => {
  it('joins lineId and cupIdx with a colon', () => {
    expect(cupKey('LINE_X', 3)).toBe('LINE_X:3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest store/cart-selection.test.ts
```
Expected: FAIL — `cupKey` / `setLabel` / `clearLabel` not exported / `labelSelections` undefined.

- [ ] **Step 3: Extend `store/cart.ts`**

Add near the top (after the existing imports, before `CartState`):

```ts
import type { SvgPath } from '@/lib/doodle/types'

export type CupLabelSelection =
  | { kind: 'preset'; hash: string }
  | { kind: 'photo'; uploadedDoodleId: string; previewUrl: string }
  | { kind: 'draw'; userDoodleId: string | null; pathCount: number; paths: SvgPath[] }
  | { kind: 'ai'; aiDoodleId: string | null; prompt: string; previewUri?: string }

/** Per-cup key. lineId is `signatureFor` output (uses `::` internally), so
 *  single-colon separator stays unambiguous and matches web server `slotKey`. */
export function cupKey(lineId: string, cupIdx: number): string {
  return `${lineId}:${cupIdx}`
}
```

In `CartState` type, add fields:
```ts
labelSelections: Record<string, CupLabelSelection>
setLabel: (cupKey: string, selection: CupLabelSelection) => void
clearLabel: (cupKey: string) => void
```

In the initial state object, add:
```ts
labelSelections: {},
```

In actions, add `setLabel` / `clearLabel`:
```ts
setLabel: (key, selection) =>
  set((s) => ({ labelSelections: { ...s.labelSelections, [key]: selection } })),
clearLabel: (key) =>
  set((s) => {
    const next = { ...s.labelSelections }
    delete next[key]
    return { labelSelections: next }
  }),
```

Update existing `clear` action — find the existing `clear: () => set({ ... })` and add `labelSelections: {}`.

Update existing `removeLine` action — find it and add label pruning. Final shape:
```ts
removeLine: (lineId) =>
  set((s) => {
    const nextSelections: Record<string, CupLabelSelection> = {}
    for (const [k, v] of Object.entries(s.labelSelections)) {
      if (!k.startsWith(`${lineId}:`)) nextSelections[k] = v
    }
    return {
      lines: s.lines.filter((l) => l.lineId !== lineId),
      labelSelections: nextSelections,
    }
  }),
```
(If the existing implementation differs, preserve its other side effects — only add the pruning.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest store/cart-selection.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add store/cart.ts store/cart-selection.test.ts
git commit -m "feat(cart): CupLabelSelection union + setLabel/clearLabel actions"
```

---

## Task 4: Bump persist version + migration v2→v3

**Files:**
- Modify: `store/cart.ts` (the `persist` config block, ~line 110-128)
- Test: `store/cart-migration.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// store/cart-migration.test.ts
//
// The persist config's `migrate` function gets called with the v2-on-disk
// state when the app first boots on v3. We assert it preserves lines but
// drops any old per-slot defaultKey shape into a clean labelSelections.

import { createMigrate } from './cart' // we'll export the bare migrate fn for testing

describe('cart persist migration', () => {
  it('v2 state: lines retained, legacy labelSelections (or per-slot defaultKey) wiped', () => {
    const old = {
      lines: [
        { lineId: 'LINE_A', id: 'I1', variationId: 'V1', name: 'X', price: 800, quantity: 1, modifiers: [] },
      ],
      // Pre-v3 had no labelSelections; we just need migration to not crash
      // and to leave us with an empty labelSelections.
      cartSessionId: 'sess-old',
      isOpen: false,
      hydrated: true,
    }
    const migrated = createMigrate(old, 2)
    expect(migrated.lines).toHaveLength(1)
    expect(migrated.lines[0]!.lineId).toBe('LINE_A')
    expect(migrated.labelSelections).toEqual({})
    expect(migrated.cartSessionId).toBe('sess-old')
  })

  it('v2 state with legacy items field migrates per existing v2 logic AND adds labelSelections', () => {
    const old = {
      items: [
        { id: 'I1', variationId: 'V1', name: 'X', price: 800, quantity: 1, modifiers: [] },
      ],
    }
    const migrated = createMigrate(old, 1)
    expect(migrated.lines).toHaveLength(1)
    expect(migrated.lines[0]!.lineId).toBeDefined()
    expect(migrated.labelSelections).toEqual({})
  })

  it('current-version (v3) state passes through with labelSelections preserved', () => {
    const current = {
      lines: [],
      labelSelections: { 'X:0': { kind: 'preset' as const, hash: 'abc' } },
      cartSessionId: 'sess',
      isOpen: false,
      hydrated: true,
    }
    const migrated = createMigrate(current, 3)
    expect(migrated.labelSelections).toEqual({ 'X:0': { kind: 'preset', hash: 'abc' } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest store/cart-migration.test.ts
```
Expected: FAIL — `createMigrate` not exported.

- [ ] **Step 3: Refactor `store/cart.ts` persist `migrate` + version**

Find the current `migrate: (state: unknown) => { ... }` block and the trailing `version: 2,`. Replace with:

```ts
// Exported as a free function so unit tests can exercise migration without
// spinning up zustand+AsyncStorage. Keeps existing v1→v2 normalization
// (legacy `items` → `lines` with synthesized lineId) AND adds the v2→v3
// step (introduce empty labelSelections; old per-slot defaultKey lived in
// transient DoodleSlot not persisted state, so nothing to migrate from).
export function createMigrate(state: unknown, fromVersion: number): CartState {
  const s = (state ?? {}) as Partial<CartState> & { items?: Partial<CartItem>[] }

  // v1 → v2 legacy normalization (preserved verbatim).
  let lines: CartItem[]
  if (s.items && !s.lines) {
    lines = s.items.map((i) => {
      const modifiers = (i.modifiers ?? []) as CartModifier[]
      const lineId =
        i.lineId ?? buildLineId(i.variationId ?? '', modifiers)
      return { ...i, modifiers, lineId } as CartItem
    })
  } else {
    lines = (s.lines ?? []) as CartItem[]
  }

  // v2 → v3: labelSelections only exists on v3. Below v3 → start empty.
  const labelSelections =
    fromVersion >= 3 && s.labelSelections ? s.labelSelections : {}

  return {
    lines,
    labelSelections,
    cartSessionId: s.cartSessionId ?? newSessionId(),
    isOpen: false,
    hydrated: true,
    // Actions get re-injected by zustand persist hydration; the cast is safe.
  } as CartState
}
```

Then update the `persist` config block:
```ts
{
  name: 'mandys-cart',
  storage: createJSONStorage(() => AsyncStorage),
  migrate: (state, version) => createMigrate(state, version) as CartState,
  version: 3,
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest store/cart-migration.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full cart test suite to make sure Task 3 still passes**

```bash
npx jest store/cart-selection.test.ts store/cart-migration.test.ts
```
Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add store/cart.ts store/cart-migration.test.ts
git commit -m "feat(cart): persist v3 migration + exported createMigrate"
```

---

## Task 5: Sync script — `scripts/sync-preset-gallery.ts`

**Files:**
- Create: `scripts/sync-preset-gallery.ts`
- Test: `scripts/sync-preset-gallery.test.ts`
- Modify: `package.json` (add npm script)

- [ ] **Step 1: Write the failing test**

```ts
// scripts/sync-preset-gallery.test.ts
//
// Pure-function tests: we don't run the script end-to-end against the
// real filesystem. Instead we exercise the planner and the codegen
// formatter directly.

import {
  planSync,
  generateManifestModule,
  type SyncManifest,
} from './sync-preset-gallery'

describe('planSync', () => {
  it('returns one copy per manifest hash', () => {
    const manifest: SyncManifest = { hashes: ['aaa', 'bbb', 'ccc'] }
    const plan = planSync(manifest, '/web/public/cup-label/gallery', '/app/assets/cup-label/gallery')
    expect(plan).toEqual([
      { from: '/web/public/cup-label/gallery/aaa/preview.png', to: '/app/assets/cup-label/gallery/aaa.png', hash: 'aaa' },
      { from: '/web/public/cup-label/gallery/bbb/preview.png', to: '/app/assets/cup-label/gallery/bbb.png', hash: 'bbb' },
      { from: '/web/public/cup-label/gallery/ccc/preview.png', to: '/app/assets/cup-label/gallery/ccc.png', hash: 'ccc' },
    ])
  })

  it('throws on malformed manifest', () => {
    // @ts-expect-error testing bad input
    expect(() => planSync({}, '/x', '/y')).toThrow(/hashes/)
    // @ts-expect-error testing bad input
    expect(() => planSync({ hashes: 'oops' }, '/x', '/y')).toThrow(/array/)
  })
})

describe('generateManifestModule', () => {
  it('emits a 78-entry require map in deterministic key order', () => {
    const out = generateManifestModule(['zzz', 'aaa', 'mmm'])
    // Sorted alphabetically for stable diffs
    const reqLines = out.match(/require\('[^']+'\)/g) ?? []
    expect(reqLines).toEqual([
      "require('../assets/cup-label/gallery/aaa.png')",
      "require('../assets/cup-label/gallery/mmm.png')",
      "require('../assets/cup-label/gallery/zzz.png')",
    ])
  })

  it('declares both GALLERY_MANIFEST and GALLERY_HASHES exports', () => {
    const out = generateManifestModule(['a', 'b'])
    expect(out).toMatch(/export const GALLERY_MANIFEST/)
    expect(out).toMatch(/export const GALLERY_HASHES/)
  })

  it('contains the @generated header', () => {
    const out = generateManifestModule(['a'])
    expect(out).toMatch(/@generated by scripts\/sync-preset-gallery\.ts/)
    expect(out).toMatch(/DO NOT EDIT/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest scripts/sync-preset-gallery.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/sync-preset-gallery.ts`**

```ts
#!/usr/bin/env tsx
// scripts/sync-preset-gallery.ts
//
// Sync the web preset-sticker gallery into the app:
//   1. Read <web-repo>/public/cup-label/gallery/manifest.json
//   2. Copy each <hash>/preview.png to assets/cup-label/gallery/<hash>.png
//   3. Regenerate lib/doodle/gallery-manifest.generated.ts (require map)
//
// Default source: ~/Github/mandys_bubble_tea (override via WEB_REPO_PATH).
// Run via: pnpm gallery:sync

import { promises as fs } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import os from 'node:os'

export type SyncManifest = { hashes: string[] }
export type SyncPlanItem = { from: string; to: string; hash: string }

const APP_ROOT = path.resolve(__dirname, '..')
const ASSETS_DIR = path.join(APP_ROOT, 'assets/cup-label/gallery')
const GENERATED_TS = path.join(APP_ROOT, 'lib/doodle/gallery-manifest.generated.ts')
const DEFAULT_WEB_REPO = path.join(os.homedir(), 'Github/mandys_bubble_tea')

export function planSync(
  manifest: SyncManifest,
  webGalleryDir: string,
  appAssetsDir: string,
): SyncPlanItem[] {
  if (!manifest || !('hashes' in manifest)) {
    throw new Error('manifest missing "hashes" field')
  }
  if (!Array.isArray(manifest.hashes)) {
    throw new Error('manifest.hashes must be an array of strings')
  }
  return manifest.hashes.map((hash) => ({
    from: path.posix.join(webGalleryDir, hash, 'preview.png'),
    to: path.posix.join(appAssetsDir, `${hash}.png`),
    hash,
  }))
}

export function generateManifestModule(hashes: readonly string[]): string {
  const sorted = [...hashes].sort()
  const entries = sorted
    .map((h) => `  '${h}': require('../assets/cup-label/gallery/${h}.png'),`)
    .join('\n')
  const list = sorted.map((h) => `  '${h}',`).join('\n')

  return `// @generated by scripts/sync-preset-gallery.ts on ${new Date().toISOString()}
// DO NOT EDIT — run \`pnpm gallery:sync\` to regenerate
import type { ImageSourcePropType } from 'react-native'

export const GALLERY_MANIFEST: Record<string, ImageSourcePropType> = {
${entries}
}

export const GALLERY_HASHES: readonly string[] = [
${list}
] as const
`
}

async function sha256(file: string): Promise<string> {
  const buf = await fs.readFile(file)
  return createHash('sha256').update(buf).digest('hex')
}

async function copyIfChanged(from: string, to: string): Promise<'copied' | 'unchanged'> {
  try {
    const [fromHash, toHash] = await Promise.all([sha256(from), sha256(to)])
    if (fromHash === toHash) return 'unchanged'
  } catch {
    // dest missing → fall through to copy
  }
  await fs.copyFile(from, to)
  return 'copied'
}

async function main(): Promise<void> {
  const webRepo = process.env.WEB_REPO_PATH ?? DEFAULT_WEB_REPO
  const webGallery = path.join(webRepo, 'public/cup-label/gallery')
  const manifestPath = path.join(webGallery, 'manifest.json')

  let manifest: SyncManifest
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
  } catch (e) {
    console.error(`[sync-preset-gallery] failed to read manifest at ${manifestPath}`)
    console.error(e)
    process.exit(1)
  }

  await fs.mkdir(ASSETS_DIR, { recursive: true })

  const plan = planSync(manifest, webGallery, ASSETS_DIR)
  let copied = 0
  let unchanged = 0
  for (const item of plan) {
    const result = await copyIfChanged(item.from, item.to)
    if (result === 'copied') copied++
    else unchanged++
  }

  await fs.writeFile(GENERATED_TS, generateManifestModule(manifest.hashes), 'utf8')

  console.log(`[sync-preset-gallery] ${manifest.hashes.length} hashes synced — ${copied} copied, ${unchanged} unchanged`)
  console.log(`[sync-preset-gallery] regenerated ${path.relative(APP_ROOT, GENERATED_TS)}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest scripts/sync-preset-gallery.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Add `gallery:sync` npm script**

Edit `package.json` `scripts` block. Add line (alphabetized):
```json
    "gallery:sync": "tsx scripts/sync-preset-gallery.ts",
```

Verify `tsx` is already installed:
```bash
npx tsx --version
```
If missing:
```bash
npm install --save-dev tsx
```

- [ ] **Step 6: Commit**

```bash
git add scripts/sync-preset-gallery.ts scripts/sync-preset-gallery.test.ts package.json package-lock.json
git commit -m "feat(scripts): sync-preset-gallery — copies 78 PNG + regenerates manifest"
```

---

## Task 6: Run sync — populate assets + generate manifest module

**Files:**
- Create: `assets/cup-label/gallery/*.png` (78 files)
- Create: `lib/doodle/gallery-manifest.generated.ts`

- [ ] **Step 1: Run the sync script**

```bash
cd ~/Github/mandys_bubble_tea_app && npm run gallery:sync
```
Expected output:
```
[sync-preset-gallery] 78 hashes synced — 78 copied, 0 unchanged
[sync-preset-gallery] regenerated lib/doodle/gallery-manifest.generated.ts
```

- [ ] **Step 2: Verify asset count**

```bash
ls assets/cup-label/gallery/ | wc -l
```
Expected: `78`

- [ ] **Step 3: Verify manifest module shape**

```bash
head -20 lib/doodle/gallery-manifest.generated.ts
wc -l lib/doodle/gallery-manifest.generated.ts
```
Expected: file exists, ~165 lines (78 require entries + 78 list entries + header).

- [ ] **Step 4: Typecheck the generated module compiles**

```bash
npx tsc --noEmit
```
Expected: existing baseline errors only.

- [ ] **Step 5: Commit assets + generated module**

```bash
git add assets/cup-label/gallery/ lib/doodle/gallery-manifest.generated.ts
git commit -m "chore(assets): bundle 78 preset-sticker PNGs + generated manifest"
```

---

## Task 7: Smoke test the generated manifest module

**Files:**
- Test: `lib/doodle/gallery-manifest.generated.test.ts`

- [ ] **Step 1: Write the test**

```ts
// lib/doodle/gallery-manifest.generated.test.ts
import { GALLERY_MANIFEST, GALLERY_HASHES } from './gallery-manifest.generated'

describe('gallery-manifest.generated', () => {
  it('exports exactly 78 hashes', () => {
    expect(GALLERY_HASHES).toHaveLength(78)
  })

  it('GALLERY_MANIFEST and GALLERY_HASHES are aligned 1:1', () => {
    expect(Object.keys(GALLERY_MANIFEST).sort()).toEqual([...GALLERY_HASHES].sort())
  })

  it('every entry is a non-null require() result', () => {
    for (const hash of GALLERY_HASHES) {
      const src = GALLERY_MANIFEST[hash]
      expect(src).toBeTruthy()
    }
  })

  it('hashes are 32-char lowercase hex (md5-ish)', () => {
    for (const hash of GALLERY_HASHES) {
      expect(hash).toMatch(/^[0-9a-f]{32}$/)
    }
  })
})
```

- [ ] **Step 2: Run test**

```bash
npx jest lib/doodle/gallery-manifest.generated.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 3: Commit**

```bash
git add lib/doodle/gallery-manifest.generated.test.ts
git commit -m "test(doodle): smoke-test generated gallery manifest"
```

---

## Task 8: `buildPaymentSelections` — selections → 4 payment maps

**Files:**
- Create: `lib/doodle/build-payment-selections.ts`
- Test: `lib/doodle/build-payment-selections.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/doodle/build-payment-selections.test.ts
import { buildPaymentSelections } from './build-payment-selections'
import type { CupLabelSelection } from '@/store/cart'

describe('buildPaymentSelections', () => {
  it('all-preset → only presetStickerHashes populated', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'preset', hash: 'h2' },
    })
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1', 'A:1': 'h2' })
    expect(r.uploadedDoodleIds).toEqual({})
    expect(r.aiDoodleIds).toEqual({})
    expect(r.userDoodleIds).toEqual({})
  })

  it('mixed kinds → 4 maps each populated correctly', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'preset', hash: 'h1' },
      'A:1': { kind: 'photo', uploadedDoodleId: 'up-1', previewUrl: 'p1' },
      'B:0': { kind: 'ai', aiDoodleId: 'ai-1', prompt: 'hi' },
      'B:1': { kind: 'draw', userDoodleId: 'd-1', pathCount: 3, paths: [] },
    } as Record<string, CupLabelSelection>)
    expect(r.presetStickerHashes).toEqual({ 'A:0': 'h1' })
    expect(r.uploadedDoodleIds).toEqual({ 'A:1': 'up-1' })
    expect(r.aiDoodleIds).toEqual({ 'B:0': 'ai-1' })
    expect(r.userDoodleIds).toEqual({ 'B:1': 'd-1' })
  })

  it('AI pending (aiDoodleId === null) → not included in aiDoodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'ai', aiDoodleId: null, prompt: 'wait' },
    })
    expect(r.aiDoodleIds).toEqual({})
  })

  it('draw pending (userDoodleId === null) → not included in userDoodleIds', () => {
    const r = buildPaymentSelections({
      'A:0': { kind: 'draw', userDoodleId: null, pathCount: 0, paths: [] },
    })
    expect(r.userDoodleIds).toEqual({})
  })

  it('empty selections → all 4 maps empty', () => {
    const r = buildPaymentSelections({})
    expect(r.presetStickerHashes).toEqual({})
    expect(r.uploadedDoodleIds).toEqual({})
    expect(r.aiDoodleIds).toEqual({})
    expect(r.userDoodleIds).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/doodle/build-payment-selections.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `build-payment-selections.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/doodle/build-payment-selections.test.ts
```
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/doodle/build-payment-selections.ts lib/doodle/build-payment-selections.test.ts
git commit -m "feat(doodle): buildPaymentSelections — split union into 4 maps"
```

---

## Task 9: Rewrite `cartToSlots`

**Files:**
- Modify: `lib/doodle/cartToSlots.ts` (full rewrite — remove old flat fields)
- Modify: `lib/doodle/cartToSlots.test.ts` (full rewrite)

- [ ] **Step 1: Write the failing test (rewrite)**

Overwrite `lib/doodle/cartToSlots.test.ts`:

```ts
// lib/doodle/cartToSlots.test.ts
import { cartToSlots } from './cartToSlots'
import type { CartItem } from '@/types/square'
import type { CupLabelSelection } from '@/store/cart'

const item = (over: Partial<CartItem>): CartItem => ({
  lineId: 'VAR1::MOD_A',
  id: 'ITEM1',
  variationId: 'VAR1',
  name: 'Pearl Milk Tea',
  price: 800,
  quantity: 1,
  modifiers: [],
  ...over,
})

describe('cartToSlots', () => {
  it('expands quantity into one slot per cup', () => {
    const slots = cartToSlots([item({ quantity: 3 })], {})
    expect(slots).toHaveLength(3)
    expect(slots.map((s) => s.cupIdx)).toEqual([0, 1, 2])
  })

  it('produces cupKey = `${lineId}:${cupIdx}` for each slot', () => {
    const slots = cartToSlots([item({ lineId: 'X::Y', quantity: 2 })], {})
    expect(slots.map((s) => s.cupKey)).toEqual(['X::Y:0', 'X::Y:1'])
  })

  it('uses provided selection when present', () => {
    const sel: CupLabelSelection = { kind: 'preset', hash: 'manual-hash' }
    const slots = cartToSlots([item({ lineId: 'A', quantity: 1 })], { 'A:0': sel })
    expect(slots[0]!.selection).toEqual(sel)
  })

  it('fills default preset selection from gallery when none provided', () => {
    const slots = cartToSlots([item({ lineId: 'A', quantity: 1 })], {})
    expect(slots[0]!.selection?.kind).toBe('preset')
    if (slots[0]!.selection?.kind === 'preset') {
      expect(slots[0]!.selection.hash).toMatch(/^[0-9a-f]{32}$/)
    }
  })

  it('default is deterministic by lineId+cupIdx', () => {
    const a = cartToSlots([item({ lineId: 'STABLE', quantity: 1 })], {})
    const b = cartToSlots([item({ lineId: 'STABLE', quantity: 1 })], {})
    expect(a[0]!.selection).toEqual(b[0]!.selection)
  })

  it('different lineIds get (usually) different default hashes', () => {
    const a = cartToSlots([item({ lineId: 'LINE_A', quantity: 1 })], {})
    const b = cartToSlots([item({ lineId: 'LINE_B', quantity: 1 })], {})
    if (a[0]!.selection?.kind === 'preset' && b[0]!.selection?.kind === 'preset') {
      // Could theoretically collide, but for 78 hashes it's overwhelmingly unlikely.
      expect(a[0]!.selection.hash).not.toBe(b[0]!.selection.hash)
    }
  })

  it('drinkName is preserved from cart item', () => {
    const slots = cartToSlots([item({ name: 'Mango Tea' })], {})
    expect(slots[0]!.drinkName).toBe('Mango Tea')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/doodle/cartToSlots.test.ts
```
Expected: FAIL — `selection` undefined, `cupKey` undefined, old fields exist.

- [ ] **Step 3: Rewrite `lib/doodle/cartToSlots.ts`**

Overwrite the file:

```ts
// lib/doodle/cartToSlots.ts
//
// Derive a flat list of cup-level slots from cart lines + persisted
// label selections. Selection-less cups get a deterministic default
// preset hash (mirrors server-side tarot draw, but resolved client-side
// so the cup row UI has something stable to render before the user
// opens the picker).

import type { CartItem } from '@/types/square'
import type { CupLabelSelection } from '@/store/cart'
import { cupKey } from '@/store/cart'
import { pickDeterministicHash } from './preset-default'
import { GALLERY_HASHES } from './gallery-manifest.generated'

export type DoodleSlot = {
  lineId: string
  cupIdx: number
  cupKey: string
  drinkName: string
  selection: CupLabelSelection
}

export function cartToSlots(
  items: CartItem[],
  selections: Record<string, CupLabelSelection>,
): DoodleSlot[] {
  const slots: DoodleSlot[] = []
  for (const item of items) {
    for (let cupIdx = 0; cupIdx < item.quantity; cupIdx++) {
      const k = cupKey(item.lineId, cupIdx)
      const selection: CupLabelSelection =
        selections[k] ?? {
          kind: 'preset',
          hash: pickDeterministicHash(item.lineId, cupIdx, GALLERY_HASHES),
        }
      slots.push({ lineId: item.lineId, cupIdx, cupKey: k, drinkName: item.name, selection })
    }
  }
  return slots
}

export type { SvgPath } from './types' // back-compat re-export
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/doodle/cartToSlots.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 5: Run any downstream tests that touch cartToSlots**

```bash
npx jest lib/doodle/
```
Expected: all PASS (preset-default, build-payment-selections, gallery-manifest.generated, cartToSlots).
**Note:** `lib/doodle/pool.test.ts` may still exist and fail — that's expected; it's deleted in Task 13.

- [ ] **Step 6: Commit**

```bash
git add lib/doodle/cartToSlots.ts lib/doodle/cartToSlots.test.ts
git commit -m "refactor(doodle): cartToSlots now selection-driven with deterministic preset default"
```

---

## Task 10: `usePayment` PaymentParams shape

**Files:**
- Modify: `hooks/use-payment.ts`

- [ ] **Step 1: Update `PaymentParams`**

Current shape (`hooks/use-payment.ts:3-11`):
```ts
interface PaymentParams {
  sourceId?: string
  orderId: string
  verificationToken?: string
  doodleIds?: Record<string, string>
  doodleDefaults?: Record<string, string>
  aiDoodleIds?: Record<string, string>
}
```

Replace with:
```ts
interface PaymentParams {
  sourceId?: string
  orderId: string
  verificationToken?: string
  /** cupKey → hash for preset_sticker selections */
  presetStickerHashes?: Record<string, string>
  /** cupKey → uploadedDoodleId for photo selections */
  uploadedDoodleIds?: Record<string, string>
  /** cupKey → aiDoodleId for AI selections (server-resolved, never null) */
  aiDoodleIds?: Record<string, string>
  /** cupKey → userDoodleId for draw selections (server-resolved, never null) */
  userDoodleIds?: Record<string, string>
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```
Expected: new errors will appear in `app/checkout.tsx` (caller still passing `doodleIds`/`doodleDefaults`) — that's Task 12's fix territory. The error count from `hooks/` itself should be 0 new.

If `app/checkout.tsx` errors are limited to those legacy field names, that's fine to leave for Task 12. If anything else broke, stop and investigate.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-payment.ts
git commit -m "feat(payment): new PaymentParams shape — presetStickerHashes + 3 sibling maps"
```

---

## Task 11: `DoodleModal` preset tab — 78-PNG grid

**Files:**
- Modify: `components/doodle/DoodleModal.tsx`

- [ ] **Step 1: Remove POOL imports + add gallery imports**

In `DoodleModal.tsx` find and remove:
```ts
import { POOL } from '@/lib/doodle/pool'
```
(Note: leave `SvgXml` import — Draw tab still uses it.)

Add near the top:
```ts
import { Image } from 'expo-image'
import { GALLERY_HASHES, GALLERY_MANIFEST } from '@/lib/doodle/gallery-manifest.generated'
```

- [ ] **Step 2: Replace preset tab body**

Find the preset-tab render block (around line 273-291):
```tsx
{viewTab === 'preset' && (
  <View>
    <Text style={styles.sectionHint}>Tap a tile — it prints when no drawing / AI / photo is set.</Text>
    <View style={styles.presetGrid}>
      {POOL.map(item => {
        const selected = slot.defaultKey === item.key
        return (
          <Pressable
            key={item.key}
            onPress={() => handlePickPreset(item.key)}
            style={[styles.presetTile, selected && styles.presetTileActive]}
          >
            <SvgXml xml={item.svg} width="100%" height="100%" />
          </Pressable>
        )
      })}
    </View>
  </View>
)}
```

Replace with:
```tsx
{viewTab === 'preset' && (
  <View>
    <Text style={styles.sectionHint}>Tap a tile to set this cup's label.</Text>
    <View style={styles.presetGrid}>
      {GALLERY_HASHES.map((hash) => {
        const selected = slot.selection.kind === 'preset' && slot.selection.hash === hash
        return (
          <Pressable
            key={hash}
            onPress={() => handlePickPreset(hash)}
            style={[styles.presetTile, selected && styles.presetTileActive]}
          >
            <Image
              source={GALLERY_MANIFEST[hash]}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </Pressable>
        )
      })}
    </View>
  </View>
)}
```

- [ ] **Step 3: Update `handlePickPreset` signature**

Find the existing `handlePickPreset` function in `DoodleModal.tsx`. Current signature takes a POOL key string; new signature takes a hash. Body should call the new cart action:

```ts
const handlePickPreset = useCallback((hash: string) => {
  setLabel(slot.cupKey, { kind: 'preset', hash })
  // Mirror existing close-on-select UX from other tabs
  onClose()
}, [setLabel, slot.cupKey, onClose])
```

(Adjust callbacks to your existing setup — if `onClose` isn't named that, match. If `setLabel` isn't already destructured from `useCart`, add `const setLabel = useCart((s) => s.setLabel)`.)

- [ ] **Step 4: Remove `slot.defaultKey` references**

Search file for any other `slot.defaultKey` / `defaultKey:` references and update to use `slot.selection`. The `slot` shape from Task 9 no longer has `defaultKey`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 new errors in `components/doodle/DoodleModal.tsx`. Errors in other files (checkout, DoodleSection) are still expected — Tasks 12/13.

- [ ] **Step 6: Commit**

```bash
git add components/doodle/DoodleModal.tsx
git commit -m "feat(doodle): DoodleModal preset tab renders 78-PNG gallery"
```

---

## Task 12: `DoodleSection` row thumbnail by `selection.kind`

**Files:**
- Modify: `components/doodle/DoodleSection.tsx`

- [ ] **Step 1: Inspect current row rendering**

```bash
grep -n "defaultKey\|slot\." components/doodle/DoodleSection.tsx | head -20
```
Read the surrounding context for each match to understand the current thumbnail logic.

- [ ] **Step 2: Replace flat-field references with selection union**

For each `slot.defaultKey` / `slot.userPaths` / `slot.aiDoodleId` / `slot.aiPreviewUrl` / `slot.uploadedDoodleId` / `slot.uploadedPreviewUrl` access:

Replace with a `switch (slot.selection.kind)` block. Pattern:

```tsx
import { Image } from 'expo-image'
import { GALLERY_MANIFEST } from '@/lib/doodle/gallery-manifest.generated'

function renderThumb(slot: DoodleSlot) {
  const s = slot.selection
  switch (s.kind) {
    case 'preset':
      return (
        <Image
          source={GALLERY_MANIFEST[s.hash]}
          style={thumbStyle}
          contentFit="contain"
        />
      )
    case 'photo':
      return <Image source={{ uri: s.previewUrl }} style={thumbStyle} contentFit="cover" />
    case 'ai':
      return s.previewUri ? (
        <Image source={{ uri: s.previewUri }} style={thumbStyle} contentFit="cover" />
      ) : (
        <View style={[thumbStyle, styles.thumbPending]}>
          <ActivityIndicator />
        </View>
      )
    case 'draw':
      // Reuse the existing `pathsToInlineSvg` helper already in this file
      // (it mirrors the server's pathsJsonToSvg shape). Wrap with SvgXml.
      return <SvgXml xml={pathsToInlineSvg(s.paths)} width={thumbStyle.width} height={thumbStyle.height} />
  }
}
```

Note: `pathsToInlineSvg` is already defined at `components/doodle/DoodleSection.tsx:17`. Keep it. The current file imports `SvgXml` from `react-native-svg` — keep that import.

- [ ] **Step 3: Verify section renders without throws**

There may be no unit test for `DoodleSection` — that's OK. Run typecheck:
```bash
npx tsc --noEmit
```
Expected: 0 new errors in this file (errors still expected in `app/checkout.tsx` — Task 13).

- [ ] **Step 4: Commit**

```bash
git add components/doodle/DoodleSection.tsx
git commit -m "feat(doodle): DoodleSection thumbnail switches on selection.kind"
```

---

## Task 13: `app/checkout.tsx` — Pay gate + payload build

**Files:**
- Modify: `app/checkout.tsx`

- [ ] **Step 1: Wire `buildPaymentSelections`**

At the top of `app/checkout.tsx`, add:
```ts
import { buildPaymentSelections } from '@/lib/doodle/build-payment-selections'
import { cartToSlots } from '@/lib/doodle/cartToSlots'
```

- [ ] **Step 2: Pay-gate logic**

Find the existing "all cups labeled" gate (likely a `useMemo` near the top of the Checkout component). Replace its body with:

```ts
const labelSelections = useCart((s) => s.labelSelections)
const lines = useCart((s) => s.lines)
const slots = useMemo(() => cartToSlots(lines, labelSelections), [lines, labelSelections])

const allLabeled = useMemo(() => {
  // slot.selection is non-nullable (cartToSlots fills a deterministic default
  // when labelSelections has no entry for this cupKey). Gate only blocks on
  // in-flight AI / draw uploads — preset and photo are always sync-ready.
  return slots.every((slot) => {
    const s = slot.selection
    if (s.kind === 'ai' && s.aiDoodleId === null) return false
    if (s.kind === 'draw' && s.userDoodleId === null) return false
    return true
  })
}, [slots])
```

- [ ] **Step 3: Replace payment payload build**

Find where `usePayment.pay({ ... doodleIds, doodleDefaults, aiDoodleIds })` is called. Replace the doodle-related fields with:

```ts
const selectionMaps = buildPaymentSelections(labelSelections)

const result = await pay({
  sourceId,
  orderId,
  verificationToken,
  ...selectionMaps, // presetStickerHashes / uploadedDoodleIds / aiDoodleIds / userDoodleIds
})
```

Delete the old `doodleIds` / `doodleDefaults` derivation code.

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 new errors. If errors remain, fix them inline (likely stale references to removed slot fields).

- [ ] **Step 5: Commit**

```bash
git add app/checkout.tsx
git commit -m "feat(checkout): pay gate + payload use labelSelections + buildPaymentSelections"
```

---

## Task 14: Delete `lib/doodle/pool.ts` + cleanup imports

**Files:**
- Delete: `lib/doodle/pool.ts`
- Delete: `lib/doodle/pool.test.ts`
- Modify: any remaining importers

- [ ] **Step 1: Find lingering POOL/pickDefaultForCup importers**

```bash
cd ~/Github/mandys_bubble_tea_app && grep -rn "from '.*doodle/pool'\|from '.*pool'\|pickDefaultForCup\|POOL" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v doodle/pool.ts | grep -v doodle/pool.test.ts
```
Expected: empty output. If anything appears, edit those files to remove the import + usage.

- [ ] **Step 2: Remove the back-compat `SvgPath` re-export from cartToSlots.ts**

In `lib/doodle/cartToSlots.ts` find:
```ts
export type { SvgPath } from './types' // back-compat re-export
```
Remove that line. Run `grep -rn "from '@/lib/doodle/cartToSlots'" --include="*.ts" --include="*.tsx"` and update any consumer to import `SvgPath` from `@/lib/doodle/types` instead.

- [ ] **Step 3: Delete the files**

```bash
git rm lib/doodle/pool.ts lib/doodle/pool.test.ts
```

- [ ] **Step 4: Full test pass**

```bash
npx jest
```
Expected: all PASS. Pre-existing baseline failures unrelated to doodle/cart can persist if they were already there — confirm by running `git stash && npx jest` on a clean tree first if uncertain.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```
Expected: 0 errors (pre-existing baseline aside).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(doodle): retire 8-SVG POOL module"
```

---

## Task 15: Real-line smoke on Stan's iPhone

**Files:** none (verification only)

- [ ] **Step 1: Confirm Metro is running**

```bash
lsof -ti:8081
```
Expected: returns a PID (Metro was started in the parent session). If empty, restart:
```bash
cd ~/Github/mandys_bubble_tea_app && npx expo start --dev-client &
```

- [ ] **Step 2: Reload app on device**

Shake iPhone → "Reload" (or kill + relaunch app). New JS bundle includes Task 1-14 changes.

- [ ] **Step 3: Verify Preset tab shows 78 PNG**

Add any drink to cart → open cart → tap cup row → switch to **Preset** tab. Expected: ~78 thumbnails in 4-col grid. Scroll works smoothly.

- [ ] **Step 4: Verify Pay path**

Pick a preset → close picker → cart row shows that PNG. Proceed to Checkout. Pay (sandbox Square). Expected: 200 OK from `/api/payment`; server logs (if accessible) show `presetStickerHashes` in the request body.

- [ ] **Step 5: Regression — Photo / AI / Draw tabs**

Repeat with each of the 3 other tabs to verify no regression. AI tab: submit prompt → dialog closes immediately → cart row shows pending spinner → eventually swaps to AI image.

- [ ] **Step 6: Migration smoke**

Stop app. Edit `~/Library/Developer/CoreSimulator/Devices/.../mandysbubbleteaapp/Library/Application Support/...` (or use a v2-installed device) such that AsyncStorage contains a v2 cart. Relaunch. Expected: cart preserved, label selections empty, deterministic defaults fill in. (Easier path: install the prior build first, add to cart, then upgrade. If too involved, skip this step and let real users catch any migration issues — risk is low because labelSelections didn't exist in v2.)

- [ ] **Step 7: Final commit (if any inline UI fixes were needed during smoke)**

```bash
git add -A && git commit -m "fix(doodle): real-line smoke fixes"
```

---

## Out of scope (follow-ups)

- OTA push of new gallery additions (manual `pnpm gallery:sync && eas update` for v1).
- Android port of the same feature.
- Preview thumbnail downscaling beyond what web ships.
- Remote-fetch fallback for offline-bootstrap-then-cache.
- POOL 8-SVG retirement from web server side.
- CI guard: lint that `lib/doodle/gallery-manifest.generated.ts` is in sync with `assets/`.

## Plan review notes

After completing Task 15, before opening PR:
1. Verify all 15 tasks committed (15 commits since branch HEAD `6a058ff`).
2. Re-run full test suite + tsc one last time.
3. Update `~/system/DEV_QUEUE-mandys.md` with the wrap-up entry.
4. Update `~/system/TESTER_QUEUE-mandys.md` "Pending QA from /dev" with a smoke checklist for the tester:
   - Preset tab shows 78 PNG, 4-col grid, smooth scroll
   - Pay with each of preset/photo/ai/draw → real Square sandbox payment → server enqueue queues a cup-label job with correct `doodle_source`
   - On a fresh install + first launch, no migration crash
