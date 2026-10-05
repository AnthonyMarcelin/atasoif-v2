/** Local Angular + Adonis (`bun run dev:api` on :3000, `bun run dev:web` on :4200). */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  /** Facebook Ally login — UI standby (API routes kept optional). Flip to re-enable. */
  showFacebookLogin: false,
  /** Sign in with Apple via Ally (web Services ID). Flip off to hide CTA. */
  showAppleLogin: true,
};
