import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { apiErrorMessage } from './auth/api-error';
import { AuthService } from './auth/auth.service';

const TAP_WINDOW_MS = 5000;
const TAP_TARGET = 7;

/**
 * Store-review gate: 7 taps on the logo within 5s reveals a secret field.
 * Validation is server-side only (`POST /api/v1/auth/store-review`).
 * Never bake `STORE_REVIEW_SECRET` into the web / Capacitor build.
 */
@Component({
  selector: 'app-store-review-bypass',
  standalone: true,
  template: `
    <div class="store-review">
      <button
        type="button"
        class="store-review__logo"
        (click)="onLogoTap()"
        [attr.aria-label]="ariaLabel"
      >
        <span class="store-review__mark" aria-hidden="true">
          <span class="store-review__cap"></span>
          <span class="store-review__body"></span>
        </span>
        <span class="store-review__brand">À ta soif !</span>
      </button>

      @if (unlocked()) {
        <div class="store-review__panel" role="group" aria-label="Accès revue store">
          <label class="auth-field__label" for="store-review-secret">Code revue</label>
          <input
            id="store-review-secret"
            class="auth-field__control"
            type="password"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            [value]="secretInput()"
            (input)="secretInput.set($any($event.target).value)"
            [disabled]="submitting()"
          />
          @if (error(); as message) {
            <p class="auth-field__error" role="alert">{{ message }}</p>
          }
          <button
            type="button"
            class="auth-btn auth-btn--secondary"
            (click)="validate()"
            [disabled]="!secretInput().trim() || submitting()"
          >
            Valider
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .store-review {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        margin-bottom: var(--space-sm);
      }

      .store-review__logo {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
        min-height: var(--tap-min);
      }

      .store-review__logo:focus-visible {
        outline: var(--stroke-accent) solid var(--color-accent);
        outline-offset: 4px;
      }

      .store-review__mark {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
      }

      .store-review__cap {
        width: 8px;
        height: 6px;
        background: var(--color-accent);
      }

      .store-review__body {
        width: 14px;
        height: 16px;
        background: var(--color-accent);
      }

      .store-review__brand {
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: var(--text-mono);
        letter-spacing: var(--mono-track);
        text-transform: uppercase;
        color: var(--color-accent);
      }

      .store-review__panel {
        display: flex;
        flex-direction: column;
        gap: var(--space-sm);
        padding: var(--space-md);
        border: var(--stroke) solid var(--color-border);
        background: var(--color-surface);
      }
    `,
  ],
})
export class StoreReviewBypass {
  private readonly auth = inject(AuthService);

  @Output() readonly unlockedOk = new EventEmitter<void>();

  readonly unlocked = signal(false);
  readonly secretInput = signal('');
  readonly error = signal<string | null>(null);
  readonly submitting = signal(false);

  private taps: number[] = [];

  get ariaLabel(): string {
    return 'À ta soif';
  }

  onLogoTap(): void {
    const now = Date.now();
    this.taps = this.taps.filter((t) => now - t < TAP_WINDOW_MS);
    this.taps.push(now);
    if (this.taps.length >= TAP_TARGET) {
      this.taps = [];
      this.unlocked.set(true);
      this.error.set(null);
    }
  }

  validate(): void {
    this.error.set(null);
    const given = this.secretInput().trim();
    if (!given || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.auth
      .validateStoreReview(given)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: () => this.unlockedOk.emit(),
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err, 'Code incorrect.'));
        },
      });
  }
}
