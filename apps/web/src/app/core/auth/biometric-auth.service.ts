import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

const CREDENTIAL_SERVER = 'fr.atasoif.app';
const ENABLED_KEY = 'atasoif.biometric.enabled';

export type BiometricGateResult =
  | { ok: true; email: string; password: string }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'empty' | 'failed' };

/**
 * Face ID / Touch ID unlock with password fallback storage.
 * Credentials stay in Keychain / Keystore — never logged.
 */
@Injectable({ providedIn: 'root' })
export class BiometricAuthService {
  readonly isNative = Capacitor.isNativePlatform();

  isEnabledPreference(): boolean {
    try {
      return localStorage.getItem(ENABLED_KEY) === '1';
    } catch {
      return false;
    }
  }

  setEnabledPreference(enabled: boolean): void {
    try {
      if (enabled) {
        localStorage.setItem(ENABLED_KEY, '1');
      } else {
        localStorage.removeItem(ENABLED_KEY);
      }
    } catch {
      // ignore quota / private mode
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

  async unlock(): Promise<BiometricGateResult> {
    if (!this.isNative) {
      return { ok: false, reason: 'unavailable' };
    }
    try {
      const available = await this.isAvailable();
      if (!available) {
        return { ok: false, reason: 'unavailable' };
      }
      await NativeBiometric.verifyIdentity({
        reason: 'Déverrouille ta cave',
        title: 'À ta soif',
        subtitle: 'Face ID ou Touch ID',
        description: 'Confirme que c’est bien toi',
        negativeButtonText: 'Mot de passe',
        useFallback: true,
      });
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
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      if (/cancel|dismiss|user|fallback/i.test(message)) {
        return { ok: false, reason: 'cancelled' };
      }
      return { ok: false, reason: 'failed' };
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
}
