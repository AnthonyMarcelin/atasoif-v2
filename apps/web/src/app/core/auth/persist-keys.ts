/** Keys mirrored in localStorage + Capacitor Preferences (iOS may purge WebView storage). */
export const AUTH_TOKEN_KEY = 'atasoif.auth.access_token';
export const AUTH_USER_KEY = 'atasoif.auth.user';
export const BIOMETRIC_ENABLED_KEY = 'atasoif.biometric.enabled';

export const AUTH_PERSIST_KEYS = [AUTH_TOKEN_KEY, AUTH_USER_KEY, BIOMETRIC_ENABLED_KEY] as const;
