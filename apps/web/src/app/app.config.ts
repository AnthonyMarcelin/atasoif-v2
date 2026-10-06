import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/auth/auth.interceptor';
import { OauthDeepLinkService } from './core/auth/oauth-deep-link.service';
import { TokenStorage } from './core/auth/token-storage';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAppInitializer(async () => {
      const storage = inject(TokenStorage);
      // Preferences must not block first paint / login (hung bridge → black screen).
      await Promise.race([
        storage.hydrate(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2_000);
        }),
      ]);
      // AuthService must read the hydrated token before guards / SessionLock run.
      inject(AuthService).syncFromStorage();
    }),
    provideAppInitializer(() => inject(OauthDeepLinkService).start()),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
