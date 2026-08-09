# Deployment — EAS Build & App Stores

## Platform: Expo Application Services (EAS)

```bash
npm install -g eas-cli
eas login
eas build:configure
```

## Environment Variables

Set via `eas.json` build profiles or EAS Secrets:

| Key | Note |
|-----|------|
| `EXPO_PUBLIC_API_BASE_URL` | `https://mandybubbletea.com` — backend API |
| `EXPO_PUBLIC_SQUARE_APP_ID` | From Square Developer Console |
| `EXPO_PUBLIC_SQUARE_LOCATION_ID` | From Square Dashboard → Locations |

No server-side secrets in the app — all sensitive keys stay on the backend.

## EAS Build Profiles

```json
// eas.json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  }
}
```

## Building

```bash
# Development build (for testing with dev client)
eas build --profile development --platform ios
eas build --profile development --platform android

# Production build
eas build --profile production --platform all
```

## OTA Updates (Expo Updates)

**Normally you do not run this by hand.** Merging a JS-only change to `main`
publishes it automatically — see `.github/workflows/publish.yml` and
`docs/adr/0001-publish-on-merge-fail-closed.md`. A merge that touches anything
native (`ios/`, `android/`, `package.json`, `app.json`, `eas.json`, `patches/`,
`scripts/patch-*.js`) publishes nothing and fails the job on purpose: those need
a store build, not an OTA.

To publish by hand anyway:

```bash
eas update --branch production --platform ios --environment production \
  --message "description of changes"
```

Both flags are load-bearing, and both have already caused an incident:

- `--platform ios` — the `production` branch is iOS-only, and the default
  `--platform all` crashes at bundle time on the web export
  (`ReferenceError: window is not defined`). Issue #46.
- `--environment production` — takes `EXPO_PUBLIC_*` from the EAS `production`
  environment instead of the local `.env.local`, which deliberately holds
  sandbox/LAN values. Publishing without it shipped sandbox Square credentials
  to every user. Issue #41.

Worth a preflight before any manual publish — export the real bundle and read it:

```bash
eas env:exec production 'npx expo export --platform ios'
grep -a -c -F 'mandybubbletea.com' dist/_expo/static/js/ios/*.hbc   # expect 1
grep -a -c -F 'sq0idb-' dist/_expo/static/js/ios/*.hbc              # expect 0
```

Note an iOS bundle legitimately drops Android-only strings — the Square location
id is only referenced under `Platform.OS === 'android'`, so its absence is
correct, not a missing env var.

JS-only changes reach installed apps this way; native changes need a store build.

## App Store Submission

```bash
eas submit --platform ios
eas submit --platform android
```

### iOS Requirements
- Apple Developer account ($99/year)
- App Store Connect listing
- Privacy policy URL
- App icons (1024x1024)
- Screenshots for required device sizes

### Android Requirements
- Google Play Console account ($25 one-time)
- Play Store listing
- Privacy policy URL
- App icons + feature graphic (1024x500)
- Content rating questionnaire

## Apple Pay Setup (iOS)

1. Enable Apple Pay capability in `app.json` → `ios.entitlements`
2. Register merchant ID in Apple Developer Portal
3. Link merchant ID in Square Developer Dashboard
4. Test on physical device (not simulator)

## Google Pay Setup (Android)

1. Add Google Pay merchant ID
2. Configure in `app.json` → `android.config`
3. Test on physical device with Google Pay account

## Local Dev

```bash
npx expo start
# Press 'i' for iOS simulator, 'a' for Android emulator
# Or scan QR code with Expo Go (limited — no native modules)
```

For native features (payments SDK), use a development build:
```bash
eas build --profile development --platform ios
npx expo start --dev-client
```

## Pre-launch Checklist

- [ ] Backend API (`mandybubbletea.com`) is deployed and accessible
- [ ] `EXPO_PUBLIC_API_BASE_URL` points to production
- [ ] Apple Pay merchant ID configured
- [ ] Google Pay merchant ID configured
- [ ] App icons and splash screen customized (brand colors)
- [ ] Apple Pay tested on real iPhone
- [ ] Google Pay tested on real Android
- [ ] Full checkout flow tested end-to-end
- [ ] Loyalty lookup works with real phone number
- [ ] Privacy policy URL set
- [ ] App Store / Play Store listings prepared
- [ ] Push notification setup (if needed for order status)
