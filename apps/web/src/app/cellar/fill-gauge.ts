import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FILL_LEVEL_DEFAULT } from '@atasoif/shared';

/**
 * Fill-level jauge (Nuit: ivory stroke, amber fill).
 * Free: locked teaser → premium. Premium interactive swipe deferred (T08).
 */
@Component({
  selector: 'app-fill-gauge',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="fill-gauge" [class.is-locked]="locked">
      <div
        class="fill-gauge__track"
        role="img"
        [attr.aria-label]="ariaLabel"
      >
        <div class="fill-gauge__fill" [style.height.%]="displayLevel"></div>
      </div>
      <div class="fill-gauge__meta">
        <span class="fill-gauge__label">Niveau</span>
        @if (locked) {
          <a class="fill-gauge__lock" routerLink="/cave/premium" [queryParams]="{ reason: 'jauge' }">
            Premium · débloque la jauge
          </a>
        } @else {
          <span class="fill-gauge__value">{{ displayLevel }}%</span>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .fill-gauge {
        display: flex;
        align-items: center;
        gap: var(--space-md);
      }

      .fill-gauge__track {
        position: relative;
        width: 36px;
        height: 88px;
        border: var(--stroke) solid var(--color-border-strong);
        background: var(--color-bg);
        overflow: hidden;
        flex-shrink: 0;
      }

      .fill-gauge__fill {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--color-accent);
        transition: height var(--dur-fill) var(--ease);
      }

      .fill-gauge.is-locked .fill-gauge__fill {
        opacity: 0.35;
      }

      .fill-gauge__meta {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .fill-gauge__label {
        font-family: var(--font-mono);
        font-size: var(--text-mono-s);
        letter-spacing: var(--mono-track);
        text-transform: uppercase;
        color: var(--color-ink-muted);
      }

      .fill-gauge__value {
        font-family: var(--font-mono);
        font-size: var(--text-mono-l);
        font-weight: 700;
        color: var(--color-ink);
      }

      .fill-gauge__lock {
        font-size: var(--text-body-s);
        color: var(--color-accent);
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .fill-gauge__lock:focus-visible {
        outline: var(--stroke-accent) solid var(--color-accent);
        outline-offset: 2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .fill-gauge__fill {
          transition: none;
        }
      }
    `,
  ],
})
export class FillGauge {
  @Input() fillLevel: number = FILL_LEVEL_DEFAULT;
  @Input() locked = true;

  get displayLevel(): number {
    const n = Number(this.fillLevel);
    if (Number.isNaN(n)) {
      return FILL_LEVEL_DEFAULT;
    }
    return Math.min(100, Math.max(0, n));
  }

  get ariaLabel(): string {
    if (this.locked) {
      return 'Jauge de niveau verrouillée · premium requis';
    }
    return `Niveau de la bouteille : ${this.displayLevel} pour cent`;
  }
}
