import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

// Single source of truth for the canonical site URL. Falls back to the
// public production hostname if no override is set (e.g. running the
// production build locally without a `.env`).
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://tamamhealth.org").replace(/\/$/, "");
const siteTitle = "TamamHealth — Every Patient Deserves to Be Remembered";
const siteDescription =
  "TamamHealth is building an offline-first health record system for South Sudan and Africa, helping health workers keep one patient memory from the bedside to the nation.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  manifest: "/manifest.webmanifest",
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
        url: "/assets/Dashboard.png",
        width: 1200,
        height: 630,
        alt: "TamamHealth offline-first health record platform",
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
        {/* Fonts load here (not via a CSS @import) because Turbopack strips
            external @import URLs in dev, which silently dropped every font. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700&family=DM+Mono:wght@400;500&family=Comfortaa:wght@400;500;600;700&family=Quicksand:wght@400;500;600&display=swap"
        />
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
