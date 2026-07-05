/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

const nextConfig = {
  // One-page site: the old routes now live on / as anchored sections. Keep
  // bookmarks, search results, and external links working with redirects.
  async redirects() {
    return [
      { source: '/products', destination: '/#products', permanent: true },
      { source: '/products/:path*', destination: '/#products', permanent: true },
      { source: '/about/contact', destination: '/#contact', permanent: true },
      { source: '/about/:path*', destination: '/#about', permanent: true },
      { source: '/about', destination: '/#about', permanent: true },
      { source: '/download', destination: '/#download', permanent: true },
      { source: '/resources/:path*', destination: '/', permanent: true },
      { source: '/case-studies/:path*', destination: '/', permanent: true },
      { source: '/case-studies', destination: '/', permanent: true },
      { source: '/patient-experience', destination: '/', permanent: true },
      { source: '/donate', destination: '/#contact', permanent: true },
      { source: '/pricing', destination: '/#contact', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://images.unsplash.com",
              "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
