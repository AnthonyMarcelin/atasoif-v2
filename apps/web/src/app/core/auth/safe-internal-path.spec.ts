import { safeInternalPath } from './safe-internal-path';

describe('safeInternalPath', () => {
  it('keeps in-app paths', () => {
    expect(safeInternalPath('/me')).toBe('/me');
    expect(safeInternalPath('/cellar?x=1')).toBe('/cellar?x=1');
  });

  it('rejects open-redirect shapes', () => {
    expect(safeInternalPath('https://evil.example')).toBe('/me');
    expect(safeInternalPath('//evil.example')).toBe('/me');
    expect(safeInternalPath('/\\evil.example')).toBe('/me');
    expect(safeInternalPath('evil')).toBe('/me');
  });

  it('uses the provided fallback', () => {
    expect(safeInternalPath(null, '/auth/verify-email')).toBe('/auth/verify-email');
  });
});
