import { normalizeFriendInviteTarget } from './friend-invite-target';

describe('normalizeFriendInviteTarget', () => {
  it('extracts a code from an absolute invite URL', () => {
    expect(normalizeFriendInviteTarget('https://atasoif.fr/i/F702EA')).toBe('F702EA');
    expect(normalizeFriendInviteTarget('https://atasoif.fr/i/f702ea/')).toBe('F702EA');
  });

  it('extracts a code from a path-only invite link', () => {
    expect(normalizeFriendInviteTarget('/i/AB12CD')).toBe('AB12CD');
  });

  it('keeps a pseudo or bare code for the API', () => {
    expect(normalizeFriendInviteTarget('@caveur')).toBe('caveur');
    expect(normalizeFriendInviteTarget('caveur')).toBe('caveur');
    expect(normalizeFriendInviteTarget('F702EA')).toBe('F702EA');
  });

  it('trims blank input', () => {
    expect(normalizeFriendInviteTarget('   ')).toBe('');
  });
});
