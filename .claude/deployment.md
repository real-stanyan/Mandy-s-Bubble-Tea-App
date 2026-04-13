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

```bash
eas update --branch production --message "description of changes"
```

JS-only changes can be pushed OTA without a new app store build.

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
