import {
  caveTitleFromName,
  cellarOwnerLabel,
  formatShareDate,
  inviteBannerHost,
  noteFilledBars,
} from './share-card-copy';

describe('share-card-copy', () => {
  it('builds French cave titles with de / d’', () => {
    expect(caveTitleFromName('Anthony')).toBe("LA CAVE D'ANTHONY");
    expect(caveTitleFromName('Julie')).toBe('LA CAVE DE JULIE');
    expect(caveTitleFromName('')).toBe('MA CAVE');
  });

  it('prefers first name then pseudo', () => {
    expect(cellarOwnerLabel('Anthony Marcelin', 'anth')).toBe('Anthony');
    expect(cellarOwnerLabel(null, 'julie7')).toBe('julie7');
    expect(cellarOwnerLabel(null, null)).toBe('moi');
  });

  it('maps /10 notes onto five bars', () => {
    expect(noteFilledBars(null)).toBe(0);
    expect(noteFilledBars(8)).toBe(4);
    expect(noteFilledBars(10)).toBe(5);
    expect(noteFilledBars(1)).toBe(1);
  });

  it('formats invite host path without scheme', () => {
    expect(inviteBannerHost('https://atasoif.fr/i/ANTH042')).toBe('atasoif.fr/i/ANTH042');
  });

  it('formats story date dd.mm.yy', () => {
    expect(formatShareDate(new Date(2026, 9, 7))).toBe('07.10.26');
  });
});
