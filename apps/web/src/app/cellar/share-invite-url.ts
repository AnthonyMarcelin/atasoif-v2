const DEFAULT_SHARE_ORIGIN = 'https://atasoif.fr';

/**
 * Absolute https invite URL for clipboard / SMS (must be tappable).
 * Prefer the API `inviteUrl`; fall back to code + marketing origin.
 */
export function absoluteShareInviteUrl(
  inviteUrlOrCode: string | null | undefined,
  inviteCode?: string | null,
): string {
  const raw = (inviteUrlOrCode ?? '').trim();
  if (/^https:\/\//i.test(raw) && /\/i\/[A-Za-z0-9]+/i.test(raw)) {
    try {
      const url = new URL(raw);
      url.protocol = 'https:';
      return url.toString().replace(/\/$/, '');
    } catch {
      /* fall through */
    }
  }

  const code = (inviteCode ?? raw.replace(/^.*\/i\//i, '')).trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) {
    return DEFAULT_SHARE_ORIGIN;
  }
  return `${DEFAULT_SHARE_ORIGIN}/i/${code}`;
}
