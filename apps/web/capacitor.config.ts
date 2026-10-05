import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell for the Angular cave (`apps/web`).
 * Bundle ID must match App Store Connect: fr.atasoif.app (Team D3UKXNVT3D).
 * Apple Services ID for web SIWA remains com.atasoif.web (API Ally) — distinct from this appId.
 */
const config: CapacitorConfig = {
  appId: 'fr.atasoif.app',
  appName: 'À ta soif',
  webDir: 'dist/web/browser',
  server: {
    // Prod API is absolute (https://api.atasoif.fr); no local live-reload server in release builds.
    androidScheme: 'https',
  },
};

export default config;
