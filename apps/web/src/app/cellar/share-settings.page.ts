import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import { FriendsService, type ShareSettings } from './friends.service';

@Component({
  selector: 'app-share-settings-page',
  standalone: true,
  imports: [RouterLink, CellarShell],
  templateUrl: './share-settings.page.html',
  styleUrl: './share-settings.page.scss',
})
export class ShareSettingsPage implements OnInit {
  private readonly friendsApi = inject(FriendsService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);
  readonly settings = signal<ShareSettings | null>(null);

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.friendsApi
      .share()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.settings.set(data),
        error: (err: unknown) =>
          this.error.set(cellarErrorMessage(err, 'Partage indisponible. Réessaie.')),
      });
  }

  toggle(
    key: 'shareCellarWithFriends' | 'sharePrices' | 'shareNotes' | 'findableByPseudo',
  ): void {
    const current = this.settings();
    if (!current || this.saving()) {
      return;
    }
    const next = { ...current, [key]: !current[key] };
    this.settings.set(next);
    this.saving.set(true);
    this.friendsApi
      .updateShare({ [key]: next[key] })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (data) => this.settings.set(data),
        error: (err: unknown) => {
          this.settings.set(current);
          this.error.set(cellarErrorMessage(err, 'Réglage impossible. Réessaie.'));
        },
      });
  }

  async copyLink(): Promise<void> {
    const url = this.settings()?.inviteUrl;
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.ok.set('Lien copié.');
    } catch {
      this.ok.set(url);
    }
  }
}
