import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

import { SessionGate } from './core/auth/session-gate';
import { SessionLockService } from './core/auth/session-lock.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  readonly gate = inject(SessionGate);
  private readonly sessionLock = inject(SessionLockService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    void this.sessionLock.start();
  }

  retryUnlock(): void {
    void this.sessionLock.promptUnlock();
  }

  usePassword(): void {
    this.sessionLock.usePasswordFallback();
  }
}
