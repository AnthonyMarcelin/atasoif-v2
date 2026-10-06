import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';

export interface NativeSharePayload {
  title: string;
  text: string;
  url: string;
  dialogTitle?: string;
}

/**
 * Opens the system share sheet (Capacitor Share / Web Share API).
 * Falls back to clipboard when sharing is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class NativeShareService {
  async shareOrCopy(payload: NativeSharePayload): Promise<'shared' | 'copied' | 'shown'> {
    try {
      const can = await Share.canShare();
      if (can.value) {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.dialogTitle ?? payload.title,
        });
        return 'shared';
      }
    } catch {
      // User cancel or plugin gap — try clipboard below.
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
        });
        return 'shared';
      } catch {
        // Cancelled or unsupported — clipboard fallback.
      }
    }

    try {
      await navigator.clipboard.writeText(payload.url);
      return 'copied';
    } catch {
      return 'shown';
    }
  }

  /** App Store / Play subscription management deep link when on native. */
  subscriptionManageUrl(): string {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      return 'https://apps.apple.com/account/subscriptions';
    }
    if (platform === 'android') {
      return 'https://play.google.com/store/account/subscriptions';
    }
    return 'https://apps.apple.com/account/subscriptions';
  }
}
