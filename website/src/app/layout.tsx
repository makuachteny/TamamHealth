import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// Single source of truth for the canonical site URL. Falls back to the
// public production hostname if no override is set (e.g. running the
// production build locally without a `.env`).
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tamamhealth.org").replace(/\/$/, "");
const siteTitle = "TamamHealth — Digital Health Platform for South Sudan";
const siteDescription =
  "The complete hospital information system built for South Sudan. Offline-first EHR, billing, pharmacy, lab, telehealth — designed by doctors, built for real clinical workflows.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TamamHealth",
  },
  applicationName: "TamamHealth",
  // Open Graph + Twitter card so social previews don't render as bare URLs.
  // `images` falls back to the canonical product screenshot living in /public.
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "TamamHealth",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/assets/dashboard-screenshot.png",
        width: 1200,
        height: 630,
        alt: "TamamHealth product dashboard",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/assets/dashboard-screenshot.png"],
    creator: "@tamamhealth",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: siteUrl,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FAFAF8",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/tamamhealth-icon.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.svg" />
      </head>
      <body className="antialiased">
        <div className="mk-page">
          <MarketingNav />
          {children}
          <MarketingFooter />
        </div>
      </body>
    </html>
  );
}
