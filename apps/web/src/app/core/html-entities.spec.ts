import { decodeHtmlEntities } from './html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes common named and numeric entities', () => {
    expect(decodeHtmlEntities('Lagavulin &quot;16&quot;')).toBe('Lagavulin "16"');
    expect(decodeHtmlEntities('43&deg;')).toBe('43°');
    expect(decodeHtmlEntities('A &amp; B')).toBe('A & B');
    expect(decodeHtmlEntities('caf&#233;')).toBe('café');
  });

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('Lagavulin 16')).toBe('Lagavulin 16');
    expect(decodeHtmlEntities('')).toBe('');
  });
});
