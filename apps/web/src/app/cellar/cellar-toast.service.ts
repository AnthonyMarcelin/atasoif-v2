import { Injectable, signal } from '@angular/core';

/** Lightweight in-app toast for cellar feedback (bonus slots, etc.). */
@Injectable({ providedIn: 'root' })
export class CellarToastService {
  readonly message = signal<string | null>(null);
  private clearTimer: ReturnType<typeof setTimeout> | null = null;

  show(text: string, ms = 3200): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.message.set(text);
    this.clearTimer = setTimeout(() => {
      this.message.set(null);
      this.clearTimer = null;
    }, ms);
  }

  dismiss(): void {
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
      this.clearTimer = null;
    }
    this.message.set(null);
  }
}

/** French toast copy for newly granted bonus slots. */
export function rewardSlotsToast(slots: number): string {
  if (slots === 1) {
    return '+1 place dans ta cave';
  }
  return `+${slots} places dans ta cave`;
}
