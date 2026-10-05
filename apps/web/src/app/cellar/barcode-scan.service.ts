import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export type BarcodeScanResult =
  | { ok: true; barcode: string }
  | { ok: false; reason: 'cancelled' | 'unavailable' | 'permission' | 'invalid' };

const EAN_FORMATS = [
  BarcodeFormat.Ean8,
  BarcodeFormat.Ean13,
  BarcodeFormat.UpcA,
  BarcodeFormat.UpcE,
  BarcodeFormat.Code128,
  BarcodeFormat.Itf,
];

/** Normalize a scanned raw value to API barcode digits (8–14). */
export function digitsFromScan(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

/**
 * Native barcode scan for the add flow (maquette 05 SCAN).
 *
 * Prefer ML Kit when the native plugin is linked. On Capacitor SPM iOS the
 * ML Kit plugin is often missing — fall back to Camera + ZXing still-image decode
 * so SCAN still opens the device camera.
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  /** True inside Capacitor iOS/Android (not the browser). */
  readonly isNative = Capacitor.isNativePlatform();

  async scan(): Promise<BarcodeScanResult> {
    if (!this.isNative) {
      return { ok: false, reason: 'unavailable' };
    }

    const mlkit = await this.scanWithMlKit();
    if (mlkit.ok || mlkit.reason === 'cancelled' || mlkit.reason === 'permission') {
      return mlkit;
    }
    if (mlkit.reason === 'invalid') {
      return mlkit;
    }

    return this.scanWithCameraPhoto();
  }

  private async scanWithMlKit(): Promise<BarcodeScanResult> {
    try {
      const { supported } = await BarcodeScanner.isSupported();
      if (!supported) {
        return { ok: false, reason: 'unavailable' };
      }

      if (Capacitor.getPlatform() === 'android') {
        const module = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!module.available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
        }
      }

      const { barcodes } = await BarcodeScanner.scan({
        formats: EAN_FORMATS,
      });
      const digits = digitsFromScan(barcodes[0]?.rawValue?.trim() ?? '');
      if (!digits) {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: true, barcode: digits };
    } catch (err: unknown) {
      return this.mapNativeError(err);
    }
  }

  /** Opens the system camera, then decodes EAN/UPC from the captured frame. */
  private async scanWithCameraPhoto(): Promise<BarcodeScanResult> {
    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        webUseInput: false,
      });
      const path = photo.webPath ?? photo.path;
      if (!path) {
        return { ok: false, reason: 'cancelled' };
      }

      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(path);
      const digits = digitsFromScan(result.getText());
      if (!digits) {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: true, barcode: digits };
    } catch (err: unknown) {
      const mapped = this.mapNativeError(err);
      if (!mapped.ok && mapped.reason !== 'unavailable') {
        return mapped;
      }
      // ZXing "not found" → illisible
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : String(err ?? '');
      if (/not found|no barcode|checksum|format/i.test(message)) {
        return { ok: false, reason: 'invalid' };
      }
      return { ok: false, reason: 'unavailable' };
    }
  }

  private mapNativeError(err: unknown): BarcodeScanResult {
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
