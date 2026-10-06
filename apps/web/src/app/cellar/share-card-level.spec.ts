import type { UserBottle } from './cellar.types';
import {
  categoryMix,
  cellarLevelTitle,
  isMemoryComplete,
  latestBottles,
} from './share-card-level';

function bottle(partial: Partial<UserBottle> & { id: number }): UserBottle {
  return {
    userId: 1,
    bottleId: partial.id,
    nameOverride: null,
    brandOverride: null,
    originOverride: null,
    abvOverride: null,
    volumeMlOverride: null,
    photoUrlOverride: null,
    attrsOverride: null,
    note: null,
    review: null,
    pricePaid: null,
    boughtAt: null,
    fillLevel: 100,
    fillLevelUpdatesCount: 0,
    isPublic: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: null,
    bottle: {
      id: partial.id,
      name: 'Test',
      brand: null,
      origin: null,
      abv: null,
      volumeMl: null,
      barcode: null,
      photoUrl: null,
      attrs: {},
      categoryId: 1,
      category: { id: 1, slug: 'whisky', name: 'Whisky' },
    },
    ...partial,
  };
}

describe('share-card-level', () => {
  it('detects memory-complete bottles', () => {
    expect(
      isMemoryComplete(
        bottle({
          id: 1,
          pricePaid: 42,
          boughtAt: 'Cave',
          note: 8,
          review: 'Tourbe franche, presque salée.',
        }),
      ),
    ).toBe(true);
    expect(isMemoryComplete(bottle({ id: 2, review: 'ok' }))).toBe(false);
  });

  it('picks level titles from complete fiches + diversity', () => {
    const many = Array.from({ length: 15 }, (_, i) =>
      bottle({
        id: i + 1,
        pricePaid: 10,
        boughtAt: 'Chez X',
        note: 7,
        review: 'Un avis assez long pour compter.',
        bottle: {
          id: i + 1,
          name: 'B',
          brand: null,
          origin: null,
          abv: null,
          volumeMl: null,
          barcode: null,
          photoUrl: null,
          attrs: {},
          categoryId: 1,
          category: {
            id: 1,
            slug: ['whisky', 'rhum', 'wine'][i % 3]!,
            name: 'Cat',
          },
        },
      }),
    );
    expect(cellarLevelTitle(many)).toBe('CONNAISSEUR');
    expect(cellarLevelTitle([bottle({ id: 1 })])).toBe('CURIEUX');
  });

  it('sorts latest bottles and builds category mix', () => {
    const a = bottle({ id: 1, createdAt: '2026-01-01T00:00:00.000Z' });
    const b = bottle({
      id: 2,
      createdAt: '2026-06-01T00:00:00.000Z',
      bottle: {
        id: 2,
        name: 'R',
        brand: null,
        origin: null,
        abv: null,
        volumeMl: null,
        barcode: null,
        photoUrl: null,
        attrs: {},
        categoryId: 2,
        category: { id: 2, slug: 'rhum', name: 'Rhum' },
      },
    });
    expect(latestBottles([a, b], 1).map((x) => x.id)).toEqual([2]);
    const mix = categoryMix([a, b, a], () => '#fff');
    expect(mix[0]?.slug).toBe('whisky');
    expect(mix[0]?.count).toBe(2);
  });
});
