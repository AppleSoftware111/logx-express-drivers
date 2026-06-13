# LOGX BioPoli — Android APK build guide

Driver app package: `com.logxbiopoli.driver`

## Supported device matrix

| Target | ABI / artifact | Recommended command | Notes |
|--------|----------------|---------------------|-------|
| Real Android phones (modern, 64-bit) | `arm64-v8a` | `npm run build:apk:cloud` or `npm run build:apk:standalone:phone` | Best for most production devices |
| Real Android phones (mixed internal testing) | `arm64-v8a` + `armeabi-v7a` | `npm run build:apk:standalone:phone:universal` | Use when testers may have older 32-bit devices |
| LDPlayer / x86 emulator | `x86_64` | `npm run build:apk:standalone:ldplayer` | Emulator-only, do not install on real phones |
| Play Store / managed distribution | AAB | `npm run build:aab:cloud` | Store upload artifact |

Use real-phone artifacts first. LDPlayer builds are only for emulator validation.

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

## Option A — EAS cloud build for real phones (recommended)

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

3. Set API URL for the build — by default `preview` now targets the deployed backend. To use another backend, edit `eas.json` → `build.preview.env.EXPO_PUBLIC_API_URL`, or:
   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value http://192.168.1.50:4000 --scope project
   ```

4. Build APK for a physical Android phone:
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

## Option C — Standalone local APK for real phones (64-bit)

On Windows, install Android SDK command-line tools and a newer side-by-side CMake first, then run:

```bash
cd apps/mobile
npm run generate:assets
npm run build:apk:standalone:phone
```

This path writes `android/local.properties`, forces the local SDK CMake, and builds only `arm64-v8a` for physical devices.

APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## Option D — Standalone local APK for mixed phone fleets

Use this when internal testers may have a mix of newer 64-bit phones and older 32-bit phones:

```bash
cd apps/mobile
npm run generate:assets
npm run build:apk:standalone:phone:universal
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

This path builds `arm64-v8a` and `armeabi-v7a` in one APK for broader internal install compatibility.

---

## Option E — Standalone local APK (LDPlayer only)

```bash
cd apps/mobile
copy .env.example .env
# Edit .env with your EXPO_PUBLIC_API_URL

npm run generate:assets
npm run build:apk:standalone:ldplayer
```

APK: `android/app/build/outputs/apk/release/app-release.apk`

This path builds an `x86_64` standalone release APK for LDPlayer/emulators and does not require Metro. Do not install this APK on a real phone.

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
| App crashes immediately on a real phone | You probably installed the LDPlayer `x86_64` APK. Build again with `npm run build:apk:cloud` or `npm run build:apk:standalone:phone:universal` |
| Cleartext HTTP blocked | `usesCleartextTraffic: true` is set in `app.config.js` for dev HTTP |
| GPS not updating | Grant location “Always” on device; driver must be online on a route; disable battery optimization for the app on Samsung/Xiaomi/Motorola devices |

## Battery optimization checklist

Screen-lock GPS failures on Android are often caused by OEM power saving. For every production test device:

1. Set location permission to **Allow all the time**.
2. Enable precise location.
3. Disable battery optimization for the driver app.
4. Allow background activity / auto start if the OEM exposes those options.
5. Keep the persistent tracking notification visible while a route is in progress.

Recommended operator wording for the client:
- Samsung: Settings → Apps → `LOGX BioPoli` → Battery → `Unrestricted`
- Xiaomi / Redmi / Poco: Settings → Apps → Manage apps → `LOGX BioPoli` → Battery saver → `No restrictions`
- Motorola: Settings → Apps → `LOGX BioPoli` → App battery usage → allow background usage
- Generic Android: Settings → Apps → Special access → Battery optimization → `Don't optimize`

## Operator smoke test

Run this before sending an APK to the client:

1. Install the APK on a real phone and log in with a driver account.
2. Start a route and confirm the blue background tracking notification appears.
3. Lock the phone for 5-10 minutes while moving or simulating movement.
4. Confirm the driver still appears on:
   - admin dashboard map
   - operations map
   - execution detail page
5. Unlock the phone and confirm the session is still active without re-login.
6. Complete the route and confirm tracking stops after completion.

---

## Final APK scope freeze

After the route collection workflow is tested and approved, the driver APK is considered feature-complete for operations.

Included final operational scope:

- Route Received confirmation
- On the Way, Arrived, and Collected workflow for every stop
- Route Completed confirmation
- continuous background GPS while the route is active
- lock-screen/background tracking with Android foreground service notification
- offline recording and automatic sync for route workflow events
- GPS evidence for arrival and collection actions
- distance-to-stop audit evidence
- optional collection photo, signature, and notes
- admin audit timeline for route/stop proof

Allowed after scope freeze:

- critical bug fixes
- security fixes
- performance improvements
- compatibility fixes for supported Android devices

Not allowed after scope freeze unless approved as a separate project:

- new route lifecycle states
- new collection workflow features
- new operational modules
- new driver app feature requests outside the approved workflow

## Route collection acceptance checklist

Run these checks on real Android hardware before giving an APK to the client:

1. Driver receives route and taps **Route Received**.
2. Backend/admin audit stores timestamp, user/driver ID, and route/execution ID.
3. Driver taps **On the Way** for stop 1 and GPS tracking starts.
4. Driver locks the phone for at least 5 minutes; admin maps continue showing live/recent location.
5. Driver taps **Arrived** and audit stores timestamp, GPS coordinates, and distance to expected stop.
6. Driver taps **Collected** with a photo and notes; proof and GPS evidence sync.
7. Device goes offline between stops; actions are saved locally and sync after reconnect.
8. Workflow repeats for all stops.
9. Driver taps **Route Completed** and tracking stops.
10. Admin execution detail shows the full audit timeline and proof trail.
11. Driver does not need to log in again after locking/unlocking the phone.

---

## Version bumps

- App version: `app.json` → `expo.version`
- Android `versionCode`: by default `app.config.js` derives it from `expo.version` (`major * 10000 + minor * 100 + patch`). Override with `ANDROID_VERSION_CODE` only when you need a higher release code for a hotfix.
