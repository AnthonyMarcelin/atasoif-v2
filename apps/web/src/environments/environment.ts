/**
 * Production environment (default `ng build` / `web:build:production`).
 * Dev serve swaps this file for `environment.development.ts` via angular.json
 * `fileReplacements`.
 */
export const environment = {
  production: true,
  apiBaseUrl: 'https://api.atasoif.fr',
  /** Facebook Ally login — UI standby (API routes kept optional). Flip to re-enable. */
  showFacebookLogin: false,
  /** Sign in with Apple via Ally (web Services ID). Flip off to hide CTA. */
  showAppleLogin: true,
};
