# Mandy's BT App — Android OAuth + Keystore Setup

Reference for `feat/android-port` Phase A and beyond.

## Google Cloud project (separate from Firebase project)

| Concern | Project | Number |
|---------|---------|--------|
| **Google Sign-In OAuth clients** (iOS + Android + Web) | `mandy-bubble-tea` | **744591425203** |
| **Firebase / FCM v1 push** | `mandys-bubble-tea` (note plural `s`) | **779948591130** |

The split exists because:
- iOS Google Sign-In was set up in 2026-04 against `mandy-bubble-tea` (project 744591425203).
- Supabase Google auth provider is configured against that project's **Web Client ID**.
- Firebase / FCM was set up later on a separate project `mandys-bubble-tea` (779948591130) to avoid touching the OAuth project. Org policy unlock on the FCM project was easier to scope to FCM alone.
- The split is fine because FCM (push delivery) and Google Sign-In (OAuth) don't need to share a GCP project — Expo Push Service uses FCM credentials from `mandys-bubble-tea`, and Google Sign-In uses OAuth client IDs from `mandy-bubble-tea`; they don't intersect.

## OAuth 2.0 Clients on `mandy-bubble-tea` project

Visit: https://console.cloud.google.com/apis/credentials?project=mandy-bubble-tea

| Client name | Type | Client ID prefix | Used for |
|-------------|------|------------------|----------|
| Mandy iOS | iOS | `744591425203-g5oh...` | iOS production Google Sign-In (`iosClientId`) |
| Mandy's Bubble Tea App (Dev) | iOS | `744591425203-mv53...` | iOS dev Google Sign-In (`iosClientId DEV`) |
| Mandy Web | Web application | `744591425203-m0db...` | Web (Supabase) AND Android (`webClientId`) — token audience |
| **Mandy Android (EAS Production)** | Android | `744591425203-jlej...` | Android Google Sign-In SHA-1 + package validator |

`@react-native-google-signin/google-signin` on Android uses `webClientId` (NOT `androidClientId`) — the Android-type OAuth client just registers SHA-1 + package; the actual ID token is issued against the Web client ID, which Supabase's Google auth provider also trusts (matching `aud`).

## Android signing keystore (EAS-managed)

Set up via `eas credentials --platform android` → `production` profile → `Keystore: Manage everything needed to build your project` → `Set up a new keystore`.

| Field | Value |
|-------|-------|
| Type | JKS |
| Key Alias | `2a7a0974558554e2131667e345779304` |
| **SHA-1 Fingerprint** | `03:20:57:FA:EA:32:FE:8D:E3:7B:53:B1:75:53:5F:B0:FC:99:8B:7E` |
| **SHA-256 Fingerprint** | `7F:3C:F8:F9:72:0C:A7:E7:D3:90:81:9A:0A:75:4B:80:D8:E3:26:0C:56:9B:4B:DD:E0:C3:59:66:0D:C7:3A:69` |
| MD5 Fingerprint | `FE:9A:57:99:E8:91:70:48:00:F2:EF:4C:3E:06:39:2D` |

- **SHA-1** registered on the Mandy Android OAuth client (above) — required for Google Sign-In to validate Android caller package.
- **SHA-256** will be hosted in `mandybubbletea.com/.well-known/assetlinks.json` for T7 App Links autoVerify.

If the EAS keystore is ever rotated (`eas credentials` → `Change default keystore` or `Delete your keystore` + recreate), **both** the Android OAuth client SHA-1 AND the assetlinks.json SHA-256 MUST be updated to match. Until both are updated, Google Sign-In returns `DEVELOPER_ERROR` and App Links autoVerify state degrades to `legacy_failure`.

## Environment variables (already configured on EAS preview env)

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` was already set on the EAS preview environment for iOS Google Sign-In; Android transparently reuses it. No additional env config needed for T3. `.env.local` (gitignored) pulled via `eas env:pull --environment preview` for local Metro dev.

Production EAS environment does NOT currently have these envs set — relevant only when Phase B EAS production builds happen.

## Runtime — what code reads where

- `app/login.tsx:34-37` — `GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, iosClientId: ... })` — already cross-platform; Android picks up `webClientId` and uses native Play Services Auth library to fetch an ID token signed for that `aud`.
- `components/auth/SignInCard.tsx:224` — `{Platform.OS === 'ios' && <AppleAuthenticationButton />}` — Apple Sign-In hidden on Android (already in place pre-T8).

## Smoke verification (deferred to T11 Pixel)

Real device case 2: "Continue with Google" on Pixel → native account picker → idToken → Supabase auth → user row created with same `auth_provider='google'` as iOS user with same email. Verify the iOS / Android user with the same Google email lands in ONE `auth.users` row (one provider identity), not duplicated.
