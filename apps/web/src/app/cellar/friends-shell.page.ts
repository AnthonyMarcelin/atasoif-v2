import { Component, OnInit, inject, signal } from '@angular/core';

import { CellarShell } from './cellar-shell';
import type { FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';

/**
 * Amis tab shell (maquette 09). Real invite / mail / notif flow is Vague 3.
 */
@Component({
  selector: 'app-friends-shell-page',
  standalone: true,
  imports: [CellarShell],
  template: `
    <app-cellar-shell title="Amis" [freemium]="freemium()">
      <p class="cellar-placeholder__lead">
        Partage un code, ton pote reçoit un mail, il accepte · et vous voyez vos caves.
      </p>
      <div class="cellar-placeholder" role="status">
        <p class="cellar-placeholder__title">Amis bientôt</p>
        <p class="cellar-placeholder__text">
          L’écran est là pour la navigation. L’invitation et les notifs arrivent en Vague 3 · pas
          encore branchés.
        </p>
      </div>
    </app-cellar-shell>
  `,
})
export class FriendsShellPage implements OnInit {
  private readonly collection = inject(CollectionService);
  readonly freemium = signal<FreemiumMeta | null>(null);

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });
  }
}
