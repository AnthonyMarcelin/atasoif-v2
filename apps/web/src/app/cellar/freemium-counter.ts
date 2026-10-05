import { Component, Input } from '@angular/core';
import { FREE_BOTTLE_LIMIT } from '@atasoif/shared';

import type { FreemiumMeta } from './cellar.types';

/** Empty cellar copy when the list has no rows. The cap uses lifetime creates, not row count. */
export type CellarEmptyKind = 'first' | 'again' | 'full';

export function cellarEmptyKind(freemium: FreemiumMeta | null): CellarEmptyKind {
  if (!freemium) {
    return 'first';
  }
  const capHit =
    !freemium.entitlement &&
    (freemium.remaining === 0 || freemium.count >= (freemium.limit || FREE_BOTTLE_LIMIT));
  if (capHit) {
    return 'full';
  }
  if (freemium.count > 0) {
    return 'again';
  }
  return 'first';
}

export function freemiumSlots(freemium: FreemiumMeta | null): boolean[] {
  const limit = freemium?.limit ?? FREE_BOTTLE_LIMIT;
  const count = Math.min(freemium?.count ?? 0, limit);
  return Array.from({ length: limit }, (_, i) => i < count);
}

@Component({
  selector: 'app-freemium-counter',
  standalone: true,
  template: `
    @if (variant === 'footer') {
      <div class="freemium-footer" [attr.aria-label]="ariaLabel">
        <span class="freemium-footer__label"
          >{{ count }} / {{ freemium?.limit ?? limit }} DANS TA CAVE</span
        >
        <div class="freemium-footer__bars" aria-hidden="true">
          @for (filled of slots; track $index) {
            <span class="freemium-footer__bar" [class.is-filled]="filled"></span>
          }
        </div>
      </div>
    } @else {
      <div
        class="freemium-counter"
        [class.is-full]="isFull"
        [attr.aria-label]="ariaLabel"
      >
        @if (entitled) {
          <span class="freemium-counter__count">{{ count }}</span>
        } @else {
          <span class="freemium-counter__count">{{ paddedCount }}</span
          ><span class="freemium-counter__limit">/{{ freemium?.limit ?? limit }}</span>
        }
      </div>
    }
  `,
  styles: [
    `
      .freemium-counter {
        display: flex;
        align-items: baseline;
        margin: 0;
        font-family: var(--font-mono);
        letter-spacing: var(--mono-track);
      }

      .freemium-counter__count {
        font-size: var(--text-mono-l);
        font-weight: 700;
        color: var(--color-accent);
      }

      .freemium-counter__limit {
        font-size: var(--text-mono);
        font-weight: 700;
        color: var(--color-ink-muted);
      }

      .freemium-footer {
        display: flex;
        width: 100%;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-md);
        font-family: var(--font-mono);
      }

      .freemium-footer__label {
        font-size: var(--text-mono);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--color-ink-3);
      }

      .freemium-footer__bars {
        display: flex;
        gap: 3px;
      }

      .freemium-footer__bar {
        width: 7px;
        height: 12px;
        border: var(--stroke) solid var(--color-border);
        background: transparent;
      }

      .freemium-footer__bar.is-filled {
        border-color: var(--color-accent);
        background: var(--color-accent);
      }
    `,
  ],
})
export class FreemiumCounter {
  @Input() freemium: FreemiumMeta | null = null;
  @Input() variant: 'default' | 'footer' = 'default';

  readonly limit = FREE_BOTTLE_LIMIT;

  get entitled(): boolean {
    return Boolean(this.freemium?.entitlement);
  }

  get count(): number {
    return this.freemium?.count ?? 0;
  }

  get paddedCount(): string {
    const limit = this.freemium?.limit ?? this.limit;
    const width = String(limit).length;
    return String(this.count).padStart(width, '0');
  }

  get slots(): boolean[] {
    return freemiumSlots(this.freemium);
  }

  get isFull(): boolean {
    return !this.entitled && this.count >= (this.freemium?.limit ?? this.limit);
  }

  get ariaLabel(): string {
    const limit = this.freemium?.limit ?? this.limit;
    if (this.entitled) {
      return `${this.count} bouteilles ajoutées`;
    }
    return `${this.count} sur ${limit} ajouts, suppressions comprises`;
  }
}
