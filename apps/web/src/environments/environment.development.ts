/** Local Angular + Adonis (`bun run dev:api` on :3000, `bun run dev:web` on :4200). */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  /** Facebook Ally login — UI standby (API routes kept optional). Flip to re-enable. */
  showFacebookLogin: false,
  /** Sign in with Apple via Ally (web Services ID). Flip off to hide CTA. */
  showAppleLogin: true,
  /**
   * Store review bypass secret (7 taps on logo). Copy from root `.env`
   * `STORE_REVIEW_SECRET` for local/TestFlight builds — do not commit the value.
   */
  storeReviewSecret: '',
};
