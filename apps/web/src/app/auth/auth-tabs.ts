import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-auth-tabs',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <nav class="auth-tabs" aria-label="Inscription ou connexion">
      <a
        class="auth-tabs__link"
        routerLink="/auth/register"
        routerLinkActive="is-active"
        [attr.aria-current]="mode() === 'register' ? 'page' : null"
      >
        INSCRIPTION
      </a>
      <a
        class="auth-tabs__link"
        routerLink="/auth/login"
        routerLinkActive="is-active"
        [attr.aria-current]="mode() === 'login' ? 'page' : null"
      >
        CONNEXION
      </a>
    </nav>
  `,
})
export class AuthTabs {
  readonly mode = input.required<'register' | 'login'>();
}
