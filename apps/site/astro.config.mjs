// @ts-check
import node from '@astrojs/node';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL || 'https://atasoif.fr';

/** Marketing site: prerendered pages + on-demand `/api/waitlist` (Resend). */
export default defineConfig({
  output: 'static',
  site,
  compressHTML: true,
  adapter: node({
    mode: 'standalone',
  }),
  session: false,
  integrations: [
    sitemap({
      // Invites are SSR; SEO stubs stay noindex until the public catalog API lands.
      filter: (page) =>
        !page.includes('/i/') &&
        !page.includes('/categorie/') &&
        !page.includes('/bouteille/'),
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    ssr: {
      // Keep Resend inside the server bundle (avoids Bun symlink node_modules in Docker).
      noExternal: ['resend'],
    },
  },
});
