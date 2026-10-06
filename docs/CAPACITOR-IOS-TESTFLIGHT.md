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
| Xcode workspace | `apps/web/ios/App/App.xcworkspace` (CocoaPods — open this, not the `.xcodeproj`) |
| Marketing version | `1.0.6` (`MARKETING_VERSION`) |
| Build number | `6` (`CURRENT_PROJECT_VERSION`) |
| iOS deps | CocoaPods (`Podfile`) — required for `@capacitor-mlkit/barcode-scanning` (no SPM) |

Distribution preference: **native stores via Capacitor** — not a Dokploy `app.` / `cave.` subdomain (see Context prefs). Next Android AAB is later; do not bump Play versioning here.

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

1. On a Mac: `bun install` then `bun run ios:sync` (runs `cap sync ios`, normalizes Podfile paths for Bun, then CocoaPods).
2. If pods were skipped (no CocoaPods locally): `cd apps/web/ios/App && pod install`.
3. Open `apps/web/ios/App/App.xcworkspace` (`bun run ios:open` or Xcode) — **not** the `.xcodeproj`.
4. Select target **App** → **Signing & Capabilities**:
   - Team: `D3UKXNVT3D`
   - Bundle Identifier: `fr.atasoif.app`
   - Automatically manage signing
5. Scheme **App**, destination **Any iOS Device (arm64)**.
6. Product → **Archive**.
7. Organizer → Distribute App → **App Store Connect** → Upload.
8. Wait for processing in [App Store Connect](https://appstoreconnect.apple.com) → TestFlight.
9. Add internal (and optionally external) testers; install via TestFlight on device.
10. Smoke: **SCAN** opens the native barcode camera; **Ajouter une photo** shows the system sheet (Bibliothèque / Appareil photo).
11. Smoke: double-tap on UI does **not** zoom the WebView (`zoomEnabled: false` + viewport `maximum-scale=1` / `user-scalable=no`).

If signing / provisioning fails, fix in Xcode or Apple Developer certificates — do not paste secrets into the repo or CI.

## App Store Connect checklist

- [ ] App created with bundle `fr.atasoif.app`
- [ ] Build uploaded and processed (no missing compliance blockers)
- [ ] Export compliance / encryption answers completed if prompted
- [ ] TestFlight internal group invited
- [ ] Smoke on device: launch → login (Google / Apple / magic link) → cellar against `https://api.atasoif.fr`

## Out of scope (this prep)

- **IAP purchase sheet** — Premium UI is structured for an in-app StoreKit / Play Billing modal (via RevenueCat later). Do **not** redirect to an App Store product webpage. Cancel/manage already deep-links to Apple/Google subscription settings. Restore purchases is a placeholder until E4.
- IAP / RevenueCat wiring itself (trials 7j annual / 3j monthly noted for later)
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
| Apple login opens Safari then Adonis 404 `/auth/oauth/callback` | Set Dokploy `NATIVE_OAUTH_RETURN_URL=fr.atasoif.app://auth/oauth/callback` and keep `FRONTEND_URL` off the API host; rebuild app (ASWebAuthenticationSession + URL scheme). API also serves HTML handoff at `GET /auth/oauth/callback`. |
| SCAN dead / “ML Kit” / no camera | Open **`.xcworkspace`** after `pod install`. ML Kit is CocoaPods-only (SPM cannot link it). Re-run `bun run ios:sync` then Archive. |
| Photo shows separate Caméra / Photothèque buttons | Native pick must use `CameraSource.Prompt` (system sheet). Rebuild web + sync. |

## Invite / share links (`https://atasoif.fr/i/:code`)

Clipboard and SMS must always copy an **absolute https** URL (e.g. `https://atasoif.fr/i/F702EA`). Host-only text is not tappable in Messages.

| Layer | Behavior (MVP) |
| --- | --- |
| API | `SHARE_LINK_ORIGIN` (default `https://atasoif.fr`) → `inviteUrl` always `https://…/i/:code` |
| App copy | Friends + partage use `inviteUrl` / `absoluteShareInviteUrl` (never strip `https://`) |
| Site stub | `apps/site` route `/i/[code]` — CTA « Ouvrir dans l’app » (`fr.atasoif.app://i/:code`) + « Télécharger » (App Store / Play). On mobile, auto-tries the custom scheme then falls back to the store URL when `PUBLIC_IOS_URL` / `PUBLIC_ANDROID_URL` are real https links |
| Capacitor | Custom scheme already in Info.plist; `appUrlOpen` routes `…://i/:code` → `/cave/amis?invite=CODE` |

**Anthony — store URLs TBD:** set site env `PUBLIC_IOS_URL` / `PUBLIC_ANDROID_URL` (and `PUBLIC_CTA_MODE=stores`) when App Store / Play links exist. Until then the invite page shows a placeholder note.

### Universal Links (true open-app-from-https) — not wired yet

To make `https://atasoif.fr/i/:code` open the app without the custom-scheme hop:

1. **Apple Developer** → App ID `fr.atasoif.app` → enable **Associated Domains**.
2. **Xcode** → Signing & Capabilities → Associated Domains → `applinks:atasoif.fr` (and `applinks:www.atasoif.fr` if used).
3. Host **AASA** at `https://atasoif.fr/.well-known/apple-app-site-association` (no file extension, `Content-Type: application/json`):

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appIDs": ["D3UKXNVT3D.fr.atasoif.app"],
        "components": [
          { "/": "/i/*", "comment": "Friend invite codes" }
        ]
      }
    ]
  }
}
```

4. Capacitor: listen for `https://atasoif.fr/i/…` in `appUrlOpen` (same handler as custom scheme) and keep the site stub as fallback when the app is not installed.
5. **Android** (later): Digital Asset Links (`assetlinks.json`) + intent filters for `https://atasoif.fr/i/*`.

Do **not** ship AASA until the Associated Domains entitlement is on the App ID / provisioning profile — a wrong or early file caches poorly on Apple’s CDN.
