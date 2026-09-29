import { mergeWineAttrsOverride, resolvedWineAttr } from '@atasoif/shared';

import { wineCatalogAttrs, wineOverrideFromForm, wineOverrideHasValue } from './wine-attrs';

describe('wine attrs', () => {
  it('prefers a personal override and falls back to the catalog', () => {
    expect(
      resolvedWineAttr({ grape: 'Cabernet franc' }, { grape: 'Merlot', appellation: 'Margaux' }, 'grape'),
    ).toBe('Cabernet franc');
    expect(resolvedWineAttr(null, { appellation: 'Margaux' }, 'appellation')).toBe('Margaux');
    expect(resolvedWineAttr({ vintage: '  ' }, { vintage: '2015' }, 'vintage')).toBe('2015');
  });

  it('stores only values that differ from the catalog', () => {
    const patch = wineOverrideFromForm(
      { appellation: 'Pauillac', grape: 'Merlot', vintage: '' },
      { appellation: 'Margaux', grape: 'Merlot', vintage: '2015' },
    );
    expect(patch).toEqual({ appellation: 'Pauillac', grape: null, vintage: null });
    expect(wineOverrideHasValue(patch)).toBeTrue();
    expect(
      wineOverrideHasValue({ appellation: null, grape: null, vintage: null }),
    ).toBeFalse();
  });

  it('keeps filled wine keys on a manual catalog miss', () => {
    expect(
      wineCatalogAttrs({ appellation: ' Chinon ', grape: '', vintage: '2018' }),
    ).toEqual({ appellation: 'Chinon', vintage: '2018' });
    expect(wineCatalogAttrs({ appellation: '', grape: ' ', vintage: '' })).toBeUndefined();
  });

  it('clears a wine key without dropping unrelated override data', () => {
    expect(
      mergeWineAttrsOverride(
        { appellation: 'Margaux', provider: 'user' },
        { appellation: null, grape: 'Cabernet franc' },
      ),
    ).toEqual({ provider: 'user', grape: 'Cabernet franc' });
  });
});
