import {
  catalogBottleMeta,
  catalogBottleTitle,
  fillLevelLabel,
  formatAbv,
  formatBottleMeta,
  formatPriceEur,
  formatVolumeCl,
} from './cellar.types';

describe('cellar display helpers', () => {
  it('formats abv, volume and price for FR UI', () => {
    expect(formatAbv(43)).toBe('43%');
    expect(formatAbv(43.0)).toBe('43%');
    expect(formatAbv(6.2)).toBe('6,2%');
    expect(formatVolumeCl(700)).toBe('70CL');
    expect(formatVolumeCl(330)).toBe('33CL');
    expect(formatPriceEur(62)).toBe('62€');
    expect(formatPriceEur(4.2)).toBe('4,2€');
  });

  it('builds meta lines and decodes catalog titles', () => {
    expect(formatBottleMeta(['ISLAY', '43%', '70CL'])).toBe('ISLAY · 43% · 70CL');
    expect(catalogBottleTitle({ name: 'Lagavulin &quot;16&quot;' } as never)).toBe(
      'Lagavulin "16"',
    );
    expect(
      catalogBottleMeta({
        name: 'x',
        brand: null,
        origin: null,
        abv: 43,
        volumeMl: 700,
        barcode: null,
        photoUrl: null,
        attrs: {},
        categoryId: 1,
        category: { id: 1, slug: 'whisky', name: 'Whisky' },
        id: 1,
      }),
    ).toBe('WHISKY · 43% · 70CL');
  });

  it('labels fill levels', () => {
    expect(fillLevelLabel(100)).toBe('SCELLÉE');
    expect(fillLevelLabel(0)).toBe('VIDE');
    expect(fillLevelLabel(62)).toBe('62%');
  });
});
