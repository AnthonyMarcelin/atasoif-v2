import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import type { FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';
import { FriendsService, type FriendRow, type FriendsPayload } from './friends.service';

@Component({
  selector: 'app-friends-shell-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, CellarShell],
  templateUrl: './friends-shell.page.html',
  styleUrl: './friends-shell.page.scss',
})
export class FriendsShellPage implements OnInit {
  private readonly fb = new FormBuilder().nonNullable;
  private readonly friendsApi = inject(FriendsService);
  private readonly collection = inject(CollectionService);

  readonly freemium = signal<FreemiumMeta | null>(null);
  readonly loading = signal(true);
  readonly inviting = signal(false);
  readonly error = signal<string | null>(null);
  readonly ok = signal<string | null>(null);
  readonly data = signal<FriendsPayload | null>(null);
  readonly form = this.fb.group({
    target: [''],
  });

  ngOnInit(): void {
    this.collection.freemium().subscribe({
      next: (meta) => this.freemium.set(meta),
      error: () => this.freemium.set(null),
    });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.friendsApi
      .list()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (payload) => this.data.set(payload),
        error: (err: unknown) =>
          this.error.set(cellarErrorMessage(err, 'Amis indisponibles. Réessaie.')),
      });
  }

  invite(): void {
    const target = this.form.controls.target.value.trim();
    if (!target || this.inviting()) {
      return;
    }
    this.inviting.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.friendsApi
      .invite(target)
      .pipe(finalize(() => this.inviting.set(false)))
      .subscribe({
        next: () => {
          this.ok.set('Invitation envoyée · mail + notif en route.');
          this.form.controls.target.setValue('');
          this.reload();
        },
        error: (err: unknown) =>
          this.error.set(cellarErrorMessage(err, 'Invitation impossible. Réessaie.')),
      });
  }

  respond(row: FriendRow, accept: boolean): void {
    this.friendsApi.respond(row.id, accept).subscribe({
      next: () => this.reload(),
      error: (err: unknown) =>
        this.error.set(cellarErrorMessage(err, 'Réponse impossible. Réessaie.')),
    });
  }

  async copyInvite(): Promise<void> {
    const code = this.data()?.inviteCode;
    if (!code) {
      return;
    }
    const text = `https://atasoif.fr/i/${code}`;
    try {
      await navigator.clipboard.writeText(text);
      this.ok.set('Lien copié.');
    } catch {
      this.ok.set(text);
    }
  }

  initial(row: FriendRow): string {
    const label = row.user.pseudo || row.user.fullName || '?';
    return label.slice(0, 1).toUpperCase();
  }

  label(row: FriendRow): string {
    return row.user.pseudo || row.user.fullName || `Ami #${row.user.id}`;
  }
}
