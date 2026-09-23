import { overridePhotoPath } from '#services/cellar_photo_storage'

const CATALOG_MEDIA_PATH =
  /^\/api\/v1\/media\/catalog\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/i

/**
 * Client-supplied photo URLs are rendered in other people's cellars and, for
 * `/api/...` paths, fetched with the viewer's bearer token. Only plain http(s)
 * links and the catalog media path the upload endpoint assigns are allowed.
 */
export function isHttpPhotoUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.username || url.password) {
    return false
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return false
  }
  return url.hostname.length > 0
}

export function isCatalogPhotoUrl(value: string): boolean {
  return isHttpPhotoUrl(value) || CATALOG_MEDIA_PATH.test(value)
}

/** Shelf override may point at this row's own upload route, not another API path. */
export function isOwnShelfPhotoUrl(value: string, userBottleId: number): boolean {
  return value === overridePhotoPath(userBottleId)
}
