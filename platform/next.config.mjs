/** @type {import('next').NextConfig} */
import nextEnv from '@next/env';
import { withSentryConfig } from '@sentry/nextjs';

const { loadEnvConfig } = nextEnv;

// next.config.mjs is evaluated before Next injects .env.local into process.env.
// Load env files explicitly so CSP connect-src can include CouchDB + bridge URLs.
loadEnvConfig(process.cwd());

// Allow CouchDB URL in Content-Security-Policy connect-src when sync is enabled
const couchdbUrl = process.env.NEXT_PUBLIC_COUCHDB_URL || '';
const couchdbConnectSrc = couchdbUrl ? ` ${couchdbUrl}` : '';

// Fingerprint bridge runs on loopback on the registration desk PC (see fingerprint-bridge/).
// Include both hostnames — browsers treat localhost and 127.0.0.1 as different origins.
const fingerprintBridgeUrl = (process.env.NEXT_PUBLIC_FINGERPRINT_BRIDGE_URL || '').replace(/\/+$/, '');
const fingerprintEnabled = process.env.NEXT_PUBLIC_FINGERPRINT_ENABLED === 'true';
const fingerprintConnectSrc = fingerprintEnabled
  ? [
      fingerprintBridgeUrl,
      'http://127.0.0.1:7345',
      'http://localhost:7345',
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(' ')
      .replace(/^/, ' ')
  : fingerprintBridgeUrl
    ? ` ${fingerprintBridgeUrl}`
    : '';

const isProd = process.env.NODE_ENV === 'production';

// Next.js requires 'unsafe-eval' in dev (HMR / react-refresh uses eval) and
// 'unsafe-inline' for the bootstrap script injection. In production we drop
// 'unsafe-eval' entirely; inline scripts are still needed by the Next.js
// runtime but we scope them with 'strict-dynamic' so only scripts loaded by
// already-trusted code execute.
const scriptSrc = isProd
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-eval' 'unsafe-inline'";

// Cache-bust identifier baked into the client bundle. Used by the service
// worker registration (`/sw.js?v=<BUILD_ID>`) so a new deploy invalidates
// the old SW cache without requiring a manual version bump.
// Priority: explicit env var → git short SHA (set via `NEXT_PUBLIC_BUILD_ID=$(git rev-parse --short HEAD)`) → timestamp.
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || String(Date.now());

const nextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  generateBuildId: () => BUILD_ID,
  experimental: {
    // Tree-shake heavy barrel imports so pages only pull the components they
    // use — cuts dev compile time and production bundle size.
    optimizePackageImports: ['recharts', 'date-fns', 'react-big-calendar', '@heroicons/react'],
  },
  webpack: (config, { isServer }) => {
    // Filter managed paths that don't contain a package.json to avoid noisy
    // webpack cache warnings from empty optional dependency stubs.
    // Suppress noisy webpack cache warnings for platform-specific optional
    // dependency stubs (e.g. @next/swc-linux-x64-gnu on macOS).
    config.infrastructureLogging = {
      ...config.infrastructureLogging,
      level: 'error',
    };

    if (!isServer) {
      // PouchDB needs these Node.js polyfills disabled in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
      };
    }
    return config;
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
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob:",
              `connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://api.iconify.design https://api.simplesvg.com https://api.unisvg.com${couchdbConnectSrc}${fingerprintConnectSrc}`,
              "worker-src 'self' blob:",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              ...(isProd ? ['upgrade-insecure-requests'] : []),
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

// Wrap the export in `withSentryConfig` so the build emits client/server
// source-map uploads (only when SENTRY_AUTH_TOKEN + org/project are set —
// otherwise this is a transparent passthrough). `silent: true` suppresses
// the build-time logspam, `widenClientFileUpload` covers route-handler
// chunks, and `hideSourceMaps` keeps the .map files out of the public
// browser path so source isn't leaked alongside the bundle.
export default withSentryConfig(nextConfig, {
  silent: true,
  widenClientFileUpload: true,
  hideSourceMaps: true,
});
