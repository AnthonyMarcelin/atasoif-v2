import { HttpClient } from '@angular/common/http';
import {
  Component,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { Subscription } from 'rxjs';

import { environment } from '../../environments/environment';
import { absoluteApiUrl, photoNeedsBearer } from './photo-url';

/**
 * Bottle photo: real URL or Nuit striped placeholder (list square / detail 3:4).
 * Authenticated shelf / catalog paths are loaded with the bearer token (blob URL).
 * Framing uses contain so tall packshots are not cropped to neck-only thumbs.
 * When a real photo is present, tap opens an accessible lightbox (contain, full view).
 */
@Component({
  selector: 'app-bottle-photo',
  standalone: true,
  template: `
    <div
      class="bottle-photo"
      [class.bottle-photo--detail]="variant === 'detail'"
      [class.bottle-photo--list]="variant === 'list'"
      [class.bottle-photo--zoomable]="canZoom"
      role="img"
      [attr.aria-label]="alt"
    >
      @if (resolvedSrc) {
        <button
          type="button"
          class="bottle-photo__hit"
          (click)="openLightbox($event)"
          [attr.aria-label]="'Agrandir la photo · ' + alt"
        >
          <img class="bottle-photo__img" [src]="resolvedSrc" [alt]="alt" loading="lazy" />
        </button>
      } @else {
        <div class="bottle-photo__stripes" aria-hidden="true"></div>
      }
    </div>

    @if (lightboxOpen && resolvedSrc) {
      <div
        class="bottle-lightbox"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Photo · ' + alt"
        (click)="closeLightbox($event)"
      >
        <button
          type="button"
          class="bottle-lightbox__close"
          (click)="closeLightbox($event)"
          aria-label="Fermer la photo"
        >
          Fermer
        </button>
        <img
          class="bottle-lightbox__img"
          [src]="resolvedSrc"
          [alt]="alt"
          (click)="$event.stopPropagation()"
        />
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .bottle-photo {
        position: relative;
        width: 100%;
        overflow: hidden;
        border: var(--stroke) solid var(--color-border);
        background: var(--color-surface);
      }

      .bottle-photo--list {
        aspect-ratio: 1;
      }

      .bottle-photo--detail {
        aspect-ratio: 3 / 4;
        max-width: 220px;
      }

      .bottle-photo__hit {
        display: block;
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: zoom-in;
        color: inherit;
      }

      .bottle-photo__hit:focus-visible {
        outline: var(--stroke-accent) solid var(--color-accent);
        outline-offset: -2px;
      }

      .bottle-photo__img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center center;
      }

      .bottle-photo__stripes {
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(
          -45deg,
          var(--color-surface),
          var(--color-surface) 8px,
          var(--color-surface-2) 8px,
          var(--color-surface-2) 16px
        );
      }

      .bottle-lightbox {
        position: fixed;
        inset: 0;
        z-index: 80;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-md);
        padding: var(--space-lg);
        background: color-mix(in srgb, var(--color-bg) 92%, transparent);
        cursor: zoom-out;
      }

      .bottle-lightbox__img {
        display: block;
        max-width: min(100%, 720px);
        max-height: min(85dvh, 900px);
        width: auto;
        height: auto;
        object-fit: contain;
        border: var(--stroke) solid var(--color-border-strong);
        background: var(--color-surface);
        cursor: default;
      }

      .bottle-lightbox__close {
        position: absolute;
        top: max(12px, env(safe-area-inset-top));
        right: max(12px, env(safe-area-inset-right));
        min-height: 44px;
        padding: 0 14px;
        border: var(--stroke) solid var(--color-border-strong);
        background: var(--color-surface);
        color: var(--color-ink);
        font-family: var(--font-mono);
        font-size: var(--text-mono-s);
        font-weight: 700;
        letter-spacing: var(--mono-track);
        text-transform: uppercase;
        cursor: pointer;
      }

      .bottle-lightbox__close:focus-visible {
        outline: var(--stroke-accent) solid var(--color-accent);
        outline-offset: 2px;
      }
    `,
  ],
})
export class BottlePhoto implements OnChanges, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl;

  @Input() src: string | null = null;
  @Input() alt = 'Photo de bouteille';
  @Input() variant: 'list' | 'detail' = 'list';

  resolvedSrc: string | null = null;
  lightboxOpen = false;

  private generation = 0;
  private loadedSrc: string | null | undefined = undefined;
  private loadSub: Subscription | null = null;
  private objectUrl: string | null = null;
  private previousOverflow: string | null = null;

  get canZoom(): boolean {
    return Boolean(this.resolvedSrc);
  }

  ngOnChanges(): void {
    this.load(this.src);
  }

  ngOnDestroy(): void {
    this.generation += 1;
    this.loadSub?.unsubscribe();
    this.revoke();
    this.unlockBody();
  }

  openLightbox(event: Event): void {
    if (!this.resolvedSrc) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.lightboxOpen = true;
    this.lockBody();
  }

  closeLightbox(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    if (!this.lightboxOpen) {
      return;
    }
    this.lightboxOpen = false;
    this.unlockBody();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.lightboxOpen) {
      event.preventDefault();
      this.closeLightbox();
    }
  }

  private lockBody(): void {
    if (typeof document === 'undefined') {
      return;
    }
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  private unlockBody(): void {
    if (typeof document === 'undefined') {
      return;
    }
    if (this.previousOverflow !== null) {
      document.body.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }

  private load(src: string | null): void {
    if (src === this.loadedSrc) {
      return;
    }
    this.loadedSrc = src;
    const generation = ++this.generation;
    this.loadSub?.unsubscribe();
    this.loadSub = null;
    this.revoke();
    this.resolvedSrc = null;
    this.closeLightbox();

    if (!src) {
      return;
    }
    if (!photoNeedsBearer(src, this.apiBase)) {
      this.resolvedSrc = src;
      return;
    }

    const url = absoluteApiUrl(src, this.apiBase);
    this.loadSub = this.http.get(url, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        if (generation !== this.generation) {
          return;
        }
        this.revoke();
        this.objectUrl = URL.createObjectURL(blob);
        this.resolvedSrc = this.objectUrl;
      },
      error: () => {
        if (generation !== this.generation) {
          return;
        }
        this.resolvedSrc = null;
      },
    });
  }

  private revoke(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
