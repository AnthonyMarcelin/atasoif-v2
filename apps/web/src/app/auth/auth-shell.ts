import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AuthShell {}
