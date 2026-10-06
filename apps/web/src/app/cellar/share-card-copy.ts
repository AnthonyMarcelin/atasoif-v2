/**
 * French copy helpers for share cards (tu, Nuit).
 * Alcohol-safe: no consumption / fill / price wording on public cards.
 */

/** « LA CAVE D'ANTHONY » / « LA CAVE DE JULIE ». */
export function caveTitleFromName(displayName: string | null | undefined): string {
  const raw = (displayName ?? '').trim();
  if (!raw) {
    return 'MA CAVE';
  }
  const name = raw.toUpperCase();
  return startsWithVowelSound(name) ? `LA CAVE D'${name}` : `LA CAVE DE ${name}`;
}

export function startsWithVowelSound(text: string): boolean {
  return /^[AEIOUYÀÂÄÆÉÈÊËÏÎÔŒÙÛÜ]/.test(text.trim());
}

/** Prefer first name from fullName, else pseudo, else fallback. */
export function cellarOwnerLabel(
  fullName: string | null | undefined,
  pseudo: string | null | undefined,
): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (first) {
    return first;
  }
  const handle = (pseudo ?? '').trim();
  if (handle) {
    return handle;
  }
  return 'moi';
}

/** Banner host path without scheme: `atasoif.fr/i/CODE`. */
export function inviteBannerHost(inviteUrl: string): string {
  const trimmed = inviteUrl.trim();
  try {
    const u = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    return `${u.host}${u.pathname}`.replace(/\/$/, '');
  } catch {
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  }
}

export function formatShareDate(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}.${mm}.${yy}`;
}

/**
 * Map note /10 → filled bars out of 5 (mockup scale).
 * Last filled bar is drawn amber by the canvas.
 */
export function noteFilledBars(note: number | null | undefined): number {
  if (note === null || note === undefined || !Number.isFinite(note) || note <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(5, Math.round(note / 2)));
}
