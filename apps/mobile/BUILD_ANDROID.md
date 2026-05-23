# LOGX Express — Android APK build guide

Driver app package: `com.logxexpress.driver`

## Prerequisites

1. **Node.js 20+** and npm (monorepo root: `npm install`)
2. **API running** and reachable from the device (`apps/api` on port 4000)
3. **Driver account** — create in admin web: Drivers → Add Driver → enable **mobile app login**
4. **App assets** — run once:
   ```bash
   cd apps/mobile
   npm run generate:assets
   ```

## Configure API URL (required for APK)

Copy env example and set your backend URL:

```bash
cd apps/mobile
copy .env.example .env
```

| Target | `EXPO_PUBLIC_API_URL` |
|--------|------------------------|
| Android emulator | `http://10.0.2.2:4000` |
| Physical phone (same Wi‑Fi) | `http://YOUR_PC_LAN_IP:4000` (e.g. `http://192.168.1.50:4000`) |
| Production | `https://api.yourdomain.com` |

Find LAN IP: `ipconfig` (Windows) → IPv4 Address.

Ensure API `CORS_ORIGINS` is not required for mobile (native app). API must listen on `0.0.0.0`, not only `localhost`.

---

## Option A — EAS cloud build (recommended)

1. Install EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```

2. Link project (first time only):
   ```bash
   cd apps/mobile
   eas init
   ```
   This adds `extra.eas.projectId` to `app.config.js` / `app.json`.

3. Set API URL for the build — edit `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`, or:
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value http://192.168.1.50:4000 --scope project
   ```

4. Build APK:
   ```bash
   npm run build:apk:cloud
   ```
   Or: `eas build --platform android --profile preview`

5. Download the `.apk` from the Expo dashboard when the build finishes.

**Production (Play Store):** `npm run build:aab:cloud` → uploads AAB.

---

## Option B — Local EAS build (needs Android SDK)

Requires [Android Studio](https://developer.android.com/studio) + SDK, `ANDROID_HOME` set.

```bash
cd apps/mobile
npm run build:apk:local
```

Output APK path is printed at the end (under `apps/mobile` or temp build dir).

---

## Option C — Gradle after prebuild

```bash
cd apps/mobile
copy .env.example .env
# Edit .env with your EXPO_PUBLIC_API_URL

npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

Sign with a keystore for distribution outside debug builds.

---

## Development (no APK)

```bash
# Terminal 1 — API
cd apps/api && npm run dev

# Terminal 2 — Expo
cd apps/mobile
copy .env.example .env
npm start
```

Scan QR with **Expo Go**, or press `a` for emulator.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails on device | Wrong `EXPO_PUBLIC_API_URL`; API not on LAN; firewall blocking port 4000 |
| Build fails: missing icon | Run `npm run generate:assets` |
| Cleartext HTTP blocked | `usesCleartextTraffic: true` is set in `app.config.js` for dev HTTP |
| GPS not updating | Grant location “Always” on device; driver must be online on a route |

---

## Version bumps

- App version: `app.json` → `expo.version`
- Android `versionCode`: `app.config.js` → `android.versionCode`
