import { Capacitor, registerPlugin } from '@capacitor/core';

export const OAUTH_CALLBACK_SCHEME = 'fr.atasoif.app';
export const OAUTH_CALLBACK_URL = `${OAUTH_CALLBACK_SCHEME}://auth/oauth/callback`;

interface OAuthSessionPlugin {
  start(options: { url: string; callbackScheme: string }): Promise<{ url: string }>;
}

const OAuthSession = registerPlugin<OAuthSessionPlugin>('OAuthSession');

/**
 * Read Bearer token from an OAuth return URL (`#token=` preferred, `?token=` fallback).
 */
export function readOAuthTokenFromUrl(rawUrl: string): string | null {
  try {
    const hashIndex = rawUrl.indexOf('#');
    if (hashIndex >= 0) {
      const hash = rawUrl.slice(hashIndex + 1);
      const fromHash = new URLSearchParams(hash).get('token');
      if (fromHash) {
        return fromHash;
      }
    }
    const url = new URL(rawUrl);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

export function readOAuthErrorFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    return url.searchParams.get('oauthError');
  } catch {
    return null;
  }
}

/**
 * Open Ally redirect in ASWebAuthenticationSession (iOS) when the native plugin exists.
 * Falls back to full-page navigation on web / missing plugin.
 */
export async function startNativeOAuthSession(authorizeUrl: string): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    const { url } = await OAuthSession.start({
      url: authorizeUrl,
      callbackScheme: OAUTH_CALLBACK_SCHEME,
    });
    return url;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel/i.test(message)) {
      return null;
    }
    // Plugin missing in web test / older binary — caller falls back to location.assign.
    throw error;
  }
}
