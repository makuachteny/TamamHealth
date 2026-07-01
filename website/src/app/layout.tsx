import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import MarketingChatButton from "@/components/marketing/MarketingChatButton";
import MarketingPageTransition from "@/components/marketing/MarketingPageTransition";

// Single source of truth for the canonical site URL. Falls back to the
// public production hostname if no override is set (e.g. running the
// production build locally without a `.env`).
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tamamhealth.org").replace(/\/$/, "");
const siteTitle = "Tamam — Offline-ready health records";
const siteDescription =
  "Tamam is building an offline-ready health record system for clinics and hospitals, starting with workflows that connect registration, clinical notes, pharmacy, lab, billing, and reporting.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tamam",
  },
  applicationName: "Tamam",
  // Open Graph + Twitter card so social previews don't render as bare URLs.
  // `images` falls back to the canonical product screenshot living in /public.
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Tamam",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/assets/Dashboard.png",
        width: 1200,
        height: 630,
        alt: "Tamam offline-first health record platform",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/assets/Dashboard.png"],
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
  themeColor: "#FEFFF9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/svg+xml" href="/assets/logos/SVG/Tamam_Style_Guide-33.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/assets/logos/SVG/Tamam_Style_Guide-33.svg" />
      </head>
      <body className="antialiased">
        <div className="mk-page">
          <MarketingNav />
          <MarketingPageTransition>{children}</MarketingPageTransition>
          <MarketingFooter />
          <MarketingChatButton />
        </div>
      </body>
    </html>
  );
}
