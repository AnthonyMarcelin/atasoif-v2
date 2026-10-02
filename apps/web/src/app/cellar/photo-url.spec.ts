import { absoluteApiUrl, photoNeedsBearer } from './photo-url';

describe('photo url auth', () => {
  const apiBase = 'http://localhost:3000';

  it('keeps remote catalog photos as plain image urls', () => {
    const src = 'https://example.com/lag.jpg';
    expect(photoNeedsBearer(src, apiBase)).toBeFalse();
  });

  it('requires a bearer fetch for shelf and catalog api paths', () => {
    expect(photoNeedsBearer('/api/v1/collection/bottles/4/photo', apiBase)).toBeTrue();
    expect(photoNeedsBearer(`${apiBase}/api/v1/media/catalog/pack.jpg`, apiBase)).toBeTrue();
    expect(absoluteApiUrl('/api/v1/collection/bottles/4/photo', apiBase)).toBe(
      `${apiBase}/api/v1/collection/bottles/4/photo`,
    );
  });

  it('resolves relative OFF media paths against the API origin', () => {
    const prodBase = 'https://api.atasoif.fr';
    const relative = '/api/v1/media/off/5000267024202.jpg';
    expect(photoNeedsBearer(relative, prodBase)).toBeTrue();
    expect(absoluteApiUrl(relative, prodBase)).toBe(`${prodBase}${relative}`);
  });
});

