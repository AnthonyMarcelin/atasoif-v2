import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

import { BIOMETRIC_ENABLED_KEY } from './persist-keys';
import { persistRead, persistRemove, persistWrite } from './persistent-kv';

const CREDENTIAL_SERVER = 'fr.atasoif.app';

const VERIFY_OPTIONS = {
  reason: 'Déverrouille ta cave',
  title: 'À ta soif',
  subtitle: 'Face ID ou Touch ID',
  description: 'Confirme que c’est bien toi',
  negativeButtonText: 'Mot de passe',
  useFallback: true,
} as const;

export type BiometricVerifyResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'failed' };

export type BiometricGateResult =
  | { ok: true; email: string; password: string }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'empty' | 'failed' };

/**
 * Face ID / Touch ID gate. Session tokens stay in Preferences — this only proves identity.
 * Optional Keychain password is a fallback when the Bearer token is missing.
 */
@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
  readonly isNative = Capacitor.isNativePlatform();

  isEnabledPreference(): boolean {
    return persistRead(BIOMETRIC_ENABLED_KEY) === '1';
  }

  setEnabledPreference(enabled: boolean): void {
    if (enabled) {
      persistWrite(BIOMETRIC_ENABLED_KEY, '1');
    } else {
      persistRemove(BIOMETRIC_ENABLED_KEY);
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isNative) {
      return false;
    }
    try {
      const result = await NativeBiometric.isAvailable();
      return Boolean(result.isAvailable);
    } catch {
      return false;
    }
  }

  async rememberLogin(email: string, password: string): Promise<void> {
    if (!this.isNative || !email || !password || !this.isEnabledPreference()) {
      return;
    }
    try {
      const available = await this.isAvailable();
      if (!available) {
        return;
      }
      await NativeBiometric.setCredentials({
        username: email,
        password,
        server: CREDENTIAL_SERVER,
      });
    } catch {
      // Biometric vault is best-effort; password login remains.
    }
  }

  /** Prompt Face ID / Touch ID without reading or replacing the auth token. */
  async verifyUnlock(): Promise<BiometricVerifyResult> {
    if (!this.isNative) {
      return { ok: false, reason: 'unavailable' };
    }
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { ok: false, reason: 'unavailable' };
      }
      await NativeBiometric.verifyIdentity({ ...VERIFY_OPTIONS });
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, reason: this.classifyError(err) };
    }
  }

  async unlock(): Promise<BiometricGateResult> {
    const verified = await this.verifyUnlock();
    if (!verified.ok) {
      return verified;
    }
    try {
      const credentials = await NativeBiometric.getCredentials({
        server: CREDENTIAL_SERVER,
      });
      if (!credentials.username || !credentials.password) {
        return { ok: false, reason: 'empty' };
      }
      return {
        ok: true,
        email: credentials.username,
        password: credentials.password,
      };
    } catch (err: unknown) {
      return { ok: false, reason: this.classifyError(err) === 'cancelled' ? 'cancelled' : 'failed' };
    }
  }

  async clear(): Promise<void> {
    if (!this.isNative) {
      return;
    }
    try {
      await NativeBiometric.deleteCredentials({ server: CREDENTIAL_SERVER });
    } catch {
      // ignore
    }
  }

  private classifyError(err: unknown): 'cancelled' | 'failed' {
    const message =
      err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : '';
    if (/cancel|dismiss|user|fallback/i.test(message)) {
      return 'cancelled';
    }
    return 'failed';
  }
}
