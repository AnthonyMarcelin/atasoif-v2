import { readOAuthErrorFromUrl, readOAuthTokenFromUrl } from './oauth-session';

describe('oauth-session URL parsers', () => {
  it('reads the token from the hash fragment', () => {
    expect(
      readOAuthTokenFromUrl('fr.atasoif.app://auth/oauth/callback#token=abc%2B123'),
    ).toBe('abc+123');
  });

  it('reads oauthError from the query string', () => {
    expect(
      readOAuthErrorFromUrl('fr.atasoif.app://auth/login?oauthError=apple_denied'),
    ).toBe('apple_denied');
  });

  it('returns null when no token is present', () => {
    expect(readOAuthTokenFromUrl('fr.atasoif.app://auth/oauth/callback')).toBeNull();
  });
});
