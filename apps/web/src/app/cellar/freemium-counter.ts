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

@Component({
  selector: 'app-freemium-counter',
  standalone: true,
  template: `
    <p
      class="freemium-counter"
      [class.is-full]="isFull"
      [attr.aria-label]="ariaLabel"
    >
      <span class="freemium-counter__value">{{ label }}</span>
      @if (!entitled) {
        <span class="freemium-counter__hint">{{ hint }}</span>
      }
    </p>
  `,
  styles: [
    `
      .freemium-counter {
        display: flex;
        align-items: baseline;
        gap: var(--space-sm);
        margin: 0;
        font-family: var(--font-mono);
        letter-spacing: var(--mono-track);
      }

      .freemium-counter__value {
        font-size: var(--text-mono-l);
        font-weight: 700;
        color: var(--color-ink);
      }

      .freemium-counter.is-full .freemium-counter__value {
        color: var(--color-accent);
      }

      .freemium-counter__hint {
        font-size: var(--text-mono-s);
        text-transform: uppercase;
        color: var(--color-ink-muted);
      }
    `,
  ],
})
export class FreemiumCounter {
  @Input() freemium: FreemiumMeta | null = null;

  readonly limit = FREE_BOTTLE_LIMIT;

  get entitled(): boolean {
    return Boolean(this.freemium?.entitlement);
  }

  get count(): number {
    return this.freemium?.count ?? 0;
  }

  get isFull(): boolean {
    return !this.entitled && this.count >= this.limit;
  }

  get label(): string {
    if (this.entitled) {
      return `${this.count}`;
    }
    return `${this.count}/${this.freemium?.limit ?? this.limit}`;
  }

  get hint(): string {
    if (this.isFull) {
      return 'Cave pleine';
    }
    return 'bouteilles';
  }

  get ariaLabel(): string {
    const limit = this.freemium?.limit ?? this.limit;
    if (this.entitled) {
      return `${this.count} bouteilles ajoutées`;
    }
    return `${this.count} sur ${limit} ajouts, suppressions comprises`;
  }
}
