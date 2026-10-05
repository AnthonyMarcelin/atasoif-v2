/** Matches the API default `CELLAR_PHOTO_SYNC_MAX_BYTES` (2 MiB) messaging. */
export const SHELF_PHOTO_SYNC_MAX_BYTES = 2 * 1024 * 1024;

/** Absolute client-side gate before upload (API default max 10 MiB). */
export const SHELF_PHOTO_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/**
 * Client gate before `POST .../photo`. Returns a short FR message, or null when the file can be sent.
 * Free plans must never reach this call.
 */
export function shelfPhotoRejection(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const type = file.type.trim().toLowerCase();
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
  const extOk =
    ext === 'jpg' ||
    ext === 'jpeg' ||
    ext === 'png' ||
    ext === 'webp' ||
    ext === 'heic' ||
    ext === 'heif';
  const typeOk = type.length === 0 || ALLOWED_TYPES.has(type);

  if (!extOk || !typeOk) {
    return 'Choisis une photo jpeg, png, webp ou heic.';
  }
  if (file.size <= 0) {
    return 'Choisis une photo jpeg, png, webp ou heic.';
  }
  if (file.size > SHELF_PHOTO_MAX_BYTES) {
    return 'Photo trop lourde (10 Mo max).';
  }
  return null;
}
