// @ts-check
import node from '@astrojs/node';
import { defineConfig } from 'astro/config';

/** Marketing site: prerendered pages + on-demand `/api/waitlist` (Resend). */
export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://atasoif.fr',
  compressHTML: true,
  adapter: node({
    mode: 'standalone',
  }),
  session: false,
  build: {
    inlineStylesheets: 'auto',
  },
});
