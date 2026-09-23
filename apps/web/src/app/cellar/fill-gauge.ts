import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FILL_LEVEL_DEFAULT } from '@atasoif/shared';

import { clampFillLevel, fillLevelFromClientY, fillMotionInstant } from './fill-level';

const KEY_STEP = 5;
const KEY_STEP_LARGE = 10;
const KEY_COMMIT_MS = 280;

/**
 * Fill-level jauge (Nuit: ivory stroke, amber fill).
 * Premium: swipe / drag or arrow keys, then one save on gesture end.
 * Free: locked teaser. A gesture opens the paywall and never emits a level.
 */
@Component({
  selector: 'app-fill-gauge',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="fill-gauge" [class.is-locked]="locked">
      <div
        class="fill-gauge__track"
        [attr.role]="locked ? 'img' : 'slider'"
        [attr.tabindex]="locked ? null : 0"
        [attr.aria-label]="ariaLabel"
        [attr.aria-valuemin]="locked ? null : 0"
        [attr.aria-valuemax]="locked ? null : 100"
        [attr.aria-valuenow]="locked ? null : displayLevel"
        [attr.aria-valuetext]="locked ? null : valueText"
        [attr.aria-orientation]="locked ? null : 'vertical'"
        [attr.aria-describedby]="locked ? null : hintId"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerCancel()"
        (keydown)="onKeydown($event)"
      >
        <div
          class="fill-gauge__fill"
          [class.is-instant]="motionInstant"
          [style.height.%]="displayLevel"
        ></div>
      </div>
      <div class="fill-gauge__meta">
        <span class="fill-gauge__label">Niveau</span>
        @if (locked) {
          <a class="fill-gauge__lock" routerLink="/cave/premium" [queryParams]="{ reason: 'jauge' }">
            Premium · débloque la jauge
          </a>
        } @else {
          <span class="fill-gauge__value">{{ displayLevel }}%</span>
          <span class="fill-gauge__hint" [id]="hintId">Glisse pour le niveau</span>
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
        width: 48px;
        height: 140px;
        border: var(--stroke) solid var(--color-border-strong);
        background: var(--color-bg);
        overflow: hidden;
        flex-shrink: 0;
        touch-action: none;
        user-select: none;
        cursor: ns-resize;
      }

      .fill-gauge.is-locked .fill-gauge__track {
        cursor: pointer;
      }

      .fill-gauge__track:focus-visible {
        outline: var(--stroke-accent) solid var(--color-accent);
        outline-offset: 3px;
      }

      .fill-gauge__fill {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        background: var(--color-accent);
        transition: height var(--dur-fill) var(--ease);
      }

      .fill-gauge__fill.is-instant {
        transition: none;
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

      .fill-gauge__label,
      .fill-gauge__hint {
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
export class FillGauge implements OnChanges, OnDestroy {
  private static nextHint = 0;

  @Input() fillLevel: number = FILL_LEVEL_DEFAULT;
  @Input() locked = true;
  /** Bump to drop an unsaved preview (failed save). */
  @Input() syncKey = 0;

  @Output() readonly levelChange = new EventEmitter<number>();
  @Output() readonly lockedGesture = new EventEmitter<void>();

  readonly hintId = `fill-hint-${FillGauge.nextHint++}`;

  private dragging = false;
  private localLevel: number | null = null;
  private commitTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (this.dragging) {
      return;
    }
    if (changes['fillLevel'] || changes['syncKey']) {
      this.localLevel = null;
    }
  }

  ngOnDestroy(): void {
    this.clearCommitTimer();
  }

  get displayLevel(): number {
    if (this.localLevel !== null) {
      return this.localLevel;
    }
    return clampFillLevel(this.fillLevel);
  }

  get motionInstant(): boolean {
    return fillMotionInstant(this.dragging, this.prefersReducedMotion());
  }

  get ariaLabel(): string {
    if (this.locked) {
      return 'Jauge de niveau verrouillée · premium requis';
    }
    return 'Niveau de la bouteille';
  }

  get valueText(): string {
    return `${this.displayLevel} pour cent`;
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    if (this.locked) {
      event.preventDefault();
      this.lockedGesture.emit();
      return;
    }
    const track = event.currentTarget;
    if (!(track instanceof HTMLElement)) {
      return;
    }
    track.setPointerCapture(event.pointerId);
    this.clearCommitTimer();
    this.dragging = true;
    this.localLevel = fillLevelFromClientY(event.clientY, track.getBoundingClientRect());
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging || this.locked) {
      return;
    }
    const track = event.currentTarget;
    if (!(track instanceof HTMLElement)) {
      return;
    }
    this.localLevel = fillLevelFromClientY(event.clientY, track.getBoundingClientRect());
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging || this.locked) {
      return;
    }
    const track = event.currentTarget;
    if (track instanceof HTMLElement) {
      this.localLevel = fillLevelFromClientY(event.clientY, track.getBoundingClientRect());
      if (track.hasPointerCapture(event.pointerId)) {
        track.releasePointerCapture(event.pointerId);
      }
    }
    this.dragging = false;
    this.emitIfChanged();
  }

  onPointerCancel(): void {
    this.dragging = false;
    this.localLevel = null;
    this.clearCommitTimer();
  }

  onKeydown(event: KeyboardEvent): void {
    if (this.locked) {
      return;
    }
    const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
    let next = this.displayLevel;
    switch (event.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        next = clampFillLevel(next + step);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        next = clampFillLevel(next - step);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    this.localLevel = next;
    this.scheduleEmit();
  }

  private scheduleEmit(): void {
    this.clearCommitTimer();
    this.commitTimer = setTimeout(() => {
      this.commitTimer = null;
      this.emitIfChanged();
    }, KEY_COMMIT_MS);
  }

  private emitIfChanged(): void {
    if (this.locked) {
      return;
    }
    const next = this.localLevel;
    if (next === null) {
      return;
    }
    if (next === clampFillLevel(this.fillLevel)) {
      this.localLevel = null;
      return;
    }
    this.levelChange.emit(next);
  }

  private clearCommitTimer(): void {
    if (this.commitTimer !== null) {
      clearTimeout(this.commitTimer);
      this.commitTimer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }
}
