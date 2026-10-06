import type { APIRoute } from 'astro';

const body = (sitemapURL: URL) => `User-agent: *
Allow: /

# Invite deep links and SEO stubs are noindex; keep them out of crawl focus.
Disallow: /i/
Disallow: /api/

Sitemap: ${sitemapURL.href}
`;

export const GET: APIRoute = ({ site }) => {
  const sitemapURL = new URL('sitemap-index.xml', site ?? 'https://atasoif.fr');
  return new Response(body(sitemapURL), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
};
