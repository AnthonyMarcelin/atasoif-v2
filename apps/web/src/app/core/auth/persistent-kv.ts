import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

function readLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Quota / private mode — memory-only fallback is handled by callers.
  }
}

function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Sync read for Angular bootstrap after `persistHydrate`. */
export function persistRead(key: string): string | null {
  return readLocal(key);
}

export function persistWrite(key: string, value: string): void {
  writeLocal(key, value);
  void Preferences.set({ key, value }).catch(() => undefined);
}

export function persistRemove(key: string): void {
  removeLocal(key);
  void Preferences.remove({ key }).catch(() => undefined);
}

/**
 * Restore Capacitor Preferences into localStorage (and migrate the reverse on native).
 * Must run before AuthService reads the Bearer token.
 */
export async function persistHydrate(keys: readonly string[]): Promise<void> {
  for (const key of keys) {
    try {
      const { value } = await Preferences.get({ key });
      if (value != null && value !== '') {
        writeLocal(key, value);
        continue;
      }
      const local = readLocal(key);
      if (local != null && Capacitor.isNativePlatform()) {
        await Preferences.set({ key, value: local });
      }
    } catch {
      // Keep whatever localStorage already has.
    }
  }
}
