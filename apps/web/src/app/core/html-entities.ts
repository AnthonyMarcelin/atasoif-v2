/**
 * Decode common HTML entities in catalog strings (`&quot;`, `&deg;`, numeric refs).
 * Uses the browser parser when available; falls back to a small entity map.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value || !value.includes('&')) {
    return value;
  }
  if (typeof document !== 'undefined') {
    const el = document.createElement('textarea');
    el.innerHTML = value;
    return el.value;
  }
  return value
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&deg;/gi, '°')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
}
