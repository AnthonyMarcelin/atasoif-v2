import {
  Component,
  EventEmitter,
  HostBinding,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import type { FreemiumMeta } from './cellar.types';
import { CellarToastService } from './cellar-toast.service';
import { FreemiumCounter, freemiumSlots } from './freemium-counter';

@Component({
  selector: 'app-cellar-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FreemiumCounter],
  template: `
    <div
      class="cellar-shell"
      [class.cellar-shell--no-nav]="hideNav"
      [class.cellar-shell--keyboard]="keyboardOpen"
    >
      @if (!hideHeader) {
        <header class="cellar-shell__header">
          <div class="cellar-shell__row">
            <div class="cellar-shell__titles">
              @if (showBrand) {
                <p class="cellar-shell__brand">À ta soif !</p>
              }
              <div class="cellar-shell__title-row">
                <h1 class="cellar-shell__title">{{ title }}</h1>
                @if (freemium?.entitlement) {
                  <span class="cellar-premium-badge" aria-label="Abonnement Premium actif"
                    >Premium</span
                  >
                }
              </div>
              @if (lead) {
                <p class="cellar-shell__lead">{{ lead }}</p>
              }
            </div>
            <div class="cellar-shell__aside">
              @if (showShare) {
                <button
                  type="button"
                  class="cellar-shell__share"
                  (click)="share.emit()"
                  [disabled]="shareBusy"
                  [attr.aria-busy]="shareBusy"
                >
                  {{ shareBusy ? 'Préparation…' : 'Partager' }}
                </button>
              }
              @if (freemium) {
                <app-freemium-counter [freemium]="freemium" />
              }
            </div>
          </div>
          @if (freemium && showSlots && !freemium.entitlement) {
            <div class="cellar-shell__slots" aria-hidden="true">
              @for (filled of slots; track $index) {
                <span class="cellar-shell__slot" [class.is-filled]="filled"></span>
              }
            </div>
            <p class="cellar-shell__freemium-note">
              Retirer une bouteille ne libère pas de place.
            </p>
            <p class="cellar-shell__bonus-hint">
              <a routerLink="/cave/amis" class="cellar-shell__bonus-link"
                >Comment gagner des places</a
              >
            </p>
          }
        </header>
      }

      @if (toast.message(); as toastText) {
        <div class="cellar-toast" role="status" aria-live="polite">{{ toastText }}</div>
      }

      <div class="cellar-shell__body">
        <ng-content />
      </div>

      @if (!hideNav) {
        <nav
          class="cellar-nav"
          aria-label="Navigation principale"
          [class.is-hidden-keyboard]="keyboardOpen"
        >
          <a
            class="cellar-nav__item"
            routerLink="/cave"
            routerLinkActive="is-active"
            [routerLinkActiveOptions]="{ exact: true }"
          >
            <span class="cellar-nav__icon cellar-nav__icon--cave" aria-hidden="true"></span>
            <span class="cellar-nav__label">Ma cave</span>
          </a>
          <a class="cellar-nav__item" routerLink="/cave/catalogue" routerLinkActive="is-active">
            <span class="cellar-nav__icon cellar-nav__icon--catalog" aria-hidden="true"></span>
            <span class="cellar-nav__label">Catalogue</span>
          </a>
          <a
            class="cellar-nav__add"
            routerLink="/cave/ajouter"
            routerLinkActive="is-active"
            aria-label="Ajouter à ta cave · chercher dans le catalogue ou scanner"
          >
            <span class="cellar-nav__add-mark" aria-hidden="true">+</span>
            <span class="cellar-nav__label cellar-nav__label--on-accent">Ajouter</span>
          </a>
          <a class="cellar-nav__item" routerLink="/cave/amis" routerLinkActive="is-active">
            <span class="cellar-nav__icon cellar-nav__icon--friends" aria-hidden="true"></span>
            <span class="cellar-nav__label">Amis</span>
          </a>
          <a
            class="cellar-nav__item"
            routerLink="/me"
            routerLinkActive="is-active"
            [class.cellar-nav__item--premium]="freemium?.entitlement"
          >
            <span class="cellar-nav__icon cellar-nav__icon--profile" aria-hidden="true"></span>
            <span class="cellar-nav__label">Mon profil</span>
            @if (freemium?.entitlement) {
              <span class="cellar-nav__premium-dot" aria-hidden="true"></span>
            }
          </a>
        </nav>
      }
    </div>
  `,
})
export class CellarShell implements OnInit, OnDestroy {
  readonly toast = inject(CellarToastService);

  @Input() title = 'Ma cave';
  @Input() lead: string | null = null;
  @Input() freemium: FreemiumMeta | null = null;
  /** Show brand eyebrow above the title (list legacy). Off for maquette-aligned cave. */
  @Input() showBrand = false;
  /** Freemium case gauge under the header (maquette 03). */
  @Input() showSlots = false;
  /** Hide the 5-tab bar (add flow uses its own footer). */
  @Input() hideNav = false;
  /** Hide the default header (add search has a custom chrome). */
  @Input() hideHeader = false;
  /** Story share card (cellar list header). */
  @Input() showShare = false;
  @Input() shareBusy = false;
  @Output() readonly share = new EventEmitter<void>();

  @HostBinding('class.cellar-shell-host') readonly hostClass = true;

  keyboardOpen = false;

  private viewportHandler: (() => void) | null = null;

  get slots(): boolean[] {
    return freemiumSlots(this.freemium);
  }

  ngOnInit(): void {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }
    const vv = window.visualViewport;
    this.viewportHandler = () => {
      // iOS keyboard shrinks visualViewport vs layout viewport.
      const gap = window.innerHeight - vv.height - vv.offsetTop;
      this.keyboardOpen = gap > 120;
    };
    vv.addEventListener('resize', this.viewportHandler);
    vv.addEventListener('scroll', this.viewportHandler);
  }

  ngOnDestroy(): void {
    if (!this.viewportHandler || typeof window === 'undefined' || !window.visualViewport) {
      return;
    }
    window.visualViewport.removeEventListener('resize', this.viewportHandler);
    window.visualViewport.removeEventListener('scroll', this.viewportHandler);
  }
}
