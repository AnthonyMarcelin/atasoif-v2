import { Component, Input } from '@angular/core';

/**
 * Bottle photo: real URL or Nuit striped placeholder (list square / detail 3:4).
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
      @if (src) {
        <img class="bottle-photo__img" [src]="src" [alt]="alt" loading="lazy" />
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
export class BottlePhoto {
  @Input() src: string | null = null;
  @Input() alt = 'Photo de bouteille';
  @Input() variant: 'list' | 'detail' = 'list';
}
