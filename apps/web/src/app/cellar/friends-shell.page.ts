import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { cellarErrorMessage } from './cellar-errors';
import { CellarShell } from './cellar-shell';
import type { FreemiumMeta } from './cellar.types';
import { CollectionService } from './collection.service';
import { FriendsService, type FriendRow, type FriendsPayload } from './friends.service';
import { absoluteShareInviteUrl } from './share-invite-url';

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
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

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
    this.consumeInviteQuery();
  }

  private consumeInviteQuery(): void {
    const invite = this.route.snapshot.queryParamMap.get('invite')?.trim().toUpperCase();
    if (!invite || !/^[A-Z0-9]{4,16}$/.test(invite)) {
      return;
    }
    this.form.controls.target.setValue(invite);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { invite: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.ok.set(`Code ${invite} prêt · envoie l’invitation.`);
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
    const payload = this.data();
    if (!payload?.inviteCode) {
      return;
    }
    const text = absoluteShareInviteUrl(payload.inviteUrl, payload.inviteCode);
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
