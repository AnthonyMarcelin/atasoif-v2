import { HttpErrorResponse } from '@angular/common/http';

import { apiErrorCode, isFreemiumGateError } from './cellar-errors';

describe('cellar-errors', () => {
  it('reads API error codes', () => {
    const err = new HttpErrorResponse({
      status: 403,
      error: { code: 'E_BOTTLE_LIMIT', message: 'Cave pleine · passe premium pour continuer' },
    });
    expect(apiErrorCode(err)).toBe('E_BOTTLE_LIMIT');
    expect(isFreemiumGateError(err)).toBeTrue();
  });

  it('treats premium required as freemium gate', () => {
    const err = new HttpErrorResponse({
      status: 403,
      error: { code: 'E_PREMIUM_REQUIRED', feature: 'fillLevel' },
    });
    expect(isFreemiumGateError(err)).toBeTrue();
  });
});
