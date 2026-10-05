import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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
 * Web / missing plugin → unavailable (caller can fall back to typed digits).
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScanService {
  /** True inside Capacitor iOS/Android (not the browser). */
  readonly isNative = Capacitor.isNativePlatform();

  async scan(): Promise<BarcodeScanResult> {
    if (!this.isNative) {
      return { ok: false, reason: 'unavailable' };
    }

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
