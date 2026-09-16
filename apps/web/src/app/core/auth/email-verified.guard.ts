import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * App surfaces (/me, /cellar, …) require a confirmed email.
 * Unverified sessions stay on /auth/verify-email.
 */
export const emailVerifiedGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (auth.isEmailVerified()) {
    return true;
  }

  return router.createUrlTree(['/auth/verify-email'], {
    queryParams: { returnUrl: state.url },
  });
};
