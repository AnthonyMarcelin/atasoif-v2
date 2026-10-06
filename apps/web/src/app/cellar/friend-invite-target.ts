/**
 * Normalize friend search input: pseudo, invite code, `/i/CODE`, or full https URL.
 * Pseudo remains unique server-side; email is still accepted by the API if pasted.
 */
export function normalizeFriendInviteTarget(raw: string): string {
  const needle = raw.trim();
  if (!needle) {
    return '';
  }

  const fromPath = needle.match(/\/i\/([A-Za-z0-9]{4,16})\b/i);
  if (fromPath?.[1]) {
    return fromPath[1].toUpperCase();
  }

  if (/^[A-Za-z0-9]{4,16}$/.test(needle) && !needle.includes('@')) {
    // Ambiguous short tokens: keep as-is so API can match invite code then pseudo.
    return needle;
  }

  return needle.replace(/^@/, '');
}
