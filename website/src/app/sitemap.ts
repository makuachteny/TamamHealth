import type { MetadataRoute } from 'next';

/**
 * /sitemap.xml — generated at build time by Next.js' file convention.
 *
 * The site is a single-page marketing homepage plus two legal pages.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in production to point at the canonical host;
 * otherwise the default `https://tamamhealth.org` is used.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tamamhealth.org').replace(/\/$/, '');
  const now = new Date();

  const routes: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
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
