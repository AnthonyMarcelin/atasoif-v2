import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Welcome stays for guests; a stored session goes straight to the cave. */
export const signedInHomeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return router.createUrlTree([auth.postAuthPath('/cave')]);
  }

  return true;
};
