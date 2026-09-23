import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { environment } from '../../environments/environment';
import { absoluteApiUrl, photoNeedsBearer } from './photo-url';

/**
 * Bottle photo: real URL or Nuit striped placeholder (list square / detail 3:4).
 * Authenticated shelf / catalog paths are loaded with the bearer token (blob URL).
 */
@Component({
  selector: 'app-bottle-photo',
  standalone: true,
  template: `
    <div
      class="bottle-photo"
      [class.bottle-photo--detail]="variant === 'detail'"
      [class.bottle-photo--list]="variant === 'list'"
      role="img"
      [attr.aria-label]="alt"
    >
      @if (resolvedSrc) {
        <img class="bottle-photo__img" [src]="resolvedSrc" [alt]="alt" loading="lazy" />
      } @else {
        <div class="bottle-photo__stripes" aria-hidden="true"></div>
      }
    </div>
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

      .bottle-photo__img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
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

  private generation = 0;
  private loadedSrc: string | null | undefined = undefined;
  private loadSub: Subscription | null = null;
  private objectUrl: string | null = null;

  ngOnChanges(): void {
    this.load(this.src);
  }

  ngOnDestroy(): void {
    this.generation += 1;
    this.loadSub?.unsubscribe();
    this.revoke();
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
