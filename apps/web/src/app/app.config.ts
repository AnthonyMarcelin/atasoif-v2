import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { OauthDeepLinkService } from './core/auth/oauth-deep-link.service';
import { TokenStorage } from './core/auth/token-storage';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideAppInitializer(() => inject(TokenStorage).hydrate()),
    provideAppInitializer(() => inject(OauthDeepLinkService).start()),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
