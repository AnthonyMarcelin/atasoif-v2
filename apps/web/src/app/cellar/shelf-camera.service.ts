import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export type ShelfPhotoPick =
  | { ok: true; file: File }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'permission' };

/**
 * Shelf photo pick via Capacitor Camera.
 * On native, `CameraSource.Prompt` shows the system sheet (Bibliothèque / Appareil photo).
 * Web falls back to a hidden `<input type="file">` in the page.
 */
@Injectable({ providedIn: 'root' })
export class ShelfCameraService {
  readonly isNative = Capacitor.isNativePlatform();

  /** Opens the native prompt (library or camera). One control in the UI. */
  async pick(): Promise<ShelfPhotoPick> {
    if (!this.isNative || !Capacitor.isPluginAvailable('Camera')) {
      return { ok: false, reason: 'unavailable' };
    }

    try {
      const permission = await Camera.checkPermissions();
      if (permission.camera !== 'granted' || permission.photos !== 'granted') {
        const requested = await Camera.requestPermissions({
          permissions: ['camera', 'photos'],
        });
        if (requested.camera !== 'granted' && requested.photos !== 'granted') {
          return { ok: false, reason: 'permission' };
        }
      }

      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        promptLabelHeader: 'Ajouter une photo',
        promptLabelPhoto: 'Bibliothèque',
        promptLabelPicture: 'Appareil photo',
        promptLabelCancel: 'Annuler',
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
