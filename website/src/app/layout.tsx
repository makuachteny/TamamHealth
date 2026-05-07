import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./marketing.css";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export const metadata: Metadata = {
  title: "TamamHealth — Digital Health Platform for South Sudan",
  description:
    "The complete hospital information system built for South Sudan. Offline-first EHR, billing, pharmacy, lab, telehealth — designed by doctors, built for real clinical workflows.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TamamHealth",
  },
  applicationName: "TamamHealth",
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
