/** Matches the API default `CELLAR_PHOTO_MAX_BYTES` (5 MiB). */
export const SHELF_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

/**
 * Client gate before `POST .../photo`. Returns a short FR message, or null when the file can be sent.
 * Free plans must never reach this call.
 */
export function shelfPhotoRejection(file: Pick<File, 'name' | 'type' | 'size'>): string | null {
  const type = file.type.trim().toLowerCase();
  const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() ?? '';
  const extOk = ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp';
  const typeOk = ALLOWED_TYPES.has(type);

  if (!extOk || (type.length > 0 && !typeOk)) {
    return 'Choisis une photo jpeg, png ou webp.';
  }
  if (file.size <= 0) {
    return 'Choisis une photo jpeg, png ou webp.';
  }
  if (file.size > SHELF_PHOTO_MAX_BYTES) {
    return 'Photo trop lourde (5 Mo max).';
  }
  return null;
}
