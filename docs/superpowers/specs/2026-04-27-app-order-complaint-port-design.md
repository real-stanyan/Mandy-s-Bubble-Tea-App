# App Order Complaint Port — Design Spec

**Date:** 2026-04-27
**Author:** Stan + Claude
**Target version:** 1.0.9 (iOS buildNumber 9 → 10)
**Companion plan:** `docs/superpowers/plans/2026-04-27-app-order-complaint-port-plan.md` (TBD)

---

## 1. Background

The web project shipped an **Order Complaint Channel** on 2026-04-26 (commits `9659664..b832ad9`, 18 commits). It lets a customer who completed an order within the last 7 days submit a description + up to 3 photos; the server compresses photos with `sharp`, sends an email via Resend to `hello@mandybubbletea.com`, and inserts a dedup row into Supabase `order_complaints`.

The app (`mandys_bubble_tea_app`) currently has **zero** complaint UI — `grep -r "complaint" app/ components/ lib/` returns only one match in `lib/legal.ts` (Terms text). Customers who pay through the app and want to report an issue have no in-app path; they have to leave the app and use the web site, Instagram DM, or phone.

This spec covers the **app port** of the complaint channel. The web backend is **not changed** — the app calls the existing `/api/orders/[orderId]/complaint-status` and `/api/orders/[orderId]/complaint` endpoints.

## 2. Goals

- Surface the same complaint flow inside the iOS app on the order detail screen.
- Match web behavior 1:1 for gates, error mapping, copy, and post-submit state — minimize cognitive divergence between web and app users.
- Bundle the change into the in-flight 1.0.9 ship (build 10, before Xcode Archive) so it goes out with the IG Follow / topping cap / warm-mutex / splash batch in one TestFlight submission.

## 3. Non-goals

1. **Order-confirmation page mount.** Web mounts the section there too; app does not. Customers usually realize problems after they get home, not at pickup. Adding it on order-confirmation later is straightforward but explicitly out of scope here.
2. **Draft persistence.** If the user writes a partial description / picks photos and navigates away, the modal route discards state on unmount. Mirrors web.
3. **Photo lightbox.** Thumbnails in the photo grid are not tappable to enlarge.
4. **Backend duplication.** No app-side validation re-implementation. Server-side `validateComplaintBody`, `isWithinComplaintWindow`, `ownsOrder` remain the single source of truth.
5. **Video / microphone.** Only still images. `expo-image-picker` `microphonePermission` explicitly disabled in plugin config.
6. **Toast auto-dismiss timer.** Green banner stays until the next mount of the order-detail screen — by then the section is already in `already_reported` state and there is no toast.
7. **Retry button.** Failed submit shows the friendly error string; user taps Submit again to retry. Mirrors web.
8. **Client-side rate limit.** Server enforces uniqueness via Supabase `UNIQUE(order_id)` + 7-day window — both naturally limit volume.
9. **Camera roll permission re-prompt UX.** If the user previously denied permission, we show a "Camera permission is needed. Open Settings?" link that calls `Linking.openSettings()`. We do not try to recover from a permanent denial inside the app.
10. **Android 1.0.x ship.** App is iOS-only per project memory. Android code paths must compile and not crash but are not validated for this version.

## 4. Architecture

### File changes

**New files (3):**

```
app/order-complaint.tsx                       # Expo Router modal route — form body
components/account/OrderComplaintSection.tsx  # 4-state card (loading / hidden / eligible / window_closed / already_reported)
lib/photo-compress.ts                         # expo-image-manipulator wrapper (1920px JPEG q80)
```

**Modified files (4):**

```
app/_layout.tsx          # Stack.Screen 'order-complaint' presentation: 'modal'
app/order-detail.tsx     # Mount <OrderComplaintSection /> below summary section, above Back button
app.json                 # iOS buildNumber 9 → 10; expo-image-picker plugin with permission strings
package.json             # Add expo-image-picker + expo-image-manipulator
```

**Test files (1 new):**

```
lib/photo-compress.test.ts
```

### Data flow

```
order-detail render
  └─ <OrderComplaintSection orderId pickupNumber orderState orderCustomerId />
       ├─ client gate: profile.square_customer_id === orderCustomerId && orderState === 'COMPLETED'
       │   └─ false → return null (hidden)
       ├─ fetch GET /api/orders/[orderId]/complaint-status (no-store, Bearer auth)
       │   └─ map { reason: 'eligible'|'window_closed'|'already_reported'|... }
       │       to local Status union; anything else / non-2xx → kind: 'hidden'
       └─ render based on Status:
            • loading        → "Checking…" placeholder card
            • hidden         → null
            • eligible       → "Need help with this order?" + "Tell us what went wrong."
                               + 'Report a problem' button → router.push('/order-complaint?orderId=...&pickupNumber=...')
            • window_closed  → same heading + disabled "Complaint window closed" button
            • already_reported → same heading + disabled "Reported on {Apr 27, 2026}" button
       └─ on form success: setStatus({ kind: 'already_reported', at: now }) + show green banner

order-complaint modal route
  ├─ description: TextInput (multiline, 1000-char hard cap, 10-char min for submit-enable, counter "{N}/1000")
  ├─ photos[]: { uri, mime: 'image/jpeg', size, name } — capped at 3
  │   ├─ "Add photo" pressable → ActionSheetIOS.showActionSheetWithOptions (iOS) /
  │   │                            Alert.alert with 3 buttons (Android fallback)
  │   ├─ "Take Photo": ImagePicker.requestCameraPermissionsAsync → launchCameraAsync({ mediaTypes: Images, quality: 1, allowsEditing: false })
  │   ├─ "Choose from Library": requestMediaLibraryPermissionsAsync → launchImageLibraryAsync({
  │   │                                  mediaTypes: Images, allowsMultipleSelection: true,
  │   │                                  selectionLimit: 3 - photos.length, quality: 1 })
  │   ├─ permission denied → setError + render "Open Settings" link calling Linking.openSettings()
  │   └─ each picked asset → photo-compress.ts → manipulateAsync(uri, [{ resize: { width: 1920 }}], { compress: 0.8, format: SaveFormat.JPEG })
  │       → wrap as { uri, mime: 'image/jpeg', name: 'photo-N.jpg' }
  │       (server validates 8MB cap; client-side size check skipped — compressed output reliably < 2MB and avoids a transitive expo-file-system import)
  ├─ submit handler:
  │     if (submitting) return            // rapid-tap guard
  │     description.trim().length < 10 → setError(local) + return
  │     description.length > 1000 → setError(local) + return  (TextInput maxLength prevents this anyway)
  │     build FormData: 'description' + photos forEach append 'photos' as { uri, type, name }
  │     fetch POST /api/orders/[orderId]/complaint with Bearer auth
  │       — DO NOT set Content-Type; let RN add multipart boundary
  │       — DO NOT add timeout; mirror web (user can hit Cancel — see lock state)
  │     200 ok=true: onSuccess → router.back() + parent setStatus already_reported + toast banner
  │     409 ALREADY_REPORTED: treat as success (graceful close, mirror web)
  │     other 4xx/5xx: setError(friendlyError(code, json.message, status))
  └─ during submit: navigation.setOptions({ gestureEnabled: false }); Cancel + X buttons disabled; Submit shows spinner
```

### Backend (unchanged)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/orders/[orderId]/complaint-status` | GET | Returns `{ reason: 'eligible' \| 'window_closed' \| 'already_reported' \| 'not_completed', alreadyReportedAt? }` or 503 if migration not run |
| `/api/orders/[orderId]/complaint` | POST | Multipart `description` + `photos[]`. 10-step server pipeline (auth → Square fetch → ownership → COMPLETED → 7d window → dedup SELECT → multipart parse → body validation → photo MIME/size → sharp compress → Resend send → INSERT). |

App calls both via the existing `lib/api.ts` base URL with Supabase `Authorization: Bearer <access_token>` header.

## 5. Component contracts

### `<OrderComplaintSection />`

**Props:**
```ts
type Props = {
  orderId: string;            // Square order id
  pickupNumber: string;       // ticket name "OL856" — passed through to modal route as a param
  orderState: string | null;  // Square order.state — gate on 'COMPLETED'
  orderCustomerId: string | null;  // Square customer id from the order — must match session
};
```

**State (internal):**
```ts
type Status =
  | { kind: 'loading' }
  | { kind: 'hidden' }
  | { kind: 'eligible' }
  | { kind: 'window_closed' }
  | { kind: 'already_reported'; at: string };
```

**Behavior:**
- Mount effect: client gate → fetch status route → set Status accordingly. Cancel-token via local `cancelled` flag in cleanup (mirror web pattern).
- On `Report a problem` press: `router.push({ pathname: '/order-complaint', params: { orderId, pickupNumber } })`.
- Listens for "complaint submitted" via the modal route's success path, which navigates back and the parent owns post-success state. Implementation choice: pass an `onSuccess` callback through router params is awkward in Expo Router — use a lightweight global event (e.g. `DeviceEventEmitter.emit('complaint:submitted', { orderId })` from the modal, parent subscribes in mount effect). Alternative: since pop-back triggers parent re-render, refetch `complaint-status` on focus via `useFocusEffect` — simpler and self-correcting. **Decision: useFocusEffect refetch on order-detail focus.** No event bus needed.
- Toast banner: rendered inline in section card; controlled by local `toast` state; set on focus refetch transition `eligible → already_reported`.

### `app/order-complaint.tsx` (route)

**Search params** (read via `useLocalSearchParams`):
- `orderId: string` (required)
- `pickupNumber: string` (required, used in title)

**Stack screen options:**
```ts
{ presentation: 'modal', headerShown: false, gestureEnabled: <not submitting> }
```

**Internal state:**
```ts
const [description, setDescription] = useState('');
const [photos, setPhotos] = useState<Photo[]>([]);
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### `lib/photo-compress.ts`

```ts
export type Photo = {
  uri: string;
  mime: 'image/jpeg';
  name: string;     // 'photo-0.jpg', 'photo-1.jpg', ...
};

export async function compressForUpload(
  sourceUri: string,
  index: number,
): Promise<Photo>;
```

Implementation:
1. `ImageManipulator.manipulateAsync(sourceUri, [{ resize: { width: 1920 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG })`
2. Return `{ uri, mime: 'image/jpeg', name: \`photo-${index}.jpg\` }`

No client-side size check — compressed JPEG at 1920px width q80 is reliably < 2MB even from a 12MP source. Server's 8MB cap remains the authoritative guard, returning `INVALID_PHOTO` if somehow exceeded.

## 6. Copy strings (mirror web)

### Section card
- Heading: `Need help with this order?`
- Sub: `Tell us what went wrong.`
- Eligible button: `Report a problem`
- Window-closed button (disabled): `Complaint window closed`
- Already-reported button (disabled): `Reported on {Apr 27, 2026}` (en-AU `Intl.DateTimeFormat`)
- Loading placeholder: `Checking…`
- Success toast: `Thanks — we'll be in touch within 24 hours.`

### Modal route
- Title: `Report a problem with order {pickupNumber}`
- Sub: `Tell us what went wrong. We'll be in touch within 24 hours.`
- Description label: `Description`
- Description placeholder: `Tell us what went wrong (e.g. wrong topping, drink looked off, missing item)…`
- Description counter: `{N}/1000`
- Photo label: `Photos ({N}/3, optional)`
- Add photo button: `Add photo`
- Cancel button: `Cancel`
- Submit button: `Submit`

### ActionSheet (Add photo)
- iOS title: none
- Buttons: `Take Photo` / `Choose from Library` / `Cancel`
- Cancel index: 2

### Permission denied
- Camera: `Camera permission is needed to take a photo. Open Settings?` (with tappable "Open Settings" inline)
- Library: `Photos permission is needed to attach a photo. Open Settings?`

### Error code → user string (mirror web `friendlyError()` exactly)

```
NOT_AUTHENTICATED  → "You need to sign in to report a problem."
NOT_OWN_ORDER      → "Sign in with the account that placed this order."
ORDER_NOT_FOUND    → "We couldn't find this order."
NOT_COMPLETED      → "This order isn't complete yet."
WINDOW_CLOSED      → "The 7-day window for reporting this order has passed."
ALREADY_REPORTED   → "This order was already reported."
INVALID_INPUT      → "Please double-check the form and try again."
INVALID_PHOTO      → "One of the photos couldn't be processed. Try a different file."
PROCESSING_FAILED  → "We couldn't process your photos. Please try again."
EMAIL_FAILED       → "We couldn't send your report. Please try again in a moment."
default            → "Server error ({status}). Please try again."
```

If `json.message` is present, prefer it over the table (server-tagged `INVALID_INPUT.reason` strings).

## 7. Permissions (`app.json` plugin)

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

`microphonePermission: false` is critical — without it, `expo-image-picker` adds `NSMicrophoneUsageDescription` by default, which can trigger an ASC review question about why a bubble tea ordering app needs the microphone.

## 8. What's New (1.0.9 build 10)

Append a 5th bullet to the existing A-plan draft (in `DEV_HANDOFF.md` 2026-04-27 entry):

```
• Order issue? Tap a completed order in My Orders and use
  "Report a problem" to send us a quick description and photos —
  we'll be in touch within 24 hours.
```

Order: keep existing 4 bullets first (IG Follow / topping cap / warm mutex / splash), append complaint as 5th.

## 9. Testing

### Unit (jest)
- `lib/photo-compress.test.ts` (new file):
  1. Mock `expo-image-manipulator.manipulateAsync`
  2. Assert call args include `resize: { width: 1920 }`, `compress: 0.8`, `format: SaveFormat.JPEG`
  3. Assert returned shape `{ uri, mime: 'image/jpeg', name: 'photo-${index}.jpg' }`
  4. Assert errors from `manipulateAsync` propagate (caller catches and surfaces `INVALID_PHOTO` UX)

### Manual on dev/sandbox build (mirror HANDOFF "V1 实机验证" style)

1. Login → place a sandbox order → mark COMPLETED in Square Dashboard.
2. My Orders tab → tap the completed order → order-detail page → see complaint section card below summary, above Back.
3. Card shows `Need help with this order?` + `Report a problem` button.
4. Tap button → modal slides up from bottom (iOS sheet animation).
5. Type 8 characters → Submit disabled. Type 10 → Submit enables.
6. Tap `Add photo` → ActionSheet with `Take Photo` / `Choose from Library` / `Cancel`.
7. First-time `Take Photo`: camera permission prompt with copy "Used to take a photo when reporting an order issue." Approve → camera opens.
8. First-time `Choose from Library`: photos permission prompt with copy "Used to attach photos when reporting an order issue." Approve → multi-select picker.
9. Pick 2 HEIC photos → photos appear in grid as JPEG (verify file extension via thumb metadata) at ~500KB each.
10. Tap Submit → spinner → success → modal pops back → card flips to `Reported on {today}` (disabled) + green toast banner.
11. Verify side-effects:
    - `hello@mandybubbletea.com` receives email with 2 JPEG attachments + correct subject + body details.
    - Supabase `order_complaints` has new row with this `order_id`.
    - Re-tap order in My Orders → still shows `Reported on {today}` (proves persistence, not just local state).

### Failure-path manual

- Deny camera permission → "Open Settings" link visible.
- Submit with 5 chars description → blocked client-side (Submit stays disabled).
- Submit twice rapidly (after first success) → second tap returns 409 → graceful close (mirror web).
- Airplane mode submit → network error in red banner; toggle airplane mode off → Submit again works.

### Regression check
- `npx tsc --noEmit` → 0 errors.
- `npm test` → all existing tests (8 jest cases as of 2026-04-27) still pass + new photo-compress tests.

## 10. Risks / Trade-offs

1. **Modal + iOS keyboard layout.** Description textarea + photo grid + buttons in a modal route — keyboard may obscure photo grid. Mitigation: wrap content in `KeyboardAvoidingView behavior='padding'` + ScrollView. Verify on real device during implementation.
2. **HEIC → JPEG strips EXIF.** Email recipient (Mandy) loses original capture timestamp / GPS. Acceptable — the question is "what's wrong with the drink", not "where was it photographed".
3. **`useFocusEffect` refetch may double-fetch.** When the modal pops back, both unmount of modal and focus of order-detail trigger React lifecycle. Add a small guard or accept one redundant fetch (low cost, no-store header but tiny payload).
4. **Auth header parity with web.** Web uses cookie session; app uses Supabase Bearer. Both go through `getAuthedUser` on the server. Verify app's existing `lib/api.ts` already attaches Bearer for similar `/api/...` calls — if yes, reuse; if not, this surfaces as `NOT_AUTHENTICATED` 401 in testing.
5. **Build 10 collides with another machine's archive.** If anyone else has already started a build 10 archive locally, App Store Connect will reject the upload as a duplicate buildNumber. Coordinate with whoever else has the project open.

## 11. Open questions

None at brainstorm-end. Plan and implementation should not introduce new open questions without flagging here first.

## 12. Out-of-band manual steps (operator)

After code lands and passes typecheck/jest:

1. `npx expo prebuild` is **NOT** run (per project memory: do not run `expo prebuild --clean`; we Archive directly via Xcode). The `expo-image-picker` plugin's `Info.plist` keys are added automatically when Xcode builds the project from the existing `ios/` folder, **provided** the plugin block is registered in `app.json`. **Verify after first local build: open `ios/mandysbubbleteaapp/Info.plist` and confirm `NSPhotoLibraryUsageDescription` and `NSCameraUsageDescription` are present.** If they are missing, run `npx expo prebuild --no-install` once to regenerate the iOS project, then re-archive.
2. Open `ios/mandysbubbleteaapp.xcworkspace` → Destination `Any iOS Device (arm64)` → `Product → Archive`.
3. Organizer → Distribute App → App Store Connect → Upload.
4. ASC: open in-progress 1.0.9 version, update build to 10, paste 5-bullet What's New (4 existing + complaint), Submit for Review.
