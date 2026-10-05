import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CellarShell } from './cellar-shell';
import type { FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';

/**
 * Catalogue tab shell (maquette 07). Full browse UI is Vague 2 — navigable placeholder only.
 */
@Component({
  selector: 'app-catalog-shell-page',
  standalone: true,
  imports: [CellarShell, RouterLink],
  template: `
    <app-cellar-shell title="Catalogue" [freemium]="freemium()">
      <p class="cellar-placeholder__lead">
        Cherche une bouteille, filtre par type, ou pars du code-barres. Le catalogue complet arrive
        juste après.
      </p>
      <div class="cellar-placeholder" role="status">
        <p class="cellar-placeholder__title">Catalogue en route</p>
        <p class="cellar-placeholder__text">
          Pour l’instant, ajoute depuis le + · la recherche catalogue y est déjà.
        </p>
        <a class="auth-btn auth-btn--primary" routerLink="/cave/ajouter">Ajouter une bouteille</a>
      </div>
    </app-cellar-shell>
  `,
})
export class CatalogShellPage implements OnInit {
  private readonly collection = inject(CollectionService);
  readonly freemium = signal<FreemiumMeta | null>(null);

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });
  }
}
