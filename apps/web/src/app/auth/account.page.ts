import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-account-page',
  imports: [RouterLink],
  templateUrl: './account.page.html',
})
export class AccountPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = this.auth.user;
  readonly loggedOut = signal(false);
  readonly loading = signal(true);
  readonly loggingOut = signal(false);

  ngOnInit(): void {
    this.auth
      .loadProfile()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe();
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(finalize(() => this.loggingOut.set(false)))
      .subscribe({
        next: () => {
          this.loggedOut.set(true);
          void this.router.navigateByUrl('/auth/login');
        },
      });
  }
}
