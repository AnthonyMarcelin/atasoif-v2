/**
 * Shelf overrides and contributed catalog packshots are served by authenticated API routes.
 * A plain `<img src>` cannot send the bearer token, so those URLs must be fetched as blobs.
 */
export function photoNeedsBearer(src: string, apiBase: string): boolean {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return false;
  }
  if (trimmed.startsWith('/api/')) {
    return true;
  }
  try {
    const base = new URL(apiBase);
    const url = new URL(trimmed, base);
    return url.origin === base.origin && url.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function absoluteApiUrl(src: string, apiBase: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  const base = apiBase.replace(/\/$/, '');
  return `${base}${src.startsWith('/') ? src : `/${src}`}`;
}
