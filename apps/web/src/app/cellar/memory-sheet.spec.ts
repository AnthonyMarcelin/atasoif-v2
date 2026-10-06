import {
  MEMORY_REVIEW_MIN_CHARS,
  memorySheetCompleteness,
  memorySheetMissingHintFr,
} from '@atasoif/shared';

describe('memory sheet (shared helper)', () => {
  it('requires review length and treats string numbers as filled', () => {
    expect(
      memorySheetCompleteness({
        pricePaid: '12,5',
        boughtAt: 'Nicolas',
        note: '8',
        review: 'court',
      }).complete,
    ).toBe(false);

    expect(
      memorySheetCompleteness({
        pricePaid: '12,5',
        boughtAt: 'Nicolas',
        note: '8',
        review: 'x'.repeat(MEMORY_REVIEW_MIN_CHARS),
      }).complete,
    ).toBe(true);
  });

  it('exposes a soft French hint for missing fields', () => {
    const hint = memorySheetMissingHintFr({ boughtAt: 'Cave' });
    expect(hint).toContain('fiche complète');
    expect(memorySheetMissingHintFr({
      pricePaid: 1,
      boughtAt: 'Cave',
      note: 5,
      review: 'Souvenir assez long pour compter',
    })).toBeNull();
  });
});
