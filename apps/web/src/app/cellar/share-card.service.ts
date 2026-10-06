import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { resolvedWineAttr } from '@atasoif/shared';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from '../core/auth/auth.service';
import {
  displayAbv,
  displayCategory,
  displayName,
  displayOrigin,
  displayPhotoUrl,
  displayVolumeMl,
  formatAbv,
  formatVolumeCl,
  type UserBottle,
} from './cellar.types';
import { FriendsService } from './friends.service';
import { NativeShareService } from './native-share.service';
import { absoluteApiUrl, photoNeedsBearer } from './photo-url';
import {
  renderBottleShareCard,
  renderCaveShareCard,
  type ShareCardBottleTile,
} from './share-card-canvas';
import { caveTitleFromName, cellarOwnerLabel, inviteBannerHost } from './share-card-copy';
import { categoryMix, cellarLevelTitle, latestBottles } from './share-card-level';
import { categoryColor } from './share-card.tokens';
import { absoluteShareInviteUrl } from './share-invite-url';

@Injectable({ providedIn: 'root' })
export class ShareCardService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly friends = inject(FriendsService);
  private readonly nativeShare = inject(NativeShareService);
  private readonly apiBase = environment.apiBaseUrl;

  async shareCave(bottles: UserBottle[]): Promise<'shared' | 'copied' | 'shown'> {
    const invite = await this.resolveInvite();
    const user = this.auth.user();
    const owner = cellarOwnerLabel(user?.fullName, user?.pseudo);
    const limit = bottles.length <= 3 ? 3 : 6;
    const tiles = await this.tilesFor(latestBottles(bottles, limit));
    const blob = await renderCaveShareCard({
      ownerLabel: owner,
      caveTitle: caveTitleFromName(owner),
      bottleCount: bottles.length,
      levelTitle: cellarLevelTitle(bottles),
      categories: categoryMix(bottles, categoryColor),
      bottles: tiles,
      inviteUrl: invite.url,
    });
    return this.nativeShare.shareOrCopy({
      title: 'Ma cave · À ta soif',
      text: `Viens voir ma cave sur À ta soif : ${invite.url}`,
      url: invite.url,
      dialogTitle: 'Partager ma cave',
      file: { blob, fileName: 'ma-cave-atasoif.png' },
    });
  }

  async shareBottle(entry: UserBottle): Promise<'shared' | 'copied' | 'shown'> {
    const invite = await this.resolveInvite();
    const user = this.auth.user();
    const owner = cellarOwnerLabel(user?.fullName, user?.pseudo);
    const photoUrl = displayPhotoUrl(entry);
    const image = await this.loadImage(photoUrl);
    const cat = displayCategory(entry);
    const vintageRaw = resolvedWineAttr(
      entry.attrsOverride,
      entry.bottle?.attrs ?? null,
      'vintage',
    );
    const vintage = vintageRaw.trim() || null;
    const blob = await renderBottleShareCard({
      name: displayName(entry),
      origin: displayOrigin(entry),
      abvLabel: formatAbv(displayAbv(entry)),
      volumeLabel: formatVolumeCl(displayVolumeMl(entry)),
      vintage,
      categorySlug: cat?.slug ?? null,
      categoryLabel: cat?.name ?? null,
      note: entry.note ?? null,
      review: entry.review ?? null,
      ownerLabel: owner,
      inviteUrl: invite.url,
      image,
    });
    return this.nativeShare.shareOrCopy({
      title: `${displayName(entry)} · À ta soif`,
      text: `Dans ma cave sur À ta soif : ${invite.url}`,
      url: invite.url,
      dialogTitle: 'Partager cette bouteille',
      file: { blob, fileName: 'bouteille-atasoif.png' },
    });
  }

  /** Expose host path for UI feedback. */
  inviteHost(url: string): string {
    return inviteBannerHost(url);
  }

  private async resolveInvite(): Promise<{ code: string; url: string }> {
    const settings = await firstValueFrom(this.friends.share());
    const url = absoluteShareInviteUrl(settings.inviteUrl, settings.inviteCode);
    return { code: settings.inviteCode, url };
  }

  private async tilesFor(entries: UserBottle[]): Promise<ShareCardBottleTile[]> {
    const tiles: ShareCardBottleTile[] = [];
    for (const entry of entries) {
      const cat = displayCategory(entry);
      tiles.push({
        name: displayName(entry),
        origin: displayOrigin(entry),
        categorySlug: cat?.slug ?? null,
        categoryLabel: cat?.name ?? null,
        image: await this.loadImage(displayPhotoUrl(entry)),
      });
    }
    return tiles;
  }

  private async loadImage(src: string | null): Promise<HTMLImageElement | null> {
    if (!src) {
      return null;
    }
    let objectUrl: string | null = null;
    try {
      let url = src;
      if (photoNeedsBearer(src, this.apiBase)) {
        const absolute = absoluteApiUrl(src, this.apiBase);
        const blob = await firstValueFrom(this.http.get(absolute, { responseType: 'blob' }));
        objectUrl = URL.createObjectURL(blob);
        url = objectUrl;
      }
      return await decodeImage(url);
    } catch {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      return null;
    }
  }
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('blob:') && !src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}
