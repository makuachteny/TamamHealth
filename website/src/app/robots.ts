import type { MetadataRoute } from 'next';

/**
 * /robots.txt — generated at build time by Next.js' file convention.
 *
 * Marketing surface is public; only `/api/*` (server endpoints) is hidden
 * from indexing. The sitemap reference uses NEXT_PUBLIC_SITE_URL when set,
 * otherwise the canonical https://tamamhealth.org host.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://tamamhealth.org').replace(/\/$/, '');
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
