import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import type { FreemiumMeta } from './cellar.types';
import { FreemiumCounter } from './freemium-counter';

@Component({
  selector: 'app-cellar-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, FreemiumCounter],
  template: `
    <div class="cellar-shell">
      <header class="cellar-shell__header">
        <div class="cellar-shell__titles">
          <p class="cellar-shell__brand">À ta soif !</p>
          <h1 class="cellar-shell__title">{{ title }}</h1>
          @if (lead) {
            <p class="cellar-shell__lead">{{ lead }}</p>
          }
        </div>
        @if (freemium) {
          <app-freemium-counter [freemium]="freemium" />
        }
      </header>

      <div class="cellar-shell__body">
        <ng-content />
      </div>

      <nav class="cellar-nav" aria-label="Navigation principale">
        <a
          class="cellar-nav__item"
          routerLink="/cave"
          routerLinkActive="is-active"
          [routerLinkActiveOptions]="{ exact: true }"
        >
          Ma cave
        </a>
        <a
          class="cellar-nav__add"
          routerLink="/cave/ajouter"
          routerLinkActive="is-active"
          aria-label="Ajouter une bouteille"
        >
          +
        </a>
        <a class="cellar-nav__item" routerLink="/me" routerLinkActive="is-active">Moi</a>
      </nav>
    </div>
  `,
})
export class CellarShell {
  @Input() title = 'Ma cave';
  @Input() lead: string | null = null;
  @Input() freemium: FreemiumMeta | null = null;
}
