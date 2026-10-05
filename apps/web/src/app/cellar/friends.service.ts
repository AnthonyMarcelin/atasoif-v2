import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface FriendUser {
  id: number;
  pseudo: string | null;
  fullName: string | null;
  inviteCode: string | null;
}

export interface FriendRow {
  id: number;
  status: string;
  requesterId: number | null;
  user: FriendUser;
  bottleCount: number;
  cellarShared: boolean;
  incoming: boolean;
}

export interface FriendsPayload {
  inviteCode: string;
  pending: FriendRow[];
  friends: FriendRow[];
  blocked: FriendRow[];
}

export interface ShareSettings {
  inviteCode: string;
  inviteUrl: string;
  shareCellarWithFriends: boolean;
  sharePrices: boolean;
  shareNotes: boolean;
  findableByPseudo: boolean;
  pseudo: string | null;
}

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = environment.apiBaseUrl.replace(/\/$/, '');

  list(): Observable<FriendsPayload> {
    return this.http
      .get<{ data: FriendsPayload }>(`${this.apiBase}/api/v1/friends`)
      .pipe(map((body) => body.data));
  }

  invite(target: string): Observable<{ id: number; status: string }> {
    return this.http
      .post<{ data: { id: number; status: string } }>(`${this.apiBase}/api/v1/friends`, {
        target,
      })
      .pipe(map((body) => body.data));
  }

  respond(id: number, accept: boolean): Observable<unknown> {
    return this.http.post(`${this.apiBase}/api/v1/friends/${id}/respond`, { accept });
  }

  share(): Observable<ShareSettings> {
    return this.http
      .get<{ data: ShareSettings }>(`${this.apiBase}/api/v1/friends/share`)
      .pipe(map((body) => body.data));
  }

  updateShare(patch: Partial<ShareSettings>): Observable<ShareSettings> {
    return this.http
      .patch<{ data: ShareSettings }>(`${this.apiBase}/api/v1/friends/share`, {
        shareCellarWithFriends: patch.shareCellarWithFriends,
        sharePrices: patch.sharePrices,
        shareNotes: patch.shareNotes,
        findableByPseudo: patch.findableByPseudo,
      })
      .pipe(map((body) => body.data));
  }

  unblock(id: number): Observable<unknown> {
    return this.http.delete(`${this.apiBase}/api/v1/friends/${id}/block`);
  }
}
