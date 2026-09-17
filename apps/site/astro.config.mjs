// @ts-check
import { defineConfig } from 'astro/config';

/** Static marketing site for Dokploy (nginx) on the VPS. */
export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://atasoif.fr',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
