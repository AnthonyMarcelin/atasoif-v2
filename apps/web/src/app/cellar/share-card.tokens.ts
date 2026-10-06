/** Nuit tokens for share-card canvas (1080×1920 stories). */

export const SHARE_CARD_W = 1080;
export const SHARE_CARD_H = 1920;

export const SHARE_COLORS = {
  bg: '#0E0C0A',
  surface: '#17140F',
  surface2: '#1F1B15',
  border: '#3E362C',
  borderFaint: '#2A241D',
  ink: '#F2EADC',
  ink2: '#DDD2C1',
  inkMuted: '#9A8E7E',
  inkFaint: '#6A5B4A',
  accent: '#E39A3C',
  onAccent: '#14110D',
  cat: {
    whisky: '#E39A3C',
    rhum: '#D98A6A',
    rum: '#D98A6A',
    beer: '#D6BE55',
    biere: '#D6BE55',
    wine: '#C4708F',
    vin: '#C4708F',
    gin: '#69A88F',
    cognac: '#D98A6A',
    vodka: '#9A8E7E',
    liqueur: '#9A8E7E',
    other: '#9A8E7E',
    autre: '#9A8E7E',
  } as Record<string, string>,
} as const;

export const SHARE_FONTS = {
  display: '"Bricolage Grotesque", system-ui, sans-serif',
  body: '"Schibsted Grotesk", system-ui, sans-serif',
  mono: '"Space Mono", ui-monospace, monospace',
} as const;

export function categoryColor(slug: string | null | undefined): string {
  if (!slug) {
    return SHARE_COLORS.cat['other'];
  }
  return SHARE_COLORS.cat[slug.toLowerCase()] ?? SHARE_COLORS.cat['other'];
}
