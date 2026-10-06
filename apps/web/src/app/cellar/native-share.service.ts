import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface NativeShareFile {
  blob: Blob;
  fileName: string;
}

export interface NativeSharePayload {
  title: string;
  text: string;
  url: string;
  dialogTitle?: string;
  /** Optional story PNG (1080×1920) shared via Capacitor `files` / Web Share. */
  file?: NativeShareFile;
}

/**
 * Opens the system share sheet (Capacitor Share / Web Share API).
 * Falls back to clipboard when sharing is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class NativeShareService {
  async shareOrCopy(payload: NativeSharePayload): Promise<'shared' | 'copied' | 'shown'> {
    const fileUri = payload.file
      ? await this.writeCacheFile(payload.file).catch(() => null)
      : null;

    try {
      const can = await Share.canShare();
      if (can.value) {
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          dialogTitle: payload.dialogTitle ?? payload.title,
          ...(fileUri ? { files: [fileUri] } : {}),
        });
        return 'shared';
      }
    } catch {
      // User cancel or plugin gap — try web / clipboard below.
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (payload.file && typeof navigator.canShare === 'function') {
          const file = new File([payload.file.blob], payload.file.fileName, {
            type: payload.file.blob.type || 'image/png',
          });
          const data: ShareData = {
            title: payload.title,
            text: payload.text,
            url: payload.url,
            files: [file],
          };
          if (navigator.canShare(data)) {
            await navigator.share(data);
            return 'shared';
          }
        }
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

  private async writeCacheFile(file: NativeShareFile): Promise<string | null> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }
    const base64 = await blobToBase64(file.blob);
    const path = `share-cards/${file.fileName}`;
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({
      path,
      directory: Directory.Cache,
    });
    return uri;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('base64 failed'));
    reader.readAsDataURL(blob);
  });
}
