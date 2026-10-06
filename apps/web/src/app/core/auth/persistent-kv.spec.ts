import { Preferences } from '@capacitor/preferences';

import { AUTH_TOKEN_KEY } from './persist-keys';
import { persistHydrate, persistRead, persistRemove, persistWrite } from './persistent-kv';

describe('persistent-kv', () => {
  beforeEach(async () => {
    localStorage.clear();
    await Preferences.remove({ key: AUTH_TOKEN_KEY });
  });

  afterEach(async () => {
    persistRemove(AUTH_TOKEN_KEY);
    await Preferences.remove({ key: AUTH_TOKEN_KEY });
    localStorage.clear();
  });

  it('writes through to localStorage immediately', () => {
    persistWrite(AUTH_TOKEN_KEY, 'tok-live');
    expect(persistRead(AUTH_TOKEN_KEY)).toBe('tok-live');
  });

  it('hydrates localStorage from Preferences', async () => {
    await Preferences.set({ key: AUTH_TOKEN_KEY, value: 'tok-pref' });
    localStorage.removeItem(AUTH_TOKEN_KEY);

    await persistHydrate([AUTH_TOKEN_KEY]);

    expect(persistRead(AUTH_TOKEN_KEY)).toBe('tok-pref');
  });
});
