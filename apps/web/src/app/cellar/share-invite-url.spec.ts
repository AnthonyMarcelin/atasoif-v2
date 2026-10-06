import { absoluteShareInviteUrl } from './share-invite-url';

describe('absoluteShareInviteUrl', () => {
  it('keeps an absolute https invite URL', () => {
    expect(absoluteShareInviteUrl('https://atasoif.fr/i/F702EA')).toBe(
      'https://atasoif.fr/i/F702EA',
    );
  });

  it('builds from a bare invite code', () => {
    expect(absoluteShareInviteUrl(null, 'F702EA')).toBe('https://atasoif.fr/i/F702EA');
    expect(absoluteShareInviteUrl('f702ea')).toBe('https://atasoif.fr/i/F702EA');
  });

  it('upgrades host-only / http shapes via code fallback', () => {
    expect(absoluteShareInviteUrl('atasoif.fr/i/F702EA', 'F702EA')).toBe(
      'https://atasoif.fr/i/F702EA',
    );
  });
});
