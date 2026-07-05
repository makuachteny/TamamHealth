import type { MetadataRoute } from 'next';

/**
 * /sitemap.xml — generated at build time by Next.js' file convention.
 *
 * Lists every static marketing route the site currently ships. Dynamic
 * pages (e.g. `/case-studies/[slug]`) are not enumerated here because we
 * don't yet have a programmatic source of slugs; add them once the
 * case-study CMS lands.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in production to point at the canonical host;
 * otherwise the default `https://tamamhealth.org` is used.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tamamhealth.org').replace(/\/$/, '');
  const now = new Date();

  // Top-level marketing pages. `priority` is a soft hint to crawlers and
  // is not interpreted uniformly — we keep the home page at 1.0 and the
  // legal pages at 0.3, with everything else in between.
  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
    // One-page site: everything lives on / as anchored sections; only the
    // legal pages remain as separate routes.
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
