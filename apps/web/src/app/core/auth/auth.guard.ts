import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { SessionGate } from './session-gate';

/** Protects cellar / account routes — redirect to login when no Bearer session. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const gate = inject(SessionGate);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  // Any biometric lock → login. Never keep /cave active under a cover that can
  // fail to paint (blank shell / no usable route). Cover is overlay-only on login.
  if (gate.locked()) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  return true;
};
