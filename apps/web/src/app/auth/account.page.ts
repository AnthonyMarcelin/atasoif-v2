import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-account-page',
  imports: [RouterLink],
  templateUrl: './account.page.html',
})
export class AccountPage {
  readonly loggedOut = signal(false);

  logout(): void {
    // Session clear + API revoke arrive in E1-T05.
    this.loggedOut.set(true);
  }
}
