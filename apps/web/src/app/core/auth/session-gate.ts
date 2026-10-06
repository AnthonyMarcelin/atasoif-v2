import { Injectable, signal } from '@angular/core';

/**
 * In-memory biometric lock. Tokens stay in Preferences — this only gates the UI.
 * `cover` hides the cave while Face ID runs; after cancel we drop the cover so login works.
 */
@Injectable({ providedIn: 'root' })
export class SessionGate {
  private readonly lockedSignal = signal(false);
  private readonly coverSignal = signal(false);

  readonly locked = this.lockedSignal.asReadonly();
  readonly cover = this.coverSignal.asReadonly();

  requireUnlock(): void {
    this.lockedSignal.set(true);
    this.coverSignal.set(true);
  }

  revealLogin(): void {
    this.lockedSignal.set(true);
    this.coverSignal.set(false);
  }

  unlock(): void {
    this.lockedSignal.set(false);
    this.coverSignal.set(false);
  }
}
