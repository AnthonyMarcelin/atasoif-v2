import { Injectable, NgZone, inject } from '@angular/core';
import { Router } from '@angular/router';
import { App, type PluginListenerHandle } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

import { AuthService } from './auth.service';
import { BiometricAuthService } from './biometric-auth.service';
import { SessionGate } from './session-gate';

@Injectable({ providedIn: 'root' })
export class SessionLockService {
  private readonly auth = inject(AuthService);
  private readonly biometrics = inject(BiometricAuthService);
  private readonly gate = inject(SessionGate);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);

  private started = false;
  private prompting = false;
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

    if (this.shouldLock()) {
      this.gate.requireUnlock();
      await this.promptUnlock();
    }

    if (!Capacitor.isNativePlatform()) {
      return;
    }

    this.appListener = await App.addListener('appStateChange', ({ isActive }) => {
      this.zone.run(() => {
        if (!isActive) {
          if (this.shouldLock()) {
            this.gate.requireUnlock();
          }
          return;
        }
        if (this.gate.locked() || this.shouldLock()) {
          void this.promptUnlock();
        }
      });
    });
  }

  async promptUnlock(): Promise<boolean> {
    if (this.prompting) {
      return false;
    }
    if (!this.shouldLock()) {
      this.gate.unlock();
      return true;
    }

    this.gate.requireUnlock();
    this.prompting = true;
    try {
      const result = await this.biometrics.verifyUnlock();
      if (result.ok) {
        this.gate.unlock();
        const target = this.auth.postAuthPath('/cave');
        if (this.router.url === '/' || this.router.url.startsWith('/auth/login')) {
          void this.router.navigateByUrl(target);
        }
        return true;
      }

      this.gate.revealLogin();
      if (!this.router.url.startsWith('/auth/login')) {
        void this.router.navigate(['/auth/login'], {
          queryParams: { returnUrl: '/cave' },
        });
      }
      return false;
    } finally {
      this.prompting = false;
    }
  }

  async stop(): Promise<void> {
    await this.appListener?.remove();
    this.appListener = null;
    this.started = false;
  }
}
