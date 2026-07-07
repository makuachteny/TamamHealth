import type { MetadataRoute } from 'next';

/**
 * /sitemap.xml — generated at build time by Next.js' file convention.
 *
 * Lists every static marketing route the site currently ships. Keep this
 * intentionally small until the public content library contains
 * verified, customer-approved stories and documentation.
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
    { path: '/', priority: 1.0, changeFrequency: 'weekly' },
    { path: '/products', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/products/hospital', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/products/clinic', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/products/lab', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/products/pharmacy', priority: 0.8, changeFrequency: 'monthly' },
    { path: '/pricing', priority: 0.9, changeFrequency: 'monthly' },
    { path: '/about', priority: 0.7, changeFrequency: 'monthly' },
    { path: '/about/team', priority: 0.6, changeFrequency: 'monthly' },
    { path: '/about/contact', priority: 0.8, changeFrequency: 'monthly' },
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
