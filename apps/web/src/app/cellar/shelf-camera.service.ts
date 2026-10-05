import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type ShelfPhotoPick =
  | { ok: true; file: File }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'permission' };

/**
 * Library / camera pick for premium shelf photos (Capacitor Camera).
 * Web falls back to a hidden `<input type="file">` in the page.
 */
@Injectable({ providedIn: 'root' })
export class ShelfCameraService {
  readonly isNative = Capacitor.isNativePlatform();

  async pick(source: 'camera' | 'library'): Promise<ShelfPhotoPick> {
    if (!this.isNative) {
      return { ok: false, reason: 'unavailable' };
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
        // Prefer jpeg so HEIC is converted by the plugin when possible.
        webUseInput: false,
      });

      const path = photo.webPath ?? photo.path;
      if (!path) {
        return { ok: false, reason: 'cancelled' };
      }

      const response = await fetch(path);
      const blob = await response.blob();
      const ext = mimeToExt(blob.type) ?? 'jpg';
      const file = new File([blob], `shelf.${ext}`, {
        type: blob.type || 'image/jpeg',
      });
      return { ok: true, file };
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';
      if (/cancel|dismiss|user/i.test(message)) {
        return { ok: false, reason: 'cancelled' };
      }
      if (/permission|denied|authorize/i.test(message)) {
        return { ok: false, reason: 'permission' };
      }
      return { ok: false, reason: 'unavailable' };
    }
  }
}

function mimeToExt(mime: string): string | null {
  const normalized = mime.trim().toLowerCase();
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/heic' || normalized === 'image/heif') return 'heic';
  return null;
}
