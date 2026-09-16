/**
 * Allow only same-app relative paths for post-auth redirects.
 * Rejects protocol-relative (`//…`), absolute URLs, and non-path values.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = '/me'): string {
  if (!raw) {
    return fallback;
  }

  const value = raw.trim();
  if (!value.startsWith('/')) {
    return fallback;
  }
  if (value.startsWith('//')) {
    return fallback;
  }
  if (value.includes('://')) {
    return fallback;
  }
  if (value.includes('\\')) {
    return fallback;
  }

  return value;
}
