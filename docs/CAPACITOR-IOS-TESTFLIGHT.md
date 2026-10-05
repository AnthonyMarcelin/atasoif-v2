# Capacitor iOS → TestFlight (beta)

Technical runbook for shipping `apps/web` (Angular cave) as a Capacitor iOS shell to **TestFlight**. No store public release required for the holiday beta window.

| Item | Value |
| --- | --- |
| Bundle ID | `fr.atasoif.app` (already created in Apple Developer) |
| App display name | À ta soif |
| Apple Team | `D3UKXNVT3D` |
| Services ID (Ally SIWA web) | `com.atasoif.web` — **not** the iOS bundle ID |
| Prod API | `https://api.atasoif.fr` (`environment.ts` / production build) |
| Capacitor | `@capacitor/core` + `@capacitor/ios` + `@capacitor/cli` (aligned versions) |
| `webDir` | `dist/web/browser` |
| Xcode project | `apps/web/ios/App/App.xcodeproj` |

Distribution preference: **native stores via Capacitor** — not a Dokploy `app.` / `cave.` subdomain (see Context prefs).

## Prerequisites (Anthony)

1. Apple ID with access to Team `D3UKXNVT3D` and App Store Connect.
2. Xcode (local Mac) signed in to that team.
3. App record in App Store Connect for bundle `fr.atasoif.app` (create if missing).
4. Signing: Automatic Signing recommended; select Team **D3UKXNVT3D**. Do **not** commit `.p12`, `.mobileprovision`, or `AuthKey_*.p8`.
5. Bun workspace installed at repo root (`bun install`).

## Build + sync (repo)

From monorepo root:

```bash
bun install
bun run ios:sync
# equivalent:
#   bun run build:shared
#   bun --filter @atasoif/web ios:sync
#   → ng build --configuration production
#   → cap sync ios
```

From `apps/web` only (after shared is built):

```bash
bun run ios:sync
bun run ios:open   # opens Xcode
```

Verify prod API is baked in:

```bash
rg -o 'apiBaseUrl:"[^"]+"' apps/web/dist/web/browser/*.js
# expect: apiBaseUrl:"https://api.atasoif.fr"
```

Generated web assets under `ios/App/App/public` and `capacitor.config.json` are **gitignored** — always run `ios:sync` before Archive.

## Xcode — Archive → TestFlight

Anthony must complete these steps locally (certs / Apple ID):

1. Open `apps/web/ios/App/App.xcodeproj` (`bun run ios:open` or Xcode).
2. Select target **App** → **Signing & Capabilities**:
   - Team: `D3UKXNVT3D`
   - Bundle Identifier: `fr.atasoif.app`
   - Automatically manage signing
3. Scheme **App**, destination **Any iOS Device (arm64)**.
4. Product → **Archive**.
5. Organizer → Distribute App → **App Store Connect** → Upload.
6. Wait for processing in [App Store Connect](https://appstoreconnect.apple.com) → TestFlight.
7. Add internal (and optionally external) testers; install via TestFlight on device.

If signing / provisioning fails, fix in Xcode or Apple Developer certificates — do not paste secrets into the repo or CI.

## App Store Connect checklist

- [ ] App created with bundle `fr.atasoif.app`
- [ ] Build uploaded and processed (no missing compliance blockers)
- [ ] Export compliance / encryption answers completed if prompted
- [ ] TestFlight internal group invited
- [ ] Smoke on device: launch → login (Google / Apple / magic link) → cellar against `https://api.atasoif.fr`

## Out of scope (this prep)

- IAP / RevenueCat (trials 7j annual / 3j monthly noted for later)
- Android / Play closed testing
- Facebook login (standby)
- Forced CI upload of IPA (manual Organizer upload is OK for holiday beta)
- Changing Ally Services ID (`com.atasoif.web`) — web SIWA only unless native SIWA is added later

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| `web assets directory` missing | Run `bun run ios:sync` so `dist/web/browser` exists |
| Wrong API host in app | Confirm production build (not `environment.development.ts`); re-sync |
| Signing errors | Team + bundle in Xcode; regenerate provisioning in Apple Developer |
| Blank WebView | Confirm `cap sync` copied `index.html` into `ios/App/App/public` |
| ATS / network | API is HTTPS; check device network and API CORS if using custom schemes later |
