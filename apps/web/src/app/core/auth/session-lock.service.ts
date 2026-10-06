import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';

import { AuthService } from './auth.service';
import { BiometricAuthService } from './biometric-auth.service';
import { SessionGate } from './session-gate';

/** Ignore app pause/resume churn from the Face ID / system biometric sheet. */
const BIOMETRIC_APP_STATE_GRACE_MS = 2_000;

/** Face ID must not block login forever (hung native sheet → black screen). */
const BIOMETRIC_VERIFY_TIMEOUT_MS = 8_000;

type PromptOptions = {
  /** Full-screen cover hides the cave. Cold start uses login instead (fail-open). */
  allowCover?: boolean;
};

@Injectable({ providedIn: 'root' })
export class SessionLockService {
  private readonly auth = inject(AuthService);
  private readonly biometrics = inject(BiometricAuthService);
  private readonly gate = inject(SessionGate);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private started = false;
  private prompting = false;
  private ignoreAppStateUntil = 0;
  /** After fail-open / cancel, do not auto Face ID again until a successful unlock. */
  private passwordFallback = false;
  private appListener: PluginListenerHandle | null = null;

  shouldLock(): boolean {
    return (
      this.biometrics.isNative &&
      this.biometrics.isEnabledPreference() &&
      Boolean(this.auth.getAccessToken())
    );
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    if (!this.auth.getAccessToken()) {
      // No session → never biometric-gate the UI; login/welcome must render.
      this.gate.unlock();
      this.passwordFallback = false;
    } else if (this.shouldLock()) {
      // Cold start: show login immediately (fail-open). Do not blank the WebView
      // behind a cover while Face ID may hang and never paint a dismiss control.
      this.failOpenToLogin();
      void this.promptUnlock({ allowCover: false });
    }

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    this.appListener = await App.addListener('appStateChange', ({ isActive }) => {
      this.zone.run(() => {
        if (this.shouldIgnoreAppState()) {
          return;
        }
        if (!isActive) {
          if (this.shouldLock() && !this.passwordFallback) {
            this.gate.requireUnlock();
          }
          return;
        }
        // Only prompt when already locked. `shouldLock()` alone is true while unlocked
        // with biometrics on — using it here re-prompts after every Face ID dismissal.
        if (this.gate.locked() && !this.passwordFallback) {
          void this.promptUnlock({ allowCover: true });
        }
      });
    });
  }

  async promptUnlock(options: PromptOptions = {}): Promise<boolean> {
    const allowCover = options.allowCover !== false;

    if (this.prompting) {
      return false;
    }

    // No bearer token → never block on Face ID.
    if (!this.auth.getAccessToken()) {
      this.gate.unlock();
      this.passwordFallback = false;
      this.failOpenToLogin();
      return false;
    }

    if (!this.shouldLock()) {
      this.gate.unlock();
      this.passwordFallback = false;
      return true;
    }

    if (allowCover) {
      this.gate.requireUnlock();
    } else {
      // Keep login visible underneath the system Face ID sheet.
      this.gate.revealLogin();
    }

    this.prompting = true;
    try {
      const result = await this.verifyWithTimeout();
      // Biometric UI backgrounds the WebView; ignore the matching resume burst.
      this.armAppStateGrace();
      if (result.ok) {
        this.passwordFallback = false;
        this.gate.unlock();
        const target = this.auth.postAuthPath('/cave');
        if (this.router.url === '/' || this.router.url.startsWith('/auth/login')) {
          void this.router.navigateByUrl(target);
        }
        return true;
      }

      // Cancel, unavailable, failed, or timeout → always reach login.
      this.failOpenToLogin();
      return false;
    } finally {
      this.prompting = false;
    }
  }

  /** User chose password (or fail-open) — keep login reachable, stop auto Face ID. */
  usePasswordFallback(): void {
    this.failOpenToLogin();
  }

  async stop(): Promise<void> {
    await this.appListener?.remove();
    this.appListener = null;
    this.started = false;
  }

  /** @internal test helper — simulates Capacitor appStateChange. */
  handleAppStateForTests(isActive: boolean): void {
    if (this.shouldIgnoreAppState()) {
      return;
    }
    if (!isActive) {
      if (this.shouldLock() && !this.passwordFallback) {
        this.gate.requireUnlock();
      }
      return;
    }
    if (this.gate.locked() && !this.passwordFallback) {
      void this.promptUnlock({ allowCover: true });
    }
  }

  private failOpenToLogin(): void {
    this.passwordFallback = true;
    this.gate.revealLogin();
    if (!this.router.url.startsWith('/auth/login')) {
      void this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: '/cave' },
      });
    }
  }

  private async verifyWithTimeout(): Promise<{ ok: true } | { ok: false; reason: string }> {
    try {
      return await Promise.race([
        this.biometrics.verifyUnlock(),
        new Promise<{ ok: false; reason: 'timeout' }>((resolve) => {
          setTimeout(() => resolve({ ok: false, reason: 'timeout' }), BIOMETRIC_VERIFY_TIMEOUT_MS);
        }),
      ]);
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }

  private shouldIgnoreAppState(): boolean {
    return this.prompting || Date.now() < this.ignoreAppStateUntil;
  }

  private armAppStateGrace(): void {
    this.ignoreAppStateUntil = Date.now() + BIOMETRIC_APP_STATE_GRACE_MS;
  }
}
